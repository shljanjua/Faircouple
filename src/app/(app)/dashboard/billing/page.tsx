import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, getEntitlements } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { Alert, Badge, Card, Progress, Table, Td, Th } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { CancelSubscription } from '@/components/app/cancel-subscription';
import { formatMoney } from '@/lib/currency';
import { formatDate } from '@/lib/utils';
import { LIMIT_LABELS, formatLimit } from '@/lib/plans';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Billing', path: '/dashboard/billing', noIndex: true });
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string; message?: string };
}) {
  const user = await getSessionUser();
  const entitlements = await getEntitlements();
  const supabase = createClient();

  const [{ data: subscriptions }, { data: payments }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('*, plan:plans(name, slug, tagline)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(24),
  ]);

  const active = ((subscriptions ?? []) as any[]).find((subscription) =>
    ['active', 'trialing', 'past_due'].includes(subscription.status)
  );

  const limitKeys = Object.keys(LIMIT_LABELS) as (keyof typeof LIMIT_LABELS)[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One subscription covers both partners in your space.
        </p>
      </header>

      {searchParams.checkout === 'success' && (
        <Alert tone="success" title="Payment received">
          Your plan is active. If the status below still says pending, refresh in a few seconds —
          the payment webhook is finishing up.
        </Alert>
      )}
      {searchParams.checkout === 'failed' && (
        <Alert tone="danger" title="Payment could not be completed">
          {searchParams.message ?? 'Please try again or use a different payment method.'}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Current plan</h2>
              <p className="mt-1 text-2xl font-bold">{entitlements.planName}</p>
            </div>
            <Badge tone={entitlements.isPaid ? 'success' : 'outline'}>
              {active?.status ?? (entitlements.isPaid ? 'active' : 'free')}
            </Badge>
          </div>

          {active ? (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Price</dt>
                <dd className="font-medium">
                  {formatMoney(active.amount_cents, active.currency)} / {active.interval}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Provider</dt>
                <dd className="font-medium capitalize">{active.provider}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {active.cancel_at_period_end ? 'Access ends' : 'Renews'}
                </dt>
                <dd className="font-medium">{formatDate(active.current_period_end)}</dd>
              </div>
              {active.trial_ends_at && (
                <div>
                  <dt className="text-xs text-muted-foreground">Trial ends</dt>
                  <dd className="font-medium">{formatDate(active.trial_ends_at)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              You are on the free Starter plan. Upgrade for unlimited history, full fairness
              analytics and the itinerary generator.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/pricing" variant={entitlements.isPaid ? 'outline' : 'primary'}>
              {entitlements.isPaid ? 'Change plan' : 'Upgrade'}
            </ButtonLink>
            {active && !active.cancel_at_period_end && active.interval !== 'lifetime' && (
              <CancelSubscription subscriptionId={active.id} />
            )}
          </div>

          {active?.cancel_at_period_end && (
            <Alert tone="warning" className="mt-4">
              Your subscription is set to end on {formatDate(active.current_period_end)}. You keep
              full access until then.
            </Alert>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">What your plan includes</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            {limitKeys.map((key) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{LIMIT_LABELS[key]}</dt>
                <dd className="shrink-0 font-medium">{formatLimit(entitlements.limits[key])}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Payment history</h2>
        {payments && payments.length > 0 ? (
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Method</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {payments.map((payment: any) => (
                  <tr key={payment.id}>
                    <Td className="text-muted-foreground">{formatDate(payment.created_at)}</Td>
                    <Td>{payment.description ?? '—'}</Td>
                    <Td className="capitalize text-muted-foreground">{payment.provider}</Td>
                    <Td>
                      <Badge
                        tone={
                          payment.status === 'succeeded'
                            ? 'success'
                            : payment.status === 'failed'
                              ? 'danger'
                              : 'outline'
                        }
                      >
                        {payment.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatMoney(payment.amount_cents, payment.currency)}
                    </Td>
                    <Td className="text-right">
                      {payment.invoice_url && (
                        <a
                          href={payment.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary underline"
                        >
                          Invoice
                        </a>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No payments yet.</p>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Questions about a charge?{' '}
        <Link href="/contact" className="underline">
          Contact support
        </Link>{' '}
        — 14-day money-back guarantee on first purchases.
      </p>
    </div>
  );
}
