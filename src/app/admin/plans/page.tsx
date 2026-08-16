import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { buildMetadata } from '@/lib/seo';
import { PlansManager } from '@/components/admin/plans-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Plans & pricing', noIndex: true });
}

export default async function AdminPlansPage() {
  const supabase = createAdminClient();
  const { data: plans } = await supabase
    .from('plans')
    .select('*, prices:plan_prices(*)')
    .order('sort_order');

  return <PlansManager plans={(plans ?? []) as any[]} />;
}
