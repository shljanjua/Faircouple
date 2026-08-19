import { NextResponse, type NextRequest } from 'next/server';
import { execute, query, parseJson } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { purgeExpiredAuthRows } from '@/app/actions/auth';
import { SITE_URL } from '@/lib/seo';
import { weekStart } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Scheduled jobs. Call daily from a Hostinger cron job, GitHub Actions or any
 * scheduler:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron?job=all
 *
 * Jobs:
 *   trip-reminders  — emails both partners 14/7/1 days before departure
 *   weekly-reports  — emails the fairness report every Monday
 *   expire-invites  — marks stale invitations as expired
 *   purge-tokens    — clears expired sessions and one-time auth tokens
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
  if (job === 'all' || job === 'purge-tokens') {
    await purgeExpiredAuthRows();
    results.purgedTokens = true;
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}

interface MemberRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  notification_prefs: unknown;
}

function wantsEmail(member: MemberRow, key: 'email' | 'weekly_report') {
  const prefs = parseJson<Record<string, boolean>>(member.notification_prefs, {});
  return prefs[key] !== false;
}

async function membersOf(coupleId: string) {
  return query<MemberRow>(
    `SELECT m.user_id, p.email, p.full_name, p.notification_prefs
       FROM couple_members m
       JOIN profiles p ON p.id = m.user_id
      WHERE m.couple_id = ? AND m.removed_at IS NULL AND p.deleted_at IS NULL`,
    [coupleId]
  );
}

async function sendTripReminders() {
  const today = new Date();
  const targets = [14, 7, 1].map((days) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return { days, iso: date.toISOString().slice(0, 10) };
  });

  let sent = 0;

  for (const target of targets) {
    const trips = await query<any>(
      `SELECT t.id, t.title, t.couple_id, d.name AS destination_name
         FROM trips t
         LEFT JOIN destinations d ON d.id = t.destination_id
        WHERE t.start_date = ? AND t.status IN ('planning','booked')`,
      [target.iso]
    );

    for (const trip of trips) {
      for (const member of await membersOf(trip.couple_id)) {
        if (!member.email || !wantsEmail(member, 'email')) continue;

        await sendEmail({
          to: member.email,
          template: 'trip-reminder',
          variables: {
            name: member.full_name ?? 'there',
            destination: trip.destination_name ?? trip.title,
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
  const period = weekStart(new Date(Date.now() - 7 * 86400000));

  const reports = await query<any>(
    `SELECT couple_id, balance_index, overall_score, verdict
       FROM fairness_reports WHERE period = ? AND period_type = 'week'`,
    [period]
  );

  let sent = 0;

  for (const report of reports) {
    const members = await membersOf(report.couple_id);

    for (const member of members) {
      if (!member.email || !wantsEmail(member, 'weekly_report')) continue;

      const partner = members.find((other) => other.user_id !== member.user_id);

      await sendEmail({
        to: member.email,
        template: 'weekly-report',
        variables: {
          name: member.full_name ?? 'there',
          partner_name: partner?.full_name ?? 'your partner',
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
  const result = await execute(
    `UPDATE couple_invitations SET status = 'expired'
      WHERE status = 'pending' AND expires_at < NOW()`
  );

  return { expired: result.affectedRows ?? 0 };
}
