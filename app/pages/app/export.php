<?php
declare(strict_types=1);

/** GDPR data portability — everything this member has entered, as JSON. */

$user = Auth::require();
$context = Auth::couple();
$coupleId = $context['couple']['id'] ?? null;

$forCouple = static function (string $table) use ($coupleId): array {
    return $coupleId ? Db::all("SELECT * FROM {$table} WHERE couple_id = ?", [$coupleId]) : [];
};

$profile = $user;
unset($profile['login_verified_at'], $profile['disabled_at']);

$export = [
    'exported_at'      => Str::now(),
    'site'             => Config::siteUrl(),
    'profile'          => $profile,
    'couple'           => $context['couple'] ?? null,
    'emotion_logs'     => Db::all('SELECT * FROM emotion_logs WHERE user_id = ?', [$user['id']]),
    'fairness_entries' => Db::all('SELECT * FROM fairness_entries WHERE user_id = ?', [$user['id']]),
    'daily_checkins'   => Db::all('SELECT * FROM daily_checkins WHERE user_id = ?', [$user['id']]),
    'assessments'      => Db::all('SELECT * FROM assessments WHERE user_id = ?', [$user['id']]),
    'subscriptions'    => Db::all('SELECT * FROM subscriptions WHERE user_id = ?', [$user['id']]),
    'payments'         => Db::all('SELECT * FROM payments WHERE user_id = ?', [$user['id']]),
    'expenses'         => $forCouple('expenses'),
    'gifts'            => $forCouple('gifts'),
    'trips'            => $forCouple('trips'),
    'travel_documents' => $forCouple('travel_documents'),
    'checklists'       => $forCouple('checklists'),
];

Audit::record('account.export', 'profile', $user['id'], 'Downloaded a data export');

Response::download(
    (string) json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    'faircouples-export-' . date('Y-m-d') . '.json',
    'application/json; charset=utf-8'
);
