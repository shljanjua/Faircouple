import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { UsersTable } from '@/components/admin/users-table';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Users', noIndex: true });
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; status?: string; page?: string };
}) {
  const me = await getSessionUser();
  const supabase = createAdminClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 25;

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (searchParams.q) {
    query = query.or(`email.ilike.%${searchParams.q}%,full_name.ilike.%${searchParams.q}%`);
  }
  if (searchParams.role) query = query.eq('role', searchParams.role);
  if (searchParams.status) query = query.eq('status', searchParams.status);

  const { data: users, count } = await query;

  const { data: plans } = await supabase
    .from('plans')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order');

  const userIds = (users ?? []).map((user: any) => user.id);
  const { data: subscriptions } = userIds.length
    ? await supabase
        .from('subscriptions')
        .select('user_id, status, plan:plans(name)')
        .in('user_id', userIds)
        .in('status', ['active', 'trialing'])
    : { data: [] as any[] };

  const planByUser = new Map<string, string>();
  for (const subscription of (subscriptions ?? []) as any[]) {
    planByUser.set(subscription.user_id, subscription.plan?.name ?? 'Paid');
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {count ?? 0} accounts. Change roles, suspend abusive accounts, grant plans or delete a
          member entirely.
        </p>
      </header>

      <Card className="p-4">
        <form className="flex flex-wrap gap-3" method="get">
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Search name or email…"
            aria-label="Search users"
            className="h-10 min-w-[220px] flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <select
            name="role"
            defaultValue={searchParams.role ?? ''}
            aria-label="Filter by role"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <select
            name="status"
            defaultValue={searchParams.status ?? ''}
            aria-label="Filter by status"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
            <option value="pending_deletion">Pending deletion</option>
          </select>
          <button
            type="submit"
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Filter
          </button>
        </form>
      </Card>

      <UsersTable
        users={(users ?? []) as any[]}
        plans={(plans ?? []) as any[]}
        planByUser={Object.fromEntries(planByUser)}
        myId={me!.id}
        myRole={me!.profile.role}
        page={page}
        pageSize={pageSize}
        total={count ?? 0}
      />
    </div>
  );
}
