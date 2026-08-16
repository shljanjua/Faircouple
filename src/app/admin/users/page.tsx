import type { Metadata } from 'next';
import { limitOffset, query, queryOne, parseJson } from '@/lib/db';
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
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 25;

  // Filters are assembled as parameterised fragments — no value is interpolated.
  const where: string[] = [];
  const params: unknown[] = [];

  if (searchParams.q) {
    where.push('(email LIKE ? OR full_name LIKE ?)');
    params.push(`%${searchParams.q}%`, `%${searchParams.q}%`);
  }
  if (searchParams.role) {
    where.push('role = ?');
    params.push(searchParams.role);
  }
  if (searchParams.status) {
    where.push('status = ?');
    params.push(searchParams.status);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [userRows, totalRow, plans] = await Promise.all([
    query<any>(
      `SELECT * FROM profiles ${clause} ORDER BY created_at DESC ${limitOffset(
        pageSize,
        (page - 1) * pageSize
      )}`,
      params
    ),
    queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM profiles ${clause}`, params),
    query<any>(`SELECT id, name FROM plans WHERE is_active = 1 ORDER BY sort_order ASC`),
  ]);

  const count = Number(totalRow?.total ?? 0);

  const users = userRows.map((user) => ({
    ...user,
    notification_prefs: parseJson<Record<string, boolean>>(user.notification_prefs, {}),
  }));

  const subscriptions = users.length
    ? await query<any>(
        `SELECT s.user_id, p.name AS plan_name
           FROM subscriptions s
           LEFT JOIN plans p ON p.id = s.plan_id
          WHERE s.status IN ('active','trialing')
            AND s.user_id IN (${users.map(() => '?').join(',')})`,
        users.map((user) => user.id)
      )
    : [];

  const planByUser = new Map<string, string>();
  for (const subscription of subscriptions) {
    planByUser.set(subscription.user_id, subscription.plan_name ?? 'Paid');
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {count} accounts. Change roles, suspend abusive accounts, grant plans or delete a
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
        users={users}
        plans={plans}
        planByUser={Object.fromEntries(planByUser)}
        myId={me!.id}
        myRole={me!.profile.role}
        page={page}
        pageSize={pageSize}
        total={count}
      />
    </div>
  );
}
