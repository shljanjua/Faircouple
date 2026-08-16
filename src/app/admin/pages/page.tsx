import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { buildMetadata } from '@/lib/seo';
import { PagesManager } from '@/components/admin/pages-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Pages', noIndex: true });
}

export default async function AdminPagesPage() {
  const supabase = createAdminClient();
  const { data: pages } = await supabase.from('pages').select('*').order('sort_order');
  return <PagesManager pages={(pages ?? []) as any[]} />;
}
