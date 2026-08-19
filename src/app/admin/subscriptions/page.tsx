import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { adminUpdateSubscriptionAction } from '@/app/actions/admin';
import { AdminForm } from '@/components/admin/form-shell';
import { Badge, Card, Field, Input, Select, Stat, Table, Td, Th } from '@/components/ui';
import { formatMoney } from '@/lib/currency';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Subscriptions', noIndex: true });
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const select = `SELECT s.*, p.name AS plan_name, p.slug AS plan_slug,
                         pr.email AS member_email, pr.full_name AS member_name
                    FROM subscriptions s
                    LEFT JOIN plans p ON p.id = s.plan_id
                    LEFT JOIN profiles pr ON pr.id = s.user_id`;

  const [subscriptions, rows] = await Promise.all([
    searchParams.status
      ? query<any>(`${select} WHERE s.status = ? ORDER BY s.created_at DESC LIMIT 100`, [
          searchParams.status,
        ])
      : query<any>(`${select} ORDER BY s.created_at DESC LIMIT 100`),
    query<any>(`SELECT status, amount_cents, billing_interval, currency FROM subscriptions`),
  ]);

  const active = rows.filter((row) => ['active', 'trialing'].includes(row.status));
  const mrr = active.reduce((sum, row) => {
    const amount = Number(row.amount_cents ?? 0);
    if (row.billing_interval === 'year') return sum + Math.round(amount / 12);
    if (row.billing_interval === 'lifetime') return sum;
    return sum + amount;
  }, 0);

  const churned = rows.filter((row) => ['canceled', 'expired'].includes(row.status)).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every subscription across Stripe, PayPal and manual grants.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active" value={active.length} />
        <Stat label="Trialing" value={rows.filter((row) => row.status === 'trialing').length} />
        <Stat label="Cancelled / expired" value={churned} />
        <Stat label="Estimated MRR" value={formatMoney(mrr, 'USD', { showDecimals: false })} />
      </div>

      <Card className="p-4">
        <form method="get" className="flex flex-wrap gap-3">
          <select
            name="status"
            defaultValue={searchParams.status ?? ''}
            aria-label="Filter by status"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            {['active', 'trialing', 'past_due', 'canceled', 'expired', 'incomplete', 'paused'].map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              )
            )}
          </select>
          <button
            type="submit"
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Filter
          </button>
        </form>
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Plan</Th>
            <Th>Provider</Th>
            <Th>Status</Th>
            <Th>Renews</Th>
            <Th className="text-right">Amount</Th>
            <Th>Manage</Th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((subscription) => (
            <tr key={subscription.id}>
              <Td>
                <span className="font-medium">{subscription.member_name ?? '—'}</span>
                <span className="block text-xs text-muted-foreground">
                  {subscription.member_email}
                </span>
              </Td>
              <Td>{subscription.plan_name ?? '—'}</Td>
              <Td className="capitalize text-muted-foreground">{subscription.provider}</Td>
              <Td>
                <Badge
                  tone={
                    ['active', 'trialing'].includes(subscription.status)
                      ? 'success'
                      : subscription.status === 'past_due'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {subscription.status}
                </Badge>
                {subscription.cancel_at_period_end && (
                  <Badge tone="warning" className="ml-1">
                    ending
                  </Badge>
                )}
              </Td>
              <Td className="text-muted-foreground">
                {formatDate(subscription.current_period_end)}
              </Td>
              <Td className="text-right font-medium tabular-nums">
                {formatMoney(subscription.amount_cents, subscription.currency)}
                <span className="block text-xs font-normal text-muted-foreground">
                  /{subscription.billing_interval}
                </span>
              </Td>
              <Td>
                <details>
                  <summary className="cursor-pointer text-sm text-primary">Edit</summary>
                  <AdminForm
                    action={adminUpdateSubscriptionAction}
                    className="mt-3 w-64"
                    submitLabel="Update"
                  >
                    <input type="hidden" name="id" value={subscription.id} />
                    <Field label="Status" htmlFor={`status-${subscription.id}`}>
                      <Select
                        id={`status-${subscription.id}`}
                        name="status"
                        defaultValue={subscription.status}
                      >
                        {[
                          'active',
                          'trialing',
                          'past_due',
                          'canceled',
                          'expired',
                          'paused',
                          'incomplete',
                        ].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="Period end"
                      htmlFor={`period-${subscription.id}`}
                      className="mt-3"
                    >
                      <Input
                        id={`period-${subscription.id}`}
                        name="current_period_end"
                        type="date"
                        defaultValue={
                          subscription.current_period_end
                            ? String(subscription.current_period_end).slice(0, 10)
                            : ''
                        }
                      />
                    </Field>
                    <Field label="Note" htmlFor={`notes-${subscription.id}`} className="mt-3">
                      <Input
                        id={`notes-${subscription.id}`}
                        name="notes"
                        defaultValue={subscription.notes ?? ''}
                      />
                    </Field>
                  </AdminForm>
                </details>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
