import type { Metadata } from 'next';
import Link from 'next/link';
import { query } from '@/lib/db';
import { getFairnessCategories } from '@/lib/queries';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { buildReport, trendSeries } from '@/lib/fairness';
import { weekStart, addWeeks, formatDate } from '@/lib/utils';
import { FairnessWorkspace } from '@/components/app/fairness/fairness-workspace';
import { Alert, Card, EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import type { FairnessCategory, FairnessEntry } from '@/types';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Fairness', path: '/dashboard/fairness', noIndex: true });
}

export default async function FairnessPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  const entitlements = await getEntitlements();

  if (!context) {
    return (
      <EmptyState
        icon="⚖️"
        title="Create your relationship space first"
        description="Fairness scoring compares two people. Set up your space, then invite the other person."
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const period = searchParams.period ?? weekStart();
  const coupleId = context.couple.id;
  const historyStart = addWeeks(period, -11);

  const [categoryList, entryList, history, responses] = await Promise.all([
    getFairnessCategories(),
    query<FairnessEntry>(`SELECT * FROM fairness_entries WHERE couple_id = ? AND period = ?`, [
      coupleId,
      period,
    ]),
    query<FairnessEntry>(
      `SELECT * FROM fairness_entries WHERE couple_id = ? AND period BETWEEN ? AND ?`,
      [coupleId, historyStart, period]
    ),
    query<any>(
      `SELECT r.*, e.user_id, e.category_id
         FROM fairness_criteria_responses r
         JOIN fairness_entries e ON e.id = r.entry_id
        WHERE e.couple_id = ? AND e.period = ?`,
      [coupleId, period]
    ),
  ]);

  const report = buildReport({
    period,
    categories: categoryList,
    entries: entryList,
    memberA: {
      userId: context.me.user_id,
      name: context.me.profile?.full_name ?? user?.profile.full_name ?? 'You',
    },
    memberB: context.partner
      ? {
          userId: context.partner.user_id,
          name: context.partner.profile?.full_name ?? 'Partner',
        }
      : null,
  });

  const trend = trendSeries(
    history,
    context.me.user_id,
    context.partner?.user_id ?? null
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Fairness</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Week of {formatDate(period)} · you answer for yourself, your partner answers for
            themselves.
          </p>
        </div>
        <nav className="flex gap-2 text-sm" aria-label="Change week">
          <Link
            href={`/dashboard/fairness?period=${addWeeks(period, -1)}`}
            className="rounded-lg border border-border px-3 py-2 hover:bg-secondary"
          >
            ← Previous
          </Link>
          {period !== weekStart() && (
            <Link
              href="/dashboard/fairness"
              className="rounded-lg border border-border px-3 py-2 hover:bg-secondary"
            >
              This week
            </Link>
          )}
          <Link
            href={`/dashboard/fairness?period=${addWeeks(period, 1)}`}
            className="rounded-lg border border-border px-3 py-2 hover:bg-secondary"
          >
            Next →
          </Link>
        </nav>
      </header>

      {!context.partner && (
        <Alert tone="warning" title="You are the only member of this space">
          Your entries are being saved, but the balance index needs both sides.{' '}
          <Link href="/dashboard/partner" className="font-medium underline">
            Invite your partner
          </Link>
          .
        </Alert>
      )}

      {!entitlements.limits.advanced_reports && (
        <Card className="border-primary/30 bg-primary/5 p-4 text-sm">
          <strong>Free plan:</strong> you can see this week&apos;s balance index. Trends, category
          analytics and exports are on Essential and above.{' '}
          <Link href="/pricing" className="font-medium text-primary underline">
            Compare plans
          </Link>
        </Card>
      )}

      <FairnessWorkspace
        period={period}
        categories={categoryList}
        entries={entryList}
        responses={responses}
        report={report}
        trend={trend}
        meId={context.me.user_id}
        partnerId={context.partner?.user_id ?? null}
        meName={context.me.profile?.full_name ?? 'You'}
        partnerName={context.partner?.profile?.full_name ?? 'Your partner'}
        canSeeAdvanced={entitlements.limits.advanced_reports}
      />
    </div>
  );
}
