<?php
declare(strict_types=1);

/**
 * Couple Challenges — start a short guided programme and tick off a prompt a
 * day. One active challenge at a time keeps it focused; past ones are kept as
 * a record of what you did together.
 */

$user      = Auth::require();
$context   = Auth::requireCouple();
$coupleId  = $context['couple']['id'];
$partnerId = $context['partner']['user_id'] ?? null;

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'start') {
        $key = Request::input('challenge_key');
        $challenge = Challenges::get($key);
        if (!$challenge) {
            Flash::error('That challenge no longer exists.');
            Response::redirect('/dashboard/challenges');
        }

        if (Db::count('couple_challenges', 'couple_id = ? AND status = ?', [$coupleId, 'active']) > 0) {
            Flash::error('Finish or leave your current challenge first — one at a time. 🙂');
            Response::redirect('/dashboard/challenges');
        }

        $total = count($challenge['days']);
        $challengeId = Db::insert('couple_challenges', [
            'couple_id'     => $coupleId,
            'challenge_key' => $key,
            'title'         => $challenge['title'],
            'total_days'    => $total,
            'started_on'    => Str::today(),
            'status'        => 'active',
        ]);

        if ($challengeId !== null) {
            for ($day = 1; $day <= $total; $day++) {
                Db::insert('challenge_days', [
                    'challenge_id' => $challengeId,
                    'couple_id'    => $coupleId,
                    'day_number'   => $day,
                ]);
            }
            Audit::notify($partnerId ?? '', 'New challenge started ' . $challenge['emoji'],
                'You started “' . $challenge['title'] . '” together.', '/dashboard/challenges', 'love',
                $challenge['emoji'], $coupleId);
        }

        Flash::success('Challenge started! ' . $challenge['emoji'] . ' One day at a time.');
        Response::redirect('/dashboard/challenges');
    }

    if ($action === 'toggle_day') {
        $dayId = Request::input('id');
        $day = Db::one(
            'SELECT d.*, c.status FROM challenge_days d
               JOIN couple_challenges c ON c.id = d.challenge_id
              WHERE d.id = ? AND d.couple_id = ? LIMIT 1',
            [$dayId, $coupleId]
        );
        if ($day && $day['status'] === 'active') {
            $done = !Str::bool($day['is_done']);
            Db::run(
                'UPDATE challenge_days SET is_done = ?, done_by = ?, done_at = ? WHERE id = ?',
                [$done ? 1 : 0, $done ? $user['id'] : null, $done ? Str::now() : null, $dayId]
            );

            // Auto-complete the challenge when every day is ticked.
            $remaining = Db::count('challenge_days', 'challenge_id = ? AND is_done = 0', [$day['challenge_id']]);
            if ($remaining === 0) {
                Db::run('UPDATE couple_challenges SET status = ?, completed_at = UTC_TIMESTAMP() WHERE id = ?',
                    ['completed', $day['challenge_id']]);
                Audit::notify($partnerId ?? '', 'Challenge complete! 🎉',
                    'You finished a challenge together.', '/dashboard/challenges', 'love', '🎉', $coupleId);
                Flash::success('You did it — challenge complete! 🎉');
            }
        }
        Response::redirect('/dashboard/challenges');
    }

    if ($action === 'abandon') {
        Db::run('UPDATE couple_challenges SET status = ? WHERE id = ? AND couple_id = ? AND status = ?',
            ['abandoned', Request::input('id'), $coupleId, 'active']);
        Flash::success('Challenge set aside — you can always start again.');
        Response::redirect('/dashboard/challenges');
    }
}

$active = Db::one('SELECT * FROM couple_challenges WHERE couple_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
    [$coupleId, 'active']);

$activeDays = [];
$activeDefinition = null;
$doneCount = 0;
if ($active) {
    $activeDefinition = Challenges::get($active['challenge_key']);
    $activeDays = Db::all('SELECT * FROM challenge_days WHERE challenge_id = ? ORDER BY day_number ASC',
        [$active['id']]);
    foreach ($activeDays as $d) {
        if (Str::bool($d['is_done'])) { $doneCount++; }
    }
}

$past = Db::all(
    'SELECT * FROM couple_challenges WHERE couple_id = ? AND status <> ? ORDER BY created_at DESC LIMIT 12',
    [$coupleId, 'active']
);

View::begin('layouts/app', ['title' => 'Couple challenges', 'no_index' => true]);
?>

<div class="page-head">
  <h1>🎯 Couple challenges</h1>
  <p>Short, guided programmes that build connection a day at a time. Do one together.</p>
</div>

<?php if ($active && $activeDefinition): ?>
  <!-- Active challenge ----------------------------------------------------- -->
  <?php $percent = $active['total_days'] > 0 ? (int) round($doneCount / $active['total_days'] * 100) : 0; ?>
  <div class="card love-card">
    <div class="card-head">
      <h2><?= $activeDefinition['emoji'] ?> <?= Str::e($active['title']) ?></h2>
      <span class="badge badge-primary"><?= $doneCount ?>/<?= (int) $active['total_days'] ?> days</span>
    </div>
    <div class="card-body">
      <p class="small muted"><?= Str::e($activeDefinition['blurb']) ?></p>
      <div class="mt-2"><?= View::meter($doneCount, max(1, (int) $active['total_days']), 'primary') ?></div>

      <div class="challenge-days mt-3">
        <?php foreach ($activeDays as $d): ?>
          <?php
          $task = Challenges::dayTask($active['challenge_key'], (int) $d['day_number']) ?? '';
          $done = Str::bool($d['is_done']);
          ?>
          <div class="challenge-day <?= $done ? 'is-done' : '' ?>">
            <form method="post" style="display:inline-flex">
              <?= Csrf::field() ?>
              <input type="hidden" name="action" value="toggle_day">
              <input type="hidden" name="id" value="<?= Str::e($d['id']) ?>">
              <button class="challenge-check" type="submit" aria-label="Toggle day <?= (int) $d['day_number'] ?>">
                <?= $done ? '✅' : '⬜' ?>
              </button>
            </form>
            <div class="challenge-day-body">
              <span class="challenge-day-num">Day <?= (int) $d['day_number'] ?></span>
              <span class="challenge-day-task"><?= Str::e($task) ?></span>
              <?php if ($done && $d['done_at']): ?>
                <span class="tiny muted">done <?= Str::e(Str::date($d['done_at'])) ?></span>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>

      <form method="post" class="mt-3" data-confirm="Leave this challenge? Your progress will be kept as abandoned.">
        <?= Csrf::field() ?>
        <input type="hidden" name="action" value="abandon">
        <input type="hidden" name="id" value="<?= Str::e($active['id']) ?>">
        <button class="btn btn-sm btn-ghost" type="submit">Leave this challenge</button>
      </form>
    </div>
  </div>
<?php else: ?>
  <!-- Choose a challenge --------------------------------------------------- -->
  <div class="challenge-grid">
    <?php foreach (Challenges::all() as $key => $challenge): ?>
      <div class="card challenge-card">
        <div class="card-body">
          <span class="challenge-emoji"><?= $challenge['emoji'] ?></span>
          <h3><?= Str::e($challenge['title']) ?></h3>
          <p class="small muted"><?= Str::e($challenge['blurb']) ?></p>
          <p class="tiny muted mt-1"><?= count($challenge['days']) ?> days · one prompt a day</p>
          <form method="post" class="mt-2">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="start">
            <input type="hidden" name="challenge_key" value="<?= Str::e($key) ?>">
            <button class="btn btn-block" type="submit">Start together</button>
          </form>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<!-- Past challenges -------------------------------------------------------- -->
<?php if ($past !== []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>Your challenge history</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Challenge</th><th>Started</th><th>Status</th></tr></thead>
        <tbody>
          <?php foreach ($past as $row): ?>
            <?php $def = Challenges::get($row['challenge_key']); ?>
            <tr>
              <td><?= $def['emoji'] ?? '🎯' ?> <?= Str::e($row['title']) ?></td>
              <td class="small muted nowrap"><?= Str::e(Str::date($row['started_on'])) ?></td>
              <td>
                <span class="badge badge-<?= $row['status'] === 'completed' ? 'success' : 'outline' ?>">
                  <?= Str::e($row['status']) ?>
                </span>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
<?php endif; ?>

<?php View::end(); ?>
