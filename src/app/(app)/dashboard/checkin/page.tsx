import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { CheckinForm } from '@/components/app/checkin-form';
import { Card, EmptyState, Badge } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Daily check-in', path: '/dashboard/checkin', noIndex: true });
}

export default async function CheckinPage() {
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="📅"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = createClient();

  const [{ data: todayRows }, { data: history }] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select('*')
      .eq('couple_id', context.couple.id)
      .eq('checkin_date', today),
    supabase
      .from('daily_checkins')
      .select('*')
      .eq('couple_id', context.couple.id)
      .order('checkin_date', { ascending: false })
      .limit(30),
  ]);

  const mine = (todayRows ?? []).find((row: any) => row.user_id === context.me.user_id);
  const theirs = (todayRows ?? []).find((row: any) => row.user_id !== context.me.user_id);
  const partnerName = context.partner?.profile?.full_name ?? 'Your partner';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Daily check-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two minutes a day. Small, consistent contact beats rare big talks.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <CheckinForm date={today} existing={mine ?? null} />

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-semibold">{partnerName} today</h2>
            {theirs ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Their day</dt>
                  <dd className="font-semibold tabular-nums">{theirs.day_rating}/10</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Connection with you</dt>
                  <dd className="font-semibold tabular-nums">{theirs.connection}/10</dd>
                </div>
                {theirs.gratitude && (
                  <div>
                    <dt className="text-muted-foreground">Grateful for</dt>
                    <dd className="mt-1">{theirs.gratitude}</dd>
                  </div>
                )}
                {theirs.highlight && (
                  <div>
                    <dt className="text-muted-foreground">Highlight</dt>
                    <dd className="mt-1">{theirs.highlight}</dd>
                  </div>
                )}
                {theirs.challenge && (
                  <div>
                    <dt className="text-muted-foreground">Hard part</dt>
                    <dd className="mt-1">{theirs.challenge}</dd>
                  </div>
                )}
                {theirs.need_from_partner && (
                  <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3">
                    <dt className="font-medium">What they need from you</dt>
                    <dd className="mt-1">{theirs.need_from_partner}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {context.partner
                  ? 'They have not checked in yet today.'
                  : 'Invite your partner so their check-in appears here.'}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Last 30 days</h2>
            {history && history.length > 0 ? (
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
                {history.map((row: any) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                    <span className="text-muted-foreground">{formatDate(row.checkin_date)}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={row.user_id === context.me.user_id ? 'primary' : 'info'}>
                        {row.user_id === context.me.user_id ? 'You' : partnerName.split(' ')[0]}
                      </Badge>
                      <span className="font-semibold tabular-nums">{row.day_rating}/10</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No check-ins recorded yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
