import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { getGateway } from '@/lib/payments';
import { buildMetadata } from '@/lib/seo';
import { CheckoutPanel } from '@/components/app/checkout-panel';
import { normalizeCurrency } from '@/lib/currency';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Checkout', path: '/checkout', noIndex: true });
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: { plan?: string; currency?: string; interval?: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=%2Fpricing');

  const planSlug = searchParams.plan;
  if (!planSlug) redirect('/pricing');

  const supabase = createClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('*, prices:plan_prices(*)')
    .eq('slug', planSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!plan || (plan as any).is_free) redirect('/dashboard');

  const [stripe, paypal] = await Promise.all([getGateway('stripe'), getGateway('paypal')]);

  return (
    <div className="mx-auto max-w-3xl">
      <CheckoutPanel
        plan={plan as any}
        currency={normalizeCurrency(searchParams.currency ?? user.profile.currency)}
        interval={searchParams.interval ?? 'year'}
        stripeEnabled={Boolean(stripe?.isEnabled)}
        paypalEnabled={Boolean(paypal?.isEnabled)}
      />
    </div>
  );
}
