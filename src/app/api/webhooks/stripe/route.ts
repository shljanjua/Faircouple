import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { execute, queryOne, uuid, nowSql, toMysqlDateTime } from '@/lib/db';
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

  // Idempotency: skip events we have already processed.
  const existing = await queryOne<{ status: string }>(
    `SELECT status FROM webhook_events WHERE provider = 'stripe' AND event_id = ? LIMIT 1`,
    [event.id]
  );

  if (existing?.status === 'processed') {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await execute(
    `INSERT INTO webhook_events (id, provider, event_id, event_type, payload, status)
     VALUES (?, 'stripe', ?, ?, ?, 'received')
     ON DUPLICATE KEY UPDATE event_type = VALUES(event_type), payload = VALUES(payload), status = 'received'`,
    [uuid(), event.id, event.type, JSON.stringify(event)]
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.paid': {
        await recordInvoice(event.data.object as Stripe.Invoice, 'succeeded');
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await recordInvoice(invoice, 'failed');
        await notifyPaymentFailure(invoice);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await execute(
          `UPDATE payments SET status = ?, refunded_cents = ?
            WHERE provider = 'stripe' AND provider_payment_id = ?`,
          [
            charge.amount_refunded === charge.amount ? 'refunded' : 'partially_refunded',
            charge.amount_refunded,
            charge.payment_intent as string,
          ]
        );
        break;
      }
      default:
        break;
    }

    await execute(
      `UPDATE webhook_events SET status = 'processed', processed_at = ?
        WHERE provider = 'stripe' AND event_id = ?`,
      [nowSql(), event.id]
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Handler failed';
    await execute(
      `UPDATE webhook_events SET status = 'failed', error = ?
        WHERE provider = 'stripe' AND event_id = ?`,
      [message, event.id]
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Writes (or refreshes) the subscription row keyed by provider + provider id. */
async function upsertSubscription(row: {
  userId: string;
  coupleId: string | null;
  planId: string | null;
  priceId: string | null;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  status: string;
  currency: string;
  interval: string;
  amountCents: number;
  trialEndsAt?: Date | null;
  periodStart: Date;
  periodEnd: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  endedAt?: Date | null;
}) {
  await execute(
    `INSERT INTO subscriptions
       (id, user_id, couple_id, plan_id, price_id, provider, provider_subscription_id,
        provider_customer_id, status, currency, billing_interval, amount_cents, trial_ends_at,
        current_period_start, current_period_end, cancel_at_period_end, canceled_at, ended_at)
     VALUES (?, ?, ?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       couple_id            = VALUES(couple_id),
       plan_id              = COALESCE(VALUES(plan_id), plan_id),
       price_id             = VALUES(price_id),
       provider_customer_id = VALUES(provider_customer_id),
       status               = VALUES(status),
       currency             = VALUES(currency),
       billing_interval     = VALUES(billing_interval),
       amount_cents         = VALUES(amount_cents),
       trial_ends_at        = VALUES(trial_ends_at),
       current_period_start = VALUES(current_period_start),
       current_period_end   = VALUES(current_period_end),
       cancel_at_period_end = VALUES(cancel_at_period_end),
       canceled_at          = VALUES(canceled_at),
       ended_at             = VALUES(ended_at)`,
    [
      uuid(),
      row.userId,
      row.coupleId,
      row.planId,
      row.priceId,
      row.providerSubscriptionId,
      row.providerCustomerId,
      row.status,
      row.currency,
      row.interval,
      row.amountCents,
      toMysqlDateTime(row.trialEndsAt ?? null),
      toMysqlDateTime(row.periodStart),
      toMysqlDateTime(row.periodEnd),
      row.cancelAtPeriodEnd ?? false,
      toMysqlDateTime(row.canceledAt ?? null),
      toMysqlDateTime(row.endedAt ?? null),
    ]
  );
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const userId = metadata.user_id || (session.client_reference_id ?? '');
  if (!userId) return;

  const planId = metadata.plan_id ?? null;
  const interval = metadata.interval ?? 'month';
  const currency = (session.currency ?? metadata.currency ?? 'usd').toUpperCase();
  const amount = session.amount_total ?? 0;

  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    await syncSubscription(subscription, {
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

    await upsertSubscription({
      userId,
      coupleId: metadata.couple_id || null,
      planId,
      priceId: metadata.price_id || null,
      providerSubscriptionId: session.id,
      providerCustomerId: (session.customer as string) ?? null,
      status: 'active',
      currency,
      interval: 'lifetime',
      amountCents: amount,
      periodStart: start,
      periodEnd: end,
    });
  }

  await execute(
    `INSERT INTO payments
       (id, user_id, provider, provider_payment_id, provider_invoice_id, amount_cents, currency,
        status, description, billing_email, billing_country, paid_at)
     VALUES (?, ?, 'stripe', ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = 'succeeded', paid_at = VALUES(paid_at)`,
    [
      uuid(),
      userId,
      (session.payment_intent as string) ?? session.id,
      (session.invoice as string) ?? null,
      amount,
      currency,
      `FairCouples checkout (${interval})`,
      session.customer_details?.email ?? null,
      session.customer_details?.address?.country ?? null,
      nowSql(),
    ]
  );

  const profile = await queryOne<{ email: string; full_name: string | null }>(
    `SELECT email, full_name FROM profiles WHERE id = ? LIMIT 1`,
    [userId]
  );

  const plan = planId
    ? await queryOne<{ name: string }>(`SELECT name FROM plans WHERE id = ? LIMIT 1`, [planId])
    : null;

  if (profile?.email) {
    await sendEmail({
      to: profile.email,
      template: 'subscription-active',
      variables: {
        name: profile.full_name ?? 'there',
        plan_name: plan?.name ?? 'your plan',
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
  subscription: Stripe.Subscription,
  overrides?: {
    userId?: string;
    coupleId?: string | null;
    planId?: string | null;
    priceId?: string | null;
  }
) {
  const metadata = subscription.metadata ?? {};
  const userId = overrides?.userId || metadata.user_id;
  if (!userId) return;

  const item = subscription.items.data[0];
  const interval = item?.price?.recurring?.interval ?? 'month';

  await upsertSubscription({
    userId,
    coupleId: overrides?.coupleId ?? metadata.couple_id ?? null,
    planId: overrides?.planId ?? metadata.plan_id ?? null,
    priceId: overrides?.priceId ?? metadata.price_id ?? null,
    providerSubscriptionId: subscription.id,
    providerCustomerId: subscription.customer as string,
    status: subscription.status,
    currency: (item?.price?.currency ?? 'usd').toUpperCase(),
    interval,
    amountCents: item?.price?.unit_amount ?? 0,
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    periodStart: new Date(subscription.current_period_start * 1000),
    periodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
  });
}

async function recordInvoice(invoice: Stripe.Invoice, status: 'succeeded' | 'failed') {
  const subscription = invoice.subscription
    ? await queryOne<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM subscriptions
          WHERE provider = 'stripe' AND provider_subscription_id = ? LIMIT 1`,
        [invoice.subscription as string]
      )
    : null;

  await execute(
    `INSERT INTO payments
       (id, user_id, subscription_id, provider, provider_payment_id, provider_invoice_id,
        amount_cents, currency, status, description, invoice_url, receipt_url, billing_email,
        paid_at, failure_reason)
     VALUES (?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       subscription_id = VALUES(subscription_id),
       amount_cents    = VALUES(amount_cents),
       status          = VALUES(status),
       invoice_url     = VALUES(invoice_url),
       receipt_url     = VALUES(receipt_url),
       paid_at         = VALUES(paid_at),
       failure_reason  = VALUES(failure_reason)`,
    [
      uuid(),
      subscription?.user_id ?? null,
      subscription?.id ?? null,
      (invoice.payment_intent as string) ?? invoice.id,
      invoice.id,
      invoice.amount_paid || invoice.amount_due,
      (invoice.currency ?? 'usd').toUpperCase(),
      status,
      invoice.lines.data[0]?.description ?? 'Subscription renewal',
      invoice.hosted_invoice_url ?? null,
      invoice.invoice_pdf ?? null,
      invoice.customer_email ?? null,
      status === 'succeeded' ? nowSql() : null,
      status === 'failed' ? 'Card declined or expired' : null,
    ]
  );
}

async function notifyPaymentFailure(invoice: Stripe.Invoice) {
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
