<?php
declare(strict_types=1);

/**
 * Scheduled jobs.
 *
 * In hPanel -> Advanced -> Cron Jobs, add a daily job:
 *   curl -s "https://your-domain/cron.php?key=YOUR_CRON_SECRET&job=all"
 *
 * Jobs:
 *   trip-reminders  emails both partners 14, 7 and 1 days before departure
 *   weekly-reports  Monday fairness report to both partners
 *   expire-invites  marks stale invitations expired
 *   purge-tokens    clears expired sessions and one-time links
 */

require __DIR__ . '/app/bootstrap.php';

$secret = (string) Config::get('cron_secret', '');
$key = (string) ($_GET['key'] ?? '');

if ($secret === '' || $secret === 'CHANGE-THIS-TOO') {
    Response::json(['error' => 'Set cron_secret in app/config.php first.'], 503);
}

if (!hash_equals($secret, $key)) {
    Response::json(['error' => 'Unauthorised.'], 401);
}

set_time_limit(300);

$job = (string) ($_GET['job'] ?? 'all');
$results = [];

if ($job === 'all' || $job === 'trip-reminders') {
    $results['trip_reminders'] = sendTripReminders();
}
if ($job === 'all' || $job === 'weekly-reports') {
    $results['weekly_reports'] = sendWeeklyReports();
}
if ($job === 'all' || $job === 'expire-invites') {
    $results['expired_invites'] = expireInvitations();
}
if ($job === 'all' || $job === 'purge-tokens') {
    $results['purged'] = purgeTokens();
}

Response::json(['ok' => true, 'ran_at' => Str::now(), 'results' => $results]);

/* ---------------------------------------------------------------------- Jobs */

function sendTripReminders(): int
{
    $sent = 0;

    foreach ([14, 7, 1] as $daysAhead) {
        $target = date('Y-m-d', strtotime("+{$daysAhead} days"));

        $trips = Db::all(
            'SELECT t.id, t.title, t.couple_id, d.name AS destination_name
               FROM trips t
               LEFT JOIN destinations d ON d.id = t.destination_id
              WHERE t.start_date = ? AND t.status IN ("planning","booked")',
            [$target]
        );

        foreach ($trips as $trip) {
            $members = Db::all(
                'SELECT m.user_id, p.email, p.full_name, p.notification_prefs
                   FROM couple_members m
                   JOIN profiles p ON p.id = m.user_id
                  WHERE m.couple_id = ? AND m.removed_at IS NULL',
                [$trip['couple_id']]
            );

            foreach ($members as $member) {
                $prefs = Str::json($member['notification_prefs'], ['email' => true]);
                if (($prefs['email'] ?? true) === false || !$member['email']) {
                    continue;
                }

                Mailer::template('trip-reminder', $member['email'], [
                    'name'          => $member['full_name'] ?: 'there',
                    'destination'   => $trip['destination_name'] ?: $trip['title'],
                    'days'          => (string) $daysAhead,
                    'checklist_url' => Config::siteUrl('/dashboard/travel/' . $trip['id']),
                ], $member['user_id']);

                $sent++;
            }
        }
    }

    return $sent;
}

function sendWeeklyReports(): int
{
    $period = Str::weekStart(date('Y-m-d', strtotime('-7 days')));
    $sent = 0;

    $reports = Db::all(
        'SELECT couple_id, balance_index, overall_score, verdict
           FROM fairness_reports
          WHERE period = ? AND period_type = "week"',
        [$period]
    );

    foreach ($reports as $report) {
        $members = Db::all(
            'SELECT m.user_id, p.email, p.full_name, p.notification_prefs
               FROM couple_members m
               JOIN profiles p ON p.id = m.user_id
              WHERE m.couple_id = ? AND m.removed_at IS NULL',
            [$report['couple_id']]
        );

        foreach ($members as $member) {
            $prefs = Str::json($member['notification_prefs'], ['weekly_report' => true]);
            if (($prefs['weekly_report'] ?? true) === false || !$member['email']) {
                continue;
            }

            $partner = null;
            foreach ($members as $other) {
                if ($other['user_id'] !== $member['user_id']) {
                    $partner = $other;
                    break;
                }
            }

            Mailer::template('weekly-report', $member['email'], [
                'name'          => $member['full_name'] ?: 'there',
                'partner_name'  => $partner['full_name'] ?? 'your partner',
                'balance_index' => (string) (int) round((float) $report['balance_index']),
                'overall_score' => (string) (int) round((float) $report['overall_score']),
                'verdict'       => (string) $report['verdict'],
                'report_url'    => Config::siteUrl('/dashboard/fairness'),
            ], $member['user_id']);

            $sent++;
        }
    }

    return $sent;
}

function expireInvitations(): int
{
    $result = Db::run(
        'UPDATE couple_invitations SET status = "expired"
          WHERE status = "pending" AND expires_at < UTC_TIMESTAMP()'
    );
    return $result['rows'];
}

function purgeTokens(): int
{
    $sessions = Db::run('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()');
    $tokens = Db::run('DELETE FROM auth_tokens WHERE expires_at < UTC_TIMESTAMP()');
    $notifications = Db::run(
        'DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)'
    );

    return $sessions['rows'] + $tokens['rows'] + $notifications['rows'];
}
