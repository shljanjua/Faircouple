import { NextResponse, type NextRequest } from 'next/server';
import { execute, queryOne, uuid, toMysqlDateTime, nowSql } from '@/lib/db';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { capturePaypalOrder, periodEnd } from '@/lib/payments';
import { normalizeCurrency, formatMoney } from '@/lib/currency';
import { sendEmail } from '@/lib/email';
import { recordAudit } from '@/lib/audit';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/** PayPal redirects the buyer back here after approval; we capture and activate. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token'); // PayPal order id
  const planSlug = searchParams.get('plan');
  const interval = searchParams.get('interval') ?? 'month';
  const currency = normalizeCurrency(searchParams.get('currency'));

  const fail = (message: string) =>
    NextResponse.redirect(
      `${SITE_URL}/dashboard/billing?checkout=failed&message=${encodeURIComponent(message)}`
    );

  if (!token || !planSlug) return fail('Missing PayPal order details.');

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/signin?next=%2Fdashboard%2Fbilling`);

  const captured = await capturePaypalOrder(token);
  if (!captured.ok) return fail(captured.error);

  const status = captured.order?.status;
  if (status !== 'COMPLETED') return fail(`PayPal returned status ${status}.`);

  const context = await getCoupleContext();

  const plan = await queryOne<any>(`SELECT * FROM plans WHERE slug = ? LIMIT 1`, [planSlug]);
  if (!plan) return fail('Plan not found.');

  const price = await queryOne<any>(
    `SELECT * FROM plan_prices WHERE plan_id = ? AND currency = ? AND billing_interval = ? LIMIT 1`,
    [plan.id, currency, interval]
  );

  const capture = captured.order?.purchase_units?.[0]?.payments?.captures?.[0];
  const amountCents = Math.round(Number(capture?.amount?.value ?? 0) * 100);

  const start = new Date();
  const end = periodEnd(interval, start);

  const upsert = await execute(
    `INSERT INTO subscriptions
       (id, user_id, couple_id, plan_id, price_id, provider, provider_subscription_id,
        provider_customer_id, status, currency, billing_interval, amount_cents,
        current_period_start, current_period_end)
     VALUES (?, ?, ?, ?, ?, 'paypal', ?, ?, 'active', ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       plan_id              = VALUES(plan_id),
       price_id             = VALUES(price_id),
       provider_customer_id = VALUES(provider_customer_id),
       status               = 'active',
       currency             = VALUES(currency),
       billing_interval     = VALUES(billing_interval),
       amount_cents         = VALUES(amount_cents),
       current_period_start = VALUES(current_period_start),
       current_period_end   = VALUES(current_period_end)`,
    [
      uuid(),
      user.id,
      context?.couple.id ?? null,
      plan.id,
      price?.id ?? null,
      token,
      captured.order?.payer?.payer_id ?? null,
      currency,
      interval,
      amountCents || price?.amount_cents || 0,
      toMysqlDateTime(start),
      toMysqlDateTime(end),
    ]
  );

  if (!upsert.ok) return fail(upsert.error ?? 'Could not activate your subscription.');

  const subscription = await queryOne<{ id: string }>(
    `SELECT id FROM subscriptions WHERE provider = 'paypal' AND provider_subscription_id = ? LIMIT 1`,
    [token]
  );

  await execute(
    `INSERT INTO payments
       (id, user_id, subscription_id, provider, provider_payment_id, amount_cents, currency,
        status, description, billing_email, paid_at, metadata)
     VALUES (?, ?, ?, 'paypal', ?, ?, ?, 'succeeded', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = 'succeeded', paid_at = VALUES(paid_at)`,
    [
      uuid(),
      user.id,
      subscription?.id ?? null,
      capture?.id ?? token,
      amountCents,
      currency,
      `FairCouples ${plan.name} — ${interval}`,
      captured.order?.payer?.email_address ?? user.email,
      nowSql(),
      JSON.stringify({ order_id: token }),
    ]
  );

  await sendEmail({
    to: user.email,
    template: 'subscription-active',
    variables: {
      name: user.profile.full_name ?? 'there',
      plan_name: plan.name,
      amount: formatMoney(amountCents, currency),
      currency,
      next_billing_date: end.toDateString(),
      invoice_url: `${SITE_URL}/dashboard/billing`,
    },
    userId: user.id,
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'subscription.activate',
    entityType: 'subscription',
    entityId: subscription?.id ?? token,
    summary: `PayPal payment captured for ${planSlug}`,
  });

  return NextResponse.redirect(`${SITE_URL}/dashboard/billing?checkout=success&provider=paypal`);
}
