import { NextResponse, type NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
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
  const interval =
    body.interval === 'year' || body.interval === 'lifetime' ? body.interval : 'month';

  if (!planSlug) {
    return NextResponse.json({ error: 'Missing plan.' }, { status: 400 });
  }

  const plan = await queryOne<any>(
    `SELECT * FROM plans WHERE slug = ? AND is_active = 1 LIMIT 1`,
    [planSlug]
  );

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
  }

  if (plan.is_free) {
    return NextResponse.json({ url: '/dashboard' });
  }

  const price = await queryOne<any>(
    `SELECT * FROM plan_prices
      WHERE plan_id = ? AND currency = ? AND billing_interval = ? AND is_active = 1
      LIMIT 1`,
    [plan.id, currency, interval]
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
      const existing = await queryOne<{ provider_customer_id: string }>(
        `SELECT provider_customer_id FROM subscriptions
          WHERE user_id = ? AND provider = 'stripe' AND provider_customer_id IS NOT NULL
          ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      let customerId = existing?.provider_customer_id;
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
                name: `FairCouples ${plan.name}`,
                description: plan.tagline ?? undefined,
              },
              ...(isLifetime ? {} : { recurring: { interval: interval as 'month' | 'year' } }),
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
          plan_id: plan.id,
          plan_slug: planSlug,
          price_id: price.id,
          interval,
          currency,
        },
        ...(isLifetime
          ? {}
          : {
              subscription_data: {
                ...(plan.trial_days > 0 ? { trial_period_days: plan.trial_days } : {}),
                metadata: {
                  user_id: user.id,
                  couple_id: context?.couple.id ?? '',
                  plan_id: plan.id,
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
    description: `FairCouples ${plan.name} — ${interval}`,
    returnUrl: `${SITE_URL}/api/checkout/paypal/capture?plan=${planSlug}&interval=${interval}&currency=${currency}`,
    cancelUrl,
    referenceId: `${user.id}:${plan.id}:${price.id}`,
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
