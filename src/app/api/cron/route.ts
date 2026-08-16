import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { SITE_URL } from '@/lib/seo';
import { weekStart } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Scheduled jobs. Call daily from Vercel Cron, GitHub Actions or a Hostinger
 * cron job:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron?job=all
 *
 * Jobs:
 *   trip-reminders  — emails both partners 14/7/1 days before departure
 *   weekly-reports  — emails the fairness report every Monday
 *   expire-invites  — marks stale invitations as expired
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');

  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const job = request.nextUrl.searchParams.get('job') ?? 'all';
  const results: Record<string, unknown> = {};

  if (job === 'all' || job === 'trip-reminders') {
    results.tripReminders = await sendTripReminders();
  }
  if (job === 'all' || job === 'weekly-reports') {
    results.weeklyReports = await sendWeeklyReports();
  }
  if (job === 'all' || job === 'expire-invites') {
    results.expiredInvites = await expireInvitations();
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}

async function sendTripReminders() {
  const supabase = createAdminClient();
  const today = new Date();
  const targets = [14, 7, 1].map((days) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return { days, iso: date.toISOString().slice(0, 10) };
  });

  let sent = 0;

  for (const target of targets) {
    const { data: trips } = await supabase
      .from('trips')
      .select('id, title, start_date, couple_id, destination:destinations(name)')
      .eq('start_date', target.iso)
      .in('status', ['planning', 'booked']);

    for (const trip of (trips ?? []) as any[]) {
      const { data: members } = await supabase
        .from('couple_members')
        .select('user_id, profile:profiles(email, full_name, notification_prefs)')
        .eq('couple_id', trip.couple_id)
        .is('removed_at', null);

      for (const member of (members ?? []) as any[]) {
        const email = member.profile?.email;
        if (!email) continue;
        if (member.profile?.notification_prefs?.email === false) continue;

        await sendEmail({
          to: email,
          template: 'trip-reminder',
          variables: {
            name: member.profile?.full_name ?? 'there',
            destination: trip.destination?.name ?? trip.title,
            days: target.days,
            checklist_url: `${SITE_URL}/dashboard/travel/${trip.id}`,
          },
          userId: member.user_id,
        });
        sent += 1;
      }
    }
  }

  return { sent };
}

async function sendWeeklyReports() {
  const supabase = createAdminClient();
  const period = weekStart(new Date(Date.now() - 7 * 86400000));

  const { data: reports } = await supabase
    .from('fairness_reports')
    .select('couple_id, balance_index, overall_score, verdict')
    .eq('period', period)
    .eq('period_type', 'week');

  let sent = 0;

  for (const report of (reports ?? []) as any[]) {
    const { data: members } = await supabase
      .from('couple_members')
      .select('user_id, profile:profiles(email, full_name, notification_prefs)')
      .eq('couple_id', report.couple_id)
      .is('removed_at', null);

    const list = (members ?? []) as any[];

    for (const member of list) {
      const email = member.profile?.email;
      if (!email) continue;
      if (member.profile?.notification_prefs?.weekly_report === false) continue;

      const partner = list.find((other) => other.user_id !== member.user_id);

      await sendEmail({
        to: email,
        template: 'weekly-report',
        variables: {
          name: member.profile?.full_name ?? 'there',
          partner_name: partner?.profile?.full_name ?? 'your partner',
          balance_index: Math.round(Number(report.balance_index ?? 0)),
          overall_score: Math.round(Number(report.overall_score ?? 0)),
          verdict: report.verdict ?? '',
          report_url: `${SITE_URL}/dashboard/fairness`,
        },
        userId: member.user_id,
      });
      sent += 1;
    }
  }

  return { period, sent };
}

async function expireInvitations() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('couple_invitations')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  return { expired: (data ?? []).length };
}
