import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { buildMetadata } from '@/lib/seo';
import { CouplesTable } from '@/components/admin/couples-table';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Relationship spaces', noIndex: true });
}

export default async function AdminCouplesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createAdminClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 25;

  const { data: couples, count } = await supabase
    .from('couples')
    .select(
      'id, name, relationship_type, status, currency, created_at, owner_id, members:couple_members(id, user_id, member_role, display_role, removed_at, profile:profiles(email, full_name))',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Relationship spaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {count ?? 0} spaces. You can remove either member from a space — for example when one
          partner has paid and asks for the other to be removed.
        </p>
      </header>

      <CouplesTable
        couples={(couples ?? []) as any[]}
        page={page}
        pageSize={pageSize}
        total={count ?? 0}
      />
    </div>
  );
}
