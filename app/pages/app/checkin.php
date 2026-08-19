<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$partner  = $context['partner'];

$date = Request::date('date') ?? Str::today();

if (Request::isPost()) {
    $date = Request::date('checkin_date') ?? Str::today();

    Db::run(
        'INSERT INTO daily_checkins
           (id, couple_id, user_id, checkin_date, day_rating, connection, gratitude, highlight, challenge, need_from_partner)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           day_rating        = VALUES(day_rating),
           connection        = VALUES(connection),
           gratitude         = VALUES(gratitude),
           highlight         = VALUES(highlight),
           challenge         = VALUES(challenge),
           need_from_partner = VALUES(need_from_partner)',
        [
            Str::uuid(),
            $coupleId,
            $user['id'],
            $date,
            max(1, min(10, Request::int('day_rating', 5))),
            max(1, min(10, Request::int('connection', 5))),
            Request::nullable('gratitude'),
            Request::nullable('highlight'),
            Request::nullable('challenge'),
            Request::nullable('need_from_partner'),
        ]
    );

    if ($partner) {
        Audit::notify(
            $partner['user_id'],
            ($user['display_name'] ?: $user['full_name'] ?: 'Your partner') . ' checked in',
            null,
            '/dashboard/checkin',
            'checkin',
            '📅',
            $coupleId
        );
    }

    Flash::success('Check-in saved.');
    Response::redirect('/dashboard/checkin?date=' . urlencode($date));
}

$mine = Db::one(
    'SELECT * FROM daily_checkins WHERE couple_id = ? AND user_id = ? AND checkin_date = ? LIMIT 1',
    [$coupleId, $user['id'], $date]
);

$theirs = $partner
    ? Db::one(
        'SELECT * FROM daily_checkins WHERE couple_id = ? AND user_id = ? AND checkin_date = ? LIMIT 1',
        [$coupleId, $partner['user_id'], $date]
    )
    : null;

$history = Db::all(
    'SELECT c.*, p.display_name, p.full_name
       FROM daily_checkins c
       LEFT JOIN profiles p ON p.id = c.user_id
      WHERE c.couple_id = ?
      ORDER BY c.checkin_date DESC, c.created_at DESC
      LIMIT 30',
    [$coupleId]
);

$streak = (int) Db::value(
    'SELECT COUNT(DISTINCT checkin_date) FROM daily_checkins
      WHERE couple_id = ? AND user_id = ? AND checkin_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)',
    [$coupleId, $user['id']],
    0
);

View::begin('layouts/app', ['title' => 'Daily check-in', 'no_index' => true]);
?>

<div class="page-head">
  <div class="row-between">
    <div>
      <h1>Daily check-in</h1>
      <p>Thirty seconds. How was the day, and what do you need from the other person?</p>
    </div>
    <form method="get" class="row">
      <label class="sr-only" for="date">Date</label>
      <input class="input" type="date" id="date" name="date" value="<?= Str::e($date) ?>"
             max="<?= Str::e(Str::today()) ?>" style="width:auto">
      <button class="btn btn-sm btn-outline" type="submit">Go</button>
    </form>
  </div>
</div>

<div class="grid grid-2">
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="checkin_date" value="<?= Str::e($date) ?>">

    <div class="card-head">
      <h2>Your check-in</h2>
      <span class="badge badge-<?= $mine ? 'success' : 'outline' ?>"><?= $mine ? 'Done' : 'Not yet' ?></span>
    </div>

    <div class="card-body">
      <div class="field">
        <label for="day_rating">
          How was your day? <output id="out-day" class="tabular bold"><?= (int) ($mine['day_rating'] ?? 5) ?></output>/10
        </label>
        <input type="range" min="1" max="10" id="day_rating" name="day_rating"
               value="<?= (int) ($mine['day_rating'] ?? 5) ?>" data-output="out-day">
      </div>

      <div class="field">
        <label for="connection">
          How connected did you feel? <output id="out-connection" class="tabular bold"><?= (int) ($mine['connection'] ?? 5) ?></output>/10
        </label>
        <input type="range" min="1" max="10" id="connection" name="connection"
               value="<?= (int) ($mine['connection'] ?? 5) ?>" data-output="out-connection">
      </div>

      <div class="field">
        <label for="gratitude">One thing you appreciated about them</label>
        <textarea class="textarea" rows="2" id="gratitude" name="gratitude"><?= Str::e($mine['gratitude'] ?? '') ?></textarea>
      </div>

      <div class="field">
        <label for="highlight">Best part of the day</label>
        <input class="input" id="highlight" name="highlight" value="<?= Str::e($mine['highlight'] ?? '') ?>">
      </div>

      <div class="field">
        <label for="challenge">Hardest part</label>
        <input class="input" id="challenge" name="challenge" value="<?= Str::e($mine['challenge'] ?? '') ?>">
      </div>

      <div class="field">
        <label for="need_from_partner">What you need from them tomorrow</label>
        <textarea class="textarea" rows="2" id="need_from_partner"
                  name="need_from_partner"><?= Str::e($mine['need_from_partner'] ?? '') ?></textarea>
        <span class="hint">Be specific. &ldquo;More effort&rdquo; is not actionable; &ldquo;call me before you go out&rdquo; is.</span>
      </div>

      <button class="btn mt-2" type="submit"><?= $mine ? 'Update my check-in' : 'Save my check-in' ?></button>
    </div>
  </form>

  <div class="stack">
    <div class="card">
      <div class="card-head">
        <h2><?= Str::e($partner['display_name'] ?? $partner['full_name'] ?? 'Your partner') ?></h2>
        <span class="badge badge-<?= $theirs ? 'success' : 'outline' ?>"><?= $theirs ? 'Done' : 'Not yet' ?></span>
      </div>
      <div class="card-body">
        <?php if (!$partner): ?>
          <p class="small muted">Invite your partner and their side appears here.</p>
        <?php elseif (!$theirs): ?>
          <p class="small muted">
            They have not checked in for <?= Str::e(Str::date($date)) ?> yet. You will see it here as soon as they do —
            and yes, they can see yours the same way.
          </p>
        <?php else: ?>
          <div class="field-row">
            <div>
              <p class="stat-label">Their day</p>
              <p class="stat-value tabular"><?= (int) $theirs['day_rating'] ?>/10</p>
            </div>
            <div>
              <p class="stat-label">Connection</p>
              <p class="stat-value tabular"><?= (int) $theirs['connection'] ?>/10</p>
            </div>
          </div>

          <?php foreach ([
              'gratitude'         => 'Appreciated about you',
              'highlight'         => 'Best part',
              'challenge'         => 'Hardest part',
              'need_from_partner' => 'What they need from you',
          ] as $field => $label): ?>
            <?php if (!empty($theirs[$field])): ?>
              <p class="small mt-2">
                <span class="muted"><?= $label ?>:</span> <?= Str::e($theirs[$field]) ?>
              </p>
            <?php endif; ?>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <h2 style="font-size:1rem">Your streak</h2>
        <p class="stat-value mt-1"><?= $streak ?><span class="small muted">/7 days</span></p>
        <?= View::meter($streak, 7, $streak >= 5 ? 'success' : 'primary') ?>
        <p class="tiny muted mt-2">Consistency is the whole point. A daily habit beats a monthly deep-dive.</p>
      </div>
    </div>
  </div>
</div>

<?php if ($history !== []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>Recent check-ins</h2></div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Date</th><th>Who</th><th class="right">Day</th><th class="right">Connection</th><th>Appreciated</th><th>Needed</th></tr>
        </thead>
        <tbody>
          <?php foreach ($history as $row): ?>
            <tr>
              <td class="nowrap"><?= Str::e(Str::date($row['checkin_date'])) ?></td>
              <td><?= Str::e($row['user_id'] === $user['id'] ? 'You' : ($row['display_name'] ?: $row['full_name'] ?: 'Partner')) ?></td>
              <td class="right tabular"><?= (int) $row['day_rating'] ?></td>
              <td class="right tabular"><?= (int) $row['connection'] ?></td>
              <td class="small"><?= Str::e(Str::excerpt($row['gratitude'], 60)) ?></td>
              <td class="small"><?= Str::e(Str::excerpt($row['need_from_partner'], 60)) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
<?php endif; ?>

<?php View::end(); ?>
