import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { capturePaypalOrder, periodEnd } from '@/lib/payments';
import { normalizeCurrency } from '@/lib/currency';
import { sendEmail } from '@/lib/email';
import { recordAudit } from '@/lib/audit';
import { SITE_URL } from '@/lib/seo';
import { formatMoney } from '@/lib/currency';

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

  const supabase = createClient();
  const admin = createAdminClient();
  const context = await getCoupleContext();

  const { data: plan } = await supabase
    .from('plans')
    .select('*, prices:plan_prices(*)')
    .eq('slug', planSlug)
    .maybeSingle();

  if (!plan) return fail('Plan not found.');

  const price = ((plan as any).prices ?? []).find(
    (row: any) => row.currency === currency && row.interval === interval
  );

  const capture = captured.order?.purchase_units?.[0]?.payments?.captures?.[0];
  const amountCents = Math.round(Number(capture?.amount?.value ?? 0) * 100);

  const start = new Date();
  const { data: subscription, error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: user.id,
        couple_id: context?.couple.id ?? null,
        plan_id: (plan as any).id,
        price_id: price?.id ?? null,
        provider: 'paypal',
        provider_subscription_id: token,
        provider_customer_id: captured.order?.payer?.payer_id ?? null,
        status: 'active',
        currency,
        interval,
        amount_cents: amountCents || price?.amount_cents || 0,
        current_period_start: start.toISOString(),
        current_period_end: periodEnd(interval, start).toISOString(),
      },
      { onConflict: 'provider,provider_subscription_id' }
    )
    .select('id')
    .single();

  if (error) return fail(error.message);

  await admin.from('payments').insert({
    user_id: user.id,
    subscription_id: (subscription as any).id,
    provider: 'paypal',
    provider_payment_id: capture?.id ?? token,
    amount_cents: amountCents,
    currency,
    status: 'succeeded',
    description: `FairCouples ${(plan as any).name} — ${interval}`,
    billing_email: captured.order?.payer?.email_address ?? user.email,
    paid_at: new Date().toISOString(),
    metadata: { order_id: token },
  });

  await sendEmail({
    to: user.email,
    template: 'subscription-active',
    variables: {
      name: user.profile.full_name ?? 'there',
      plan_name: (plan as any).name,
      amount: formatMoney(amountCents, currency),
      currency,
      next_billing_date: periodEnd(interval, start).toDateString(),
      invoice_url: `${SITE_URL}/dashboard/billing`,
    },
    userId: user.id,
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'subscription.activate',
    entityType: 'subscription',
    entityId: (subscription as any).id,
    summary: `PayPal payment captured for ${planSlug}`,
  });

  return NextResponse.redirect(`${SITE_URL}/dashboard/billing?checkout=success&provider=paypal`);
}
