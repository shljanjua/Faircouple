import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripe, getGateway } from '@/lib/payments';
import { sendEmail } from '@/lib/email';
import { formatMoney } from '@/lib/currency';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Stripe webhook. Configure the endpoint as
 *   https://<your-domain>/api/webhooks/stripe
 * and subscribe to: checkout.session.completed, customer.subscription.*,
 * invoice.paid, invoice.payment_failed, charge.refunded.
 */
export async function POST(request: NextRequest) {
  const stripe = await getStripe();
  const gateway = await getGateway('stripe');

  if (!stripe || !gateway?.credentials.webhook_secret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, gateway.credentials.webhook_secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid signature';
    return NextResponse.json({ error: `Webhook verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency: skip events we have already processed.
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id, status')
    .eq('provider', 'stripe')
    .eq('event_id', event.id)
    .maybeSingle();

  if ((existing as any)?.status === 'processed') {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await supabase.from('webhook_events').upsert(
    {
      provider: 'stripe',
      event_id: event.id,
      event_type: event.type,
      payload: event as any,
      status: 'received',
    },
    { onConflict: 'provider,event_id' }
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(stripe, supabase, session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(supabase, subscription);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await recordInvoice(supabase, invoice, 'succeeded');
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await recordInvoice(supabase, invoice, 'failed');
        await notifyPaymentFailure(supabase, invoice);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await supabase
          .from('payments')
          .update({
            status: charge.amount_refunded === charge.amount ? 'refunded' : 'partially_refunded',
            refunded_cents: charge.amount_refunded,
          })
          .eq('provider', 'stripe')
          .eq('provider_payment_id', charge.payment_intent as string);
        break;
      }
      default:
        break;
    }

    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('provider', 'stripe')
      .eq('event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Handler failed';
    await supabase
      .from('webhook_events')
      .update({ status: 'failed', error: message })
      .eq('provider', 'stripe')
      .eq('event_id', event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  const metadata = session.metadata ?? {};
  const userId = metadata.user_id || (session.client_reference_id ?? '');
  if (!userId) return;

  const planId = metadata.plan_id;
  const interval = metadata.interval ?? 'month';
  const currency = (session.currency ?? metadata.currency ?? 'usd').toUpperCase();
  const amount = session.amount_total ?? 0;

  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    await syncSubscription(supabase, subscription, {
      userId,
      coupleId: metadata.couple_id || null,
      planId,
      priceId: metadata.price_id || null,
    });
  } else {
    // One-off (Lifetime) purchase.
    const start = new Date();
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 100);

    await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        couple_id: metadata.couple_id || null,
        plan_id: planId,
        price_id: metadata.price_id || null,
        provider: 'stripe',
        provider_subscription_id: session.id,
        provider_customer_id: (session.customer as string) ?? null,
        status: 'active',
        currency,
        interval: 'lifetime',
        amount_cents: amount,
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
      },
      { onConflict: 'provider,provider_subscription_id' }
    );
  }

  await supabase.from('payments').insert({
    user_id: userId,
    provider: 'stripe',
    provider_payment_id: (session.payment_intent as string) ?? session.id,
    provider_invoice_id: (session.invoice as string) ?? null,
    amount_cents: amount,
    currency,
    status: 'succeeded',
    description: `FairCouples checkout (${interval})`,
    billing_email: session.customer_details?.email ?? null,
    billing_country: session.customer_details?.address?.country ?? null,
    paid_at: new Date().toISOString(),
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle();

  const { data: plan } = await supabase
    .from('plans')
    .select('name')
    .eq('id', planId)
    .maybeSingle();

  if ((profile as any)?.email) {
    await sendEmail({
      to: (profile as any).email,
      template: 'subscription-active',
      variables: {
        name: (profile as any).full_name ?? 'there',
        plan_name: (plan as any)?.name ?? 'your plan',
        amount: formatMoney(amount, currency),
        currency,
        next_billing_date: interval === 'lifetime' ? 'never — you own it' : 'in one billing period',
        invoice_url: `${SITE_URL}/dashboard/billing`,
      },
      userId,
    });
  }
}

async function syncSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
  overrides?: {
    userId?: string;
    coupleId?: string | null;
    planId?: string;
    priceId?: string | null;
  }
) {
  const metadata = subscription.metadata ?? {};
  const userId = overrides?.userId || metadata.user_id;
  if (!userId) return;

  const item = subscription.items.data[0];
  const interval = item?.price?.recurring?.interval ?? 'month';

  await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      couple_id: overrides?.coupleId ?? metadata.couple_id ?? null,
      plan_id: overrides?.planId ?? metadata.plan_id,
      price_id: overrides?.priceId ?? metadata.price_id ?? null,
      provider: 'stripe',
      provider_subscription_id: subscription.id,
      provider_customer_id: subscription.customer as string,
      status: subscription.status,
      currency: (item?.price?.currency ?? 'usd').toUpperCase(),
      interval,
      amount_cents: item?.price?.unit_amount ?? 0,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
    },
    { onConflict: 'provider,provider_subscription_id' }
  );
}

async function recordInvoice(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice,
  status: 'succeeded' | 'failed'
) {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('provider', 'stripe')
    .eq('provider_subscription_id', (invoice.subscription as string) ?? '')
    .maybeSingle();

  await supabase.from('payments').upsert(
    {
      user_id: (subscription as any)?.user_id ?? null,
      subscription_id: (subscription as any)?.id ?? null,
      provider: 'stripe',
      provider_payment_id: (invoice.payment_intent as string) ?? invoice.id,
      provider_invoice_id: invoice.id,
      amount_cents: invoice.amount_paid || invoice.amount_due,
      currency: (invoice.currency ?? 'usd').toUpperCase(),
      status,
      description: invoice.lines.data[0]?.description ?? 'Subscription renewal',
      invoice_url: invoice.hosted_invoice_url ?? null,
      receipt_url: invoice.invoice_pdf ?? null,
      billing_email: invoice.customer_email ?? null,
      paid_at: status === 'succeeded' ? new Date().toISOString() : null,
      failure_reason: status === 'failed' ? 'Card declined or expired' : null,
    },
    { onConflict: 'provider,provider_payment_id' }
  );
}

async function notifyPaymentFailure(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  if (!invoice.customer_email) return;
  await sendEmail({
    to: invoice.customer_email,
    template: 'payment-failed',
    variables: {
      name: invoice.customer_name ?? 'there',
      plan_name: invoice.lines.data[0]?.description ?? 'your plan',
      retry_url: `${SITE_URL}/dashboard/billing`,
    },
  });
}
