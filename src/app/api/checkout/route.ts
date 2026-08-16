import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { getStripe, getGateway, createPaypalOrder } from '@/lib/payments';
import { normalizeCurrency } from '@/lib/currency';
import { SITE_URL } from '@/lib/seo';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  let body: {
    planSlug?: string;
    currency?: string;
    interval?: string;
    provider?: 'stripe' | 'paypal';
    coupon?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const planSlug = body.planSlug;
  const provider = body.provider ?? 'stripe';
  const currency = normalizeCurrency(body.currency ?? user.profile.currency);
  const interval = body.interval === 'year' || body.interval === 'lifetime' ? body.interval : 'month';

  if (!planSlug) {
    return NextResponse.json({ error: 'Missing plan.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('*, prices:plan_prices(*)')
    .eq('slug', planSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
  }

  if ((plan as any).is_free) {
    return NextResponse.json({ url: '/dashboard' });
  }

  const price = ((plan as any).prices ?? []).find(
    (row: any) => row.currency === currency && row.interval === interval && row.is_active
  );

  if (!price) {
    return NextResponse.json(
      { error: `No ${interval} price is configured in ${currency} for this plan.` },
      { status: 400 }
    );
  }

  const context = await getCoupleContext();
  const successUrl = `${SITE_URL}/dashboard/billing?checkout=success&provider=${provider}`;
  const cancelUrl = `${SITE_URL}/pricing?checkout=cancelled`;

  /* ------------------------------------------------------------- Stripe */
  if (provider === 'stripe') {
    const stripe = await getStripe();
    const gateway = await getGateway('stripe');

    if (!stripe || !gateway?.isEnabled) {
      return NextResponse.json(
        { error: 'Card payments are not enabled yet. Please try PayPal or contact support.' },
        { status: 503 }
      );
    }

    try {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from('subscriptions')
        .select('provider_customer_id')
        .eq('user_id', user.id)
        .eq('provider', 'stripe')
        .not('provider_customer_id', 'is', null)
        .limit(1)
        .maybeSingle();

      let customerId = (existing as any)?.provider_customer_id as string | undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.profile.full_name ?? undefined,
          metadata: { user_id: user.id, couple_id: context?.couple.id ?? '' },
        });
        customerId = customer.id;
      }

      const isLifetime = interval === 'lifetime';
      const lineItem = price.stripe_price_id
        ? { price: price.stripe_price_id as string, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: price.amount_cents,
              product_data: {
                name: `FairCouples ${(plan as any).name}`,
                description: (plan as any).tagline ?? undefined,
              },
              ...(isLifetime
                ? {}
                : { recurring: { interval: interval as 'month' | 'year' } }),
            },
          };

      const session = await stripe.checkout.sessions.create({
        mode: isLifetime ? 'payment' : 'subscription',
        customer: customerId,
        line_items: [lineItem as any],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        automatic_tax: { enabled: false },
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          couple_id: context?.couple.id ?? '',
          plan_id: (plan as any).id,
          plan_slug: planSlug,
          price_id: price.id,
          interval,
          currency,
        },
        ...(isLifetime
          ? {}
          : {
              subscription_data: {
                ...((plan as any).trial_days > 0
                  ? { trial_period_days: (plan as any).trial_days }
                  : {}),
                metadata: {
                  user_id: user.id,
                  couple_id: context?.couple.id ?? '',
                  plan_id: (plan as any).id,
                  price_id: price.id,
                },
              },
            }),
      });

      await recordAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: 'checkout.start',
        entityType: 'plan',
        entityId: planSlug,
        summary: `Stripe checkout for ${planSlug} (${currency}/${interval})`,
      });

      return NextResponse.json({ url: session.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe checkout failed.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  /* ------------------------------------------------------------- PayPal */
  const gateway = await getGateway('paypal');
  if (!gateway?.isEnabled) {
    return NextResponse.json(
      { error: 'PayPal is not enabled yet. Please use a card or contact support.' },
      { status: 503 }
    );
  }

  const order = await createPaypalOrder({
    amountCents: price.amount_cents,
    currency,
    description: `FairCouples ${(plan as any).name} — ${interval}`,
    returnUrl: `${SITE_URL}/api/checkout/paypal/capture?plan=${planSlug}&interval=${interval}&currency=${currency}`,
    cancelUrl,
    referenceId: `${user.id}:${(plan as any).id}:${price.id}`,
  });

  if (!order.ok) {
    return NextResponse.json({ error: order.error }, { status: 500 });
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'checkout.start',
    entityType: 'plan',
    entityId: planSlug,
    summary: `PayPal checkout for ${planSlug} (${currency}/${interval})`,
  });

  return NextResponse.json({ url: order.approveUrl, orderId: order.orderId });
}
