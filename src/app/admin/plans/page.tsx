import type { Metadata } from 'next';
import { query, parseJson, toBool } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { PlansManager } from '@/components/admin/plans-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Plans & pricing', noIndex: true });
}

export default async function AdminPlansPage() {
  const [plans, prices] = await Promise.all([
    query<any>(`SELECT * FROM plans ORDER BY sort_order ASC`),
    query<any>(`SELECT * FROM plan_prices ORDER BY amount_cents ASC`),
  ]);

  const rows = plans.map((plan) => ({
    ...plan,
    is_active: toBool(plan.is_active),
    is_featured: toBool(plan.is_featured),
    is_free: toBool(plan.is_free),
    features: parseJson<string[]>(plan.features, []),
    limits: parseJson<Record<string, unknown>>(plan.limits, {}),
    prices: prices
      .filter((price) => price.plan_id === plan.id)
      .map((price) => ({
        ...price,
        interval: price.billing_interval,
        is_active: toBool(price.is_active),
      })),
  }));

  return <PlansManager plans={rows} />;
}
