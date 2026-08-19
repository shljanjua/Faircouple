import type { Metadata } from 'next';
import { limitOffset, query, queryOne } from '@/lib/db';
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
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 25;

  const [couples, totalRow] = await Promise.all([
    query<any>(
      `SELECT id, name, relationship_type, status, currency, created_at, owner_id
         FROM couples ORDER BY created_at DESC ${limitOffset(pageSize, (page - 1) * pageSize)}`
    ),
    queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM couples`),
  ]);

  const total = Number(totalRow?.total ?? 0);

  const members = couples.length
    ? await query<any>(
        `SELECT m.id, m.couple_id, m.user_id, m.member_role, m.display_role, m.removed_at,
                p.email, p.full_name
           FROM couple_members m
           LEFT JOIN profiles p ON p.id = m.user_id
          WHERE m.couple_id IN (${couples.map(() => '?').join(',')})`,
        couples.map((couple) => couple.id)
      )
    : [];

  const rows = couples.map((couple) => ({
    ...couple,
    members: members
      .filter((member) => member.couple_id === couple.id)
      .map((member) => ({
        id: member.id,
        user_id: member.user_id,
        member_role: member.member_role,
        display_role: member.display_role,
        removed_at: member.removed_at,
        profile: { email: member.email, full_name: member.full_name },
      })),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Relationship spaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} spaces. You can remove either member from a space — for example when one partner
          has paid and asks for the other to be removed.
        </p>
      </header>

      <CouplesTable couples={rows} page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
