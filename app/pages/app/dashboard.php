<?php
declare(strict_types=1);

$user = Auth::require();
$context = Auth::couple();

if ($context === null) {
    Response::redirect('/onboarding');
}

$coupleId = $context['couple']['id'];
$partner  = $context['partner'];
$period   = Str::weekStart();

$categories = Db::all('SELECT * FROM fairness_categories WHERE is_active = 1 ORDER BY sort_order ASC');
$entries = Db::all('SELECT * FROM fairness_entries WHERE couple_id = ? AND period = ?', [$coupleId, $period]);

$report = Fairness::report(
    $period,
    $categories,
    $entries,
    ['user_id' => $user['id'], 'name' => $user['display_name'] ?: ($user['full_name'] ?: 'You')],
    $partner ? ['user_id' => $partner['user_id'], 'name' => $partner['display_name'] ?: ($partner['full_name'] ?: 'Partner')] : null
);

$risk = Fairness::RISK_META[$report['risk_level']];

$monthStart = date('Y-m-01 00:00:00');
$counts = [
    'emotions'  => Db::count('emotion_logs', 'couple_id = ? AND logged_at >= ?', [$coupleId, $monthStart]),
    'messages'  => Db::count('messages', 'couple_id = ? AND deleted_at IS NULL', [$coupleId]),
    'trips'     => Db::count('trips', 'couple_id = ? AND status <> "cancelled"', [$coupleId]),
    'documents' => Db::count('travel_documents', 'couple_id = ?', [$coupleId]),
];

$recentEmotions = Db::all(
    'SELECT e.*, t.label, t.emoji, p.full_name, p.display_name
       FROM emotion_logs e
       LEFT JOIN emotion_types t ON t.slug = e.emotion_slug
       LEFT JOIN profiles p ON p.id = e.user_id
      WHERE e.couple_id = ? AND (e.is_private = 0 OR e.user_id = ?)
      ORDER BY e.logged_at DESC LIMIT 6',
    [$coupleId, $user['id']]
);

$upcomingTrip = Db::one(
    'SELECT t.*, d.name AS destination_name
       FROM trips t LEFT JOIN destinations d ON d.id = t.destination_id
      WHERE t.couple_id = ? AND t.start_date >= CURDATE() AND t.status <> "cancelled"
      ORDER BY t.start_date ASC LIMIT 1',
    [$coupleId]
);

$myCheckin = Db::one(
    'SELECT * FROM daily_checkins WHERE couple_id = ? AND user_id = ? AND checkin_date = CURDATE() LIMIT 1',
    [$coupleId, $user['id']]
);

$balanceOwed = Db::all(
    'SELECT s.user_id, SUM(s.share_cents) AS owed, SUM(CASE WHEN e.paid_by = s.user_id THEN e.amount_cents ELSE 0 END) AS paid
       FROM expense_shares s
       JOIN expenses e ON e.id = s.expense_id
      WHERE e.couple_id = ? AND e.is_settled = 0
      GROUP BY s.user_id',
    [$coupleId]
);

View::begin('layouts/app', ['title' => 'Dashboard', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Hello, <?= Str::e($user['display_name'] ?: explode(' ', (string) $user['full_name'])[0] ?: 'there') ?></h1>
  <p>
    Week of <?= Str::e(Str::date($period)) ?>
    <?php if ($partner): ?>
      · with <?= Str::e($partner['display_name'] ?: $partner['full_name'] ?: 'your partner') ?>
    <?php endif; ?>
  </p>
</div>

<?php if (!$partner): ?>
  <div class="alert alert-warning mb-2">
    <div>
      <strong>You are the only person in this space.</strong>
      A fairness report needs two sides. <a href="/dashboard/partner">Invite your partner</a> —
      it takes about ten seconds.
    </div>
  </div>
<?php endif; ?>

<div class="grid grid-4">
  <div class="card stat">
    <p class="stat-label">Balance index</p>
    <p class="stat-value tabular"><?= number_format($report['balance_index'], 0) ?><span class="small muted">/100</span></p>
    <?= View::meter($report['balance_index'], 100, $report['balance_index'] >= 80 ? 'success' : ($report['balance_index'] >= 60 ? 'warning' : 'danger')) ?>
  </div>

  <div class="card stat">
    <p class="stat-label">Overall score</p>
    <p class="stat-value tabular"><?= number_format($report['overall_score'], 0) ?><span class="small muted">/100</span></p>
    <p class="stat-hint"><?= (int) $report['completeness'] ?>% of entries done</p>
  </div>

  <div class="card stat">
    <p class="stat-label">This week</p>
    <p class="stat-value tone-<?= Str::e($risk['tone']) ?>" style="font-size:1.5rem"><?= Str::e($risk['label']) ?></p>
    <p class="stat-hint"><?= Str::e($risk['description']) ?></p>
  </div>

  <div class="card stat">
    <p class="stat-label">Effort split</p>
    <p class="stat-value tabular" style="font-size:1.5rem">
      <?= number_format($report['effort_a'], 0) ?> / <?= number_format($report['effort_b'], 0) ?>
    </p>
    <p class="stat-hint">you / partner, out of 100</p>
  </div>
</div>

<div class="card mt-3">
  <div class="card-body">
    <div class="row-between">
      <h2 style="font-size:1.05rem">This week&rsquo;s verdict</h2>
      <a class="btn btn-sm btn-outline" href="/dashboard/fairness">Open the full report</a>
    </div>
    <p class="mt-2"><?= Str::e($report['verdict']) ?></p>

    <?php if ($report['insights'] !== []): ?>
      <div class="stack-sm mt-3">
        <?php foreach (array_slice($report['insights'], 0, 3) as $insight): ?>
          <?php
          $tone = match ($insight['tone']) {
              'positive' => 'success',
              'warning'  => 'warning',
              'critical' => 'danger',
              default    => 'info',
          };
          ?>
          <div class="alert alert-<?= $tone ?>">
            <div>
              <strong><?= Str::e($insight['title']) ?></strong>
              <?= Str::e($insight['detail']) ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</div>

<div class="grid grid-sidebar mt-3">
  <div class="stack">
    <div class="card">
      <div class="card-head">
        <h2>Your week, area by area</h2>
        <a class="small" href="/dashboard/fairness">Fill in this week →</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Area</th><th class="right">You</th><th class="right">Partner</th><th class="right">Gap</th><th>Status</th></tr>
          </thead>
          <tbody>
            <?php foreach ($report['categories'] as $row): ?>
              <tr>
                <td>
                  <span><?= Str::e($row['emoji']) ?></span>
                  <span class="bold"><?= Str::e($row['name']) ?></span>
                </td>
                <td class="right tabular"><?= $row['a']['effort'] === null ? '—' : number_format($row['a']['effort'], 0) ?></td>
                <td class="right tabular"><?= $row['b']['effort'] === null ? '—' : number_format($row['b']['effort'], 0) ?></td>
                <td class="right tabular"><?= $row['status'] === 'missing' ? '—' : number_format($row['gap'], 0) ?></td>
                <td>
                  <?php
                  [$label, $tone] = match ($row['status']) {
                      'balanced' => ['Balanced', 'success'],
                      'tilted_a' => ['You more', 'warning'],
                      'tilted_b' => ['Partner more', 'warning'],
                      default    => ['Waiting', 'outline'],
                  };
                  ?>
                  <span class="badge badge-<?= $tone ?>"><?= $label ?></span>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>Recent feelings</h2>
        <a class="small" href="/dashboard/emotions">Log one →</a>
      </div>
      <div class="card-body">
        <?php if ($recentEmotions === []): ?>
          <p class="small muted">Nothing logged yet. The chart needs a few entries before it says anything useful.</p>
        <?php else: ?>
          <ul class="list-plain">
            <?php foreach ($recentEmotions as $emotion): ?>
              <li class="row" style="align-items:flex-start;gap:0.7rem">
                <span style="font-size:1.4rem;line-height:1.2"><?= Str::e($emotion['emoji'] ?: '💬') ?></span>
                <div style="flex:1;min-width:0">
                  <p class="small">
                    <strong><?= Str::e($emotion['display_name'] ?: $emotion['full_name'] ?: 'Someone') ?></strong>
                    felt <strong><?= Str::e($emotion['label'] ?: $emotion['emotion_slug']) ?></strong>
                    <span class="muted">(<?= (int) $emotion['intensity'] ?>/10)</span>
                    <?php if (Str::bool($emotion['is_private'])): ?>
                      <span class="badge">private</span>
                    <?php endif; ?>
                  </p>
                  <?php if ($emotion['note']): ?>
                    <p class="tiny muted"><?= Str::e(Str::excerpt($emotion['note'], 110)) ?></p>
                  <?php endif; ?>
                  <p class="tiny muted"><?= Str::e(Str::timeAgo($emotion['logged_at'])) ?></p>
                </div>
              </li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>
      </div>
    </div>
  </div>

  <aside class="stack">
    <div class="card <?= $myCheckin ? '' : 'card-accent' ?>">
      <div class="card-body">
        <h2 style="font-size:1rem">Today&rsquo;s check-in</h2>
        <?php if ($myCheckin): ?>
          <p class="small mt-2">
            ✅ Done — you rated the day <strong><?= (int) $myCheckin['day_rating'] ?>/10</strong>
            and connection <strong><?= (int) $myCheckin['connection'] ?>/10</strong>.
          </p>
          <a class="btn btn-sm btn-outline mt-2" href="/dashboard/checkin">Edit it</a>
        <?php else: ?>
          <p class="small mt-2">Thirty seconds: how was the day, and what do you need?</p>
          <a class="btn btn-sm btn-block mt-2" href="/dashboard/checkin">Check in now</a>
        <?php endif; ?>
      </div>
    </div>

    <?php if ($upcomingTrip): ?>
      <div class="card">
        <div class="card-body">
          <h2 style="font-size:1rem">Next trip</h2>
          <p class="bold mt-2"><?= Str::e($upcomingTrip['destination_name'] ?: $upcomingTrip['title']) ?></p>
          <p class="small muted">
            <?= Str::e(Str::date($upcomingTrip['start_date'])) ?>
            <?php
            $days = (int) floor((strtotime((string) $upcomingTrip['start_date']) - time()) / 86400);
            ?>
            · in <?= max(0, $days) ?> days
          </p>
          <a class="btn btn-sm btn-outline mt-2" href="/dashboard/travel/<?= Str::e($upcomingTrip['id']) ?>">Open the plan</a>
        </div>
      </div>
    <?php endif; ?>

    <?php if ($balanceOwed !== []): ?>
      <div class="card">
        <div class="card-body">
          <h2 style="font-size:1rem">Unsettled money</h2>
          <?php foreach ($balanceOwed as $row): ?>
            <?php
            $isMe = $row['user_id'] === $user['id'];
            $net = (int) $row['paid'] - (int) $row['owed'];
            ?>
            <p class="small mt-2">
              <?= $isMe ? 'You' : 'Your partner' ?>:
              <strong class="<?= $net >= 0 ? 'tone-success' : 'tone-warning' ?>">
                <?= $net >= 0 ? 'up' : 'down' ?>
                <?= Str::e(Currency::pretty(abs($net), $context['couple']['currency'])) ?>
              </strong>
            </p>
          <?php endforeach; ?>
          <a class="btn btn-sm btn-outline mt-2" href="/dashboard/budget">Settle up</a>
        </div>
      </div>
    <?php endif; ?>

    <div class="card">
      <div class="card-body">
        <h2 style="font-size:1rem">This month</h2>
        <ul class="list-plain small mt-2">
          <li class="row-between"><span>Emotions logged</span><span class="tabular bold"><?= $counts['emotions'] ?></span></li>
          <li class="row-between"><span>Messages</span><span class="tabular bold"><?= $counts['messages'] ?></span></li>
          <li class="row-between"><span>Trips planned</span><span class="tabular bold"><?= $counts['trips'] ?></span></li>
          <li class="row-between"><span>Documents in the vault</span><span class="tabular bold"><?= $counts['documents'] ?></span></li>
        </ul>
      </div>
    </div>
  </aside>
</div>

<?php View::end(); ?>
