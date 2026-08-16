import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  Heart,
  ListChecks,
  MessageCircle,
  Plane,
  Scale,
  Ticket,
  Wallet,
} from 'lucide-react';
import { query, toBool } from '@/lib/db';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { buildReport } from '@/lib/fairness';
import { weekStart, addWeeks, formatDate, timeAgo } from '@/lib/utils';
import { formatMoney } from '@/lib/currency';
import { Alert, Badge, Card, EmptyState, Progress, Stat } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { RISK_META } from '@/lib/fairness';
import type { FairnessCategory, FairnessEntry } from '@/types';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Dashboard', path: '/dashboard', noIndex: true });
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  const entitlements = await getEntitlements();

  if (!context) {
    return (
      <EmptyState
        icon="💗"
        title="Set up your relationship space"
        description="One space holds two people. Create yours, then invite the other person — you each answer for yourself."
        action={<ButtonLink href="/onboarding">Get started</ButtonLink>}
      />
    );
  }

  const coupleId = context.couple.id;
  const period = weekStart();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [
    categories,
    entries,
    emotions,
    checkins,
    trips,
    expenses,
    unreadMessages,
    checklists,
    documents,
    notifications,
  ] = await Promise.all([
    query<any>(`SELECT * FROM fairness_categories WHERE is_active = 1 ORDER BY sort_order ASC`),
    query<any>(`SELECT * FROM fairness_entries WHERE couple_id = ? AND period = ?`, [coupleId, period]),
    query<any>(
      `SELECT * FROM emotion_logs WHERE couple_id = ? AND logged_at >= ?
        ORDER BY logged_at DESC LIMIT 8`,
      [coupleId, addWeeks(period, -1)]
    ),
    query<any>(`SELECT * FROM daily_checkins WHERE couple_id = ? AND checkin_date = ?`, [
      coupleId,
      today,
    ]),
    query<any>(
      `SELECT t.id, t.title, t.start_date, t.end_date, t.status, t.cover_image, d.name AS destination_name
         FROM trips t LEFT JOIN destinations d ON d.id = t.destination_id
        WHERE t.couple_id = ? AND t.status IN ('planning','booked','ongoing')
        ORDER BY t.start_date ASC LIMIT 3`,
      [coupleId]
    ),
    query<any>(
      `SELECT amount_cents, currency, paid_by, spent_on FROM expenses WHERE couple_id = ? AND spent_on >= ?`,
      [coupleId, monthStart]
    ),
    query<any>(
      `SELECT id FROM messages WHERE couple_id = ? AND sender_id <> ? AND read_at IS NULL AND deleted_at IS NULL LIMIT 50`,
      [coupleId, context.me.user_id]
    ),
    query<any>(
      `SELECT c.id, c.title, c.emoji,
              COUNT(i.id) AS total_items,
              SUM(CASE WHEN i.is_done = 1 THEN 1 ELSE 0 END) AS done_items
         FROM checklists c
         LEFT JOIN checklist_items i ON i.checklist_id = c.id
        WHERE c.couple_id = ? AND c.archived_at IS NULL
        GROUP BY c.id, c.title, c.emoji
        LIMIT 4`,
      [coupleId]
    ),
    query<any>(
      `SELECT id, title, doc_type, depart_at, provider FROM travel_documents
        WHERE couple_id = ? AND depart_at >= NOW() ORDER BY depart_at ASC LIMIT 3`,
      [coupleId]
    ),
    query<any>(
      `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 5`,
      [context.me.user_id]
    ),
  ]);

  const report = buildReport({
    period,
    categories: categories as FairnessCategory[],
    entries: entries as FairnessEntry[],
    memberA: {
      userId: context.me.user_id,
      name: context.me.profile?.full_name ?? user?.profile.full_name ?? 'You',
    },
    memberB: context.partner
      ? { userId: context.partner.user_id, name: context.partner.profile?.full_name ?? 'Partner' }
      : null,
  });

  const risk = RISK_META[report.riskLevel];
  const myCheckin = checkins.find((c: any) => c.user_id === context.me.user_id);
  const partnerCheckin = checkins.find((c: any) => c.user_id !== context.me.user_id);

  const monthSpend = expenses.reduce(
    (sum: number, expense: any) => sum + Number(expense.amount_cents ?? 0),
    0
  );
  const myEntriesCount = entries.filter((e: any) => e.user_id === context.me.user_id).length;
  const totalCategories = categories.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">
          Hello {user?.profile.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Week of {formatDate(period)}
          {context.partner
            ? ` · with ${context.partner.profile?.full_name ?? 'your partner'}`
            : ' · nobody else has joined yet'}
        </p>
      </header>

      {!context.partner && (
        <Alert tone="warning" title="Your space is waiting for the second person">
          Fairness compares two independent sets of answers.{' '}
          <Link href="/dashboard/partner" className="font-medium underline">
            Invite them now
          </Link>
          .
        </Alert>
      )}

      {notifications.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">New for you</h2>
          <ul className="mt-3 space-y-2">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex items-start gap-3 text-sm">
                <span aria-hidden>{notification.emoji ?? '🔔'}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{notification.title}</span>
                  {notification.body && (
                    <span className="block text-muted-foreground">{notification.body}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(notification.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Balance index"
          value={report.balanceIndex}
          hint="100 = perfectly even effort"
          icon={<Scale className="h-5 w-5" aria-hidden />}
        />
        <Stat
          label="Fairness score"
          value={report.overallScore}
          hint={risk.label}
          tone={risk.className}
          icon={<Heart className="h-5 w-5" aria-hidden />}
        />
        <Stat
          label="This month's spend"
          value={formatMoney(monthSpend, context.couple.currency, { showDecimals: false })}
          hint="Shared expenses logged"
          icon={<Wallet className="h-5 w-5" aria-hidden />}
        />
        <Stat
          label="Unread messages"
          value={unreadMessages.length}
          hint="From your partner"
          icon={<MessageCircle className="h-5 w-5" aria-hidden />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">This week&apos;s fairness</h2>
              <p className="mt-1 text-sm text-muted-foreground">{report.verdict}</p>
            </div>
            <Badge tone={report.riskLevel === 'healthy' ? 'success' : report.riskLevel === 'critical' ? 'danger' : 'warning'}>
              {risk.label}
            </Badge>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span>Your entries completed</span>
                <span className="tabular-nums text-muted-foreground">
                  {myEntriesCount}/{totalCategories}
                </span>
              </div>
              <Progress
                value={totalCategories ? (myEntriesCount / totalCategories) * 100 : 0}
                className="mt-1.5"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span>Both sides completed</span>
                <span className="tabular-nums text-muted-foreground">{report.completeness}%</span>
              </div>
              <Progress value={report.completeness} className="mt-1.5" barClassName="bg-emerald-500" />
            </div>
          </div>

          <ButtonLink href="/dashboard/fairness" className="mt-5">
            {myEntriesCount ? 'Continue this week' : 'Start this week'}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Today&apos;s check-in</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>You</span>
              {myCheckin ? (
                <Badge tone="success">Done · {myCheckin.day_rating}/10</Badge>
              ) : (
                <Badge tone="outline">Not yet</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>{context.partner?.profile?.full_name ?? 'Partner'}</span>
              {partnerCheckin ? (
                <Badge tone="success">Done · {partnerCheckin.day_rating}/10</Badge>
              ) : (
                <Badge tone="outline">Not yet</Badge>
              )}
            </div>
          </div>
          <ButtonLink href="/dashboard/checkin" variant="outline" className="mt-5 w-full">
            <CalendarCheck className="h-4 w-4" aria-hidden />
            {myCheckin ? 'Update my check-in' : 'Do my check-in'}
          </ButtonLink>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="font-semibold">Recent emotions</h2>
          {emotions.length > 0 ? (
            <ul className="mt-4 space-y-2.5">
              {emotions.slice(0, 6).map((emotion) => (
                <li key={emotion.id} className="flex items-center gap-3 text-sm">
                  <span className="text-lg" aria-hidden>
                    {emotion.scope === 'partner' ? '💞' : emotion.scope === 'relationship' ? '🤝' : '🙂'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium capitalize">
                      {String(emotion.emotion_slug).replace(/-/g, ' ')}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {emotion.user_id === context.me.user_id ? 'you' : 'partner'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(emotion.logged_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Nothing logged in the last week.</p>
          )}
          <ButtonLink href="/dashboard/emotions" variant="outline" className="mt-5 w-full">
            <Heart className="h-4 w-4" aria-hidden />
            Log an emotion
          </ButtonLink>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Checklists</h2>
          {checklists.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {checklists.map((list) => {
                const total = Number(list.total_items ?? 0);
                const done = Number(list.done_items ?? 0);
                return (
                  <li key={list.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        {list.emoji} {list.title}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {done}/{total}
                      </span>
                    </div>
                    <Progress value={total ? (done / total) * 100 : 0} className="mt-1.5 h-1.5" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No checklists yet.</p>
          )}
          <ButtonLink href="/dashboard/checklists" variant="outline" className="mt-5 w-full">
            <ListChecks className="h-4 w-4" aria-hidden />
            Open checklists
          </ButtonLink>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Upcoming travel</h2>
          {trips.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {trips.map((trip) => (
                <li key={trip.id} className="text-sm">
                  <Link href={`/dashboard/travel/${trip.id}`} className="font-medium hover:text-primary">
                    {trip.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {trip.start_date ? formatDate(trip.start_date) : 'Dates to confirm'} ·{' '}
                    <span className="capitalize">{trip.status}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No trips planned yet.</p>
          )}

          {documents.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next bookings
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2">
                    <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{doc.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ButtonLink href="/dashboard/travel" variant="outline" className="mt-5 w-full">
            <Plane className="h-4 w-4" aria-hidden />
            Plan a trip
          </ButtonLink>
        </Card>
      </div>

      {!entitlements.isPaid && (
        <Card className="border-primary/30 bg-gradient-to-br from-rose-500/5 to-fuchsia-500/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">You are on the free Starter plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upgrade for unlimited history, full fairness analytics, the itinerary generator and
                an ad-free experience — one subscription covers both of you.
              </p>
            </div>
            <ButtonLink href="/pricing" className="shrink-0">
              Compare plans
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
