<?php
declare(strict_types=1);

/**
 * The date-night generator. Choose a mood, place, budget and time; get a
 * coherent little plan you can regenerate or save. Saved plans live in
 * date_nights so a couple keeps their favourites.
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'save') {
        $mood     = Request::input('mood', 'romantic');
        $location = Request::input('location', 'home');
        $budget   = max(0, Request::int('budget'));
        $minutes  = max(30, Request::int('minutes', 120));
        $nonce    = Request::int('nonce');

        $plan = DateNight::generate($mood, $location, $budget, $minutes, $nonce);

        Db::insert('date_nights', [
            'couple_id'  => $coupleId,
            'created_by' => $user['id'],
            'title'      => DateNight::title($mood, $location),
            'mood'       => $mood,
            'location'   => $location,
            'budget'     => $budget,
            'minutes'    => $minutes,
            'plan'       => json_encode($plan),
        ]);

        Audit::notify($context['partner']['user_id'] ?? '', 'A date-night idea for us 💕',
            DateNight::title($mood, $location), '/dashboard/date-night', 'love', '💕', $coupleId);

        Flash::success('Saved to your date ideas. 💕');
        Response::redirect('/dashboard/date-night#saved');
    }

    if ($action === 'favorite') {
        Db::run('UPDATE date_nights SET is_favorite = 1 - is_favorite WHERE id = ? AND couple_id = ?',
            [Request::input('id'), $coupleId]);
        Response::redirect('/dashboard/date-night#saved');
    }

    if ($action === 'done') {
        Db::run('UPDATE date_nights SET is_done = 1 - is_done WHERE id = ? AND couple_id = ?',
            [Request::input('id'), $coupleId]);
        Response::redirect('/dashboard/date-night#saved');
    }

    if ($action === 'delete') {
        Db::delete('date_nights', 'id = ? AND couple_id = ?', [Request::input('id'), $coupleId]);
        Flash::success('Removed.');
        Response::redirect('/dashboard/date-night#saved');
    }
}

// Generate whenever inputs are present (via GET, so "another idea" is a link).
$hasInputs = isset($_GET['mood']);
$mood     = Request::input('mood', 'romantic');
$mood     = isset(DateNight::MOODS[$mood]) ? $mood : 'romantic';
$location = Request::input('location', 'home') === 'out' ? 'out' : 'home';
$budget   = max(0, Request::int('budget', 30));
$minutes  = max(30, Request::int('minutes', 120));
$nonce    = Request::int('nonce');

$plan = $hasInputs ? DateNight::generate($mood, $location, $budget, $minutes, $nonce) : [];

$saved = Db::all(
    'SELECT * FROM date_nights WHERE couple_id = ? ORDER BY is_favorite DESC, created_at DESC LIMIT 30',
    [$coupleId]
);

$queryFor = static function (array $overrides) use ($mood, $location, $budget, $minutes, $nonce): string {
    $params = array_merge(compact('mood', 'location', 'budget', 'minutes', 'nonce'), $overrides);
    return '/dashboard/date-night?' . http_build_query($params) . '#result';
};

View::begin('layouts/app', ['title' => 'Date night', 'no_index' => true]);
?>

<div class="page-head">
  <h1>💕 Date night</h1>
  <p>Tell us the vibe; we'll plan the evening. Regenerate until it feels right, then save the keepers.</p>
</div>

<form method="get" class="card love-card" id="generator">
  <div class="card-body">
    <div class="field">
      <label>Mood</label>
      <div class="mood-grid">
        <?php foreach (DateNight::MOODS as $key => [$emoji, $label]): ?>
          <label class="mood-chip">
            <input type="radio" name="mood" value="<?= $key ?>" <?= $mood === $key ? 'checked' : '' ?>>
            <span class="mood-emoji"><?= $emoji ?></span>
            <span class="mood-label"><?= Str::e($label) ?></span>
          </label>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="field-row mt-2">
      <div class="field">
        <label for="location">Where</label>
        <select class="select" id="location" name="location">
          <?php foreach (DateNight::LOCATIONS as $key => $label): ?>
            <option value="<?= $key ?>" <?= $location === $key ? 'selected' : '' ?>><?= Str::e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label for="budget">Budget</label>
        <select class="select" id="budget" name="budget">
          <?php foreach (['0'=>'Free','30'=>'Low (up to ~30)','80'=>'Moderate (~30–80)','150'=>'Treat yourselves'] as $v => $l): ?>
            <option value="<?= $v ?>" <?= (string) $budget === $v ? 'selected' : '' ?>><?= Str::e($l) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label for="minutes">Time</label>
        <select class="select" id="minutes" name="minutes">
          <?php foreach (['60'=>'About an hour','120'=>'An evening','210'=>'All night'] as $v => $l): ?>
            <option value="<?= $v ?>" <?= (string) $minutes === $v ? 'selected' : '' ?>><?= Str::e($l) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <input type="hidden" name="nonce" value="0">
    <button class="btn btn-lg btn-block mt-2" type="submit">Plan our date 💕</button>
  </div>
</form>

<?php if ($hasInputs && $plan !== []): ?>
  <div class="card ld-countdown mt-3" id="result">
    <div class="card-body">
      <div class="row-between">
        <h2><?= DateNight::MOODS[$mood][0] ?> <?= Str::e(DateNight::title($mood, $location)) ?></h2>
        <a class="btn btn-sm btn-outline" href="<?= Str::e($queryFor(['nonce' => $nonce + 1])) ?>">↻ Another idea</a>
      </div>
      <ol class="date-plan mt-2">
        <?php foreach ($plan as $step): ?>
          <li><span class="date-plan-emoji"><?= $step['emoji'] ?></span> <?= Str::e($step['text']) ?></li>
        <?php endforeach; ?>
      </ol>

      <form method="post" class="mt-2">
        <?= Csrf::field() ?>
        <input type="hidden" name="action" value="save">
        <input type="hidden" name="mood" value="<?= Str::e($mood) ?>">
        <input type="hidden" name="location" value="<?= Str::e($location) ?>">
        <input type="hidden" name="budget" value="<?= (int) $budget ?>">
        <input type="hidden" name="minutes" value="<?= (int) $minutes ?>">
        <input type="hidden" name="nonce" value="<?= (int) $nonce ?>">
        <button class="btn" type="submit">💾 Save this idea</button>
      </form>
    </div>
  </div>
<?php endif; ?>

<!-- Saved ideas ------------------------------------------------------------ -->
<?php if ($saved !== []): ?>
  <div class="card mt-3" id="saved">
    <div class="card-head"><h2>Your date ideas (<?= count($saved) ?>)</h2></div>
    <div class="card-body stack">
      <?php foreach ($saved as $date): ?>
        <?php $steps = Str::json($date['plan']); ?>
        <div class="card card-flat date-saved <?= Str::bool($date['is_done']) ? 'is-done' : '' ?>">
          <div class="card-body">
            <div class="row-between">
              <div>
                <span class="bold">
                  <?= Str::bool($date['is_favorite']) ? '⭐ ' : '' ?>
                  <?= Str::e(DateNight::MOODS[$date['mood']][0] ?? '💕') ?> <?= Str::e($date['title']) ?>
                </span>
                <span class="tiny muted" style="display:block">
                  <?= Str::e(DateNight::LOCATIONS[$date['location']] ?? '') ?>
                  <?php if ($date['minutes']): ?>· <?= (int) $date['minutes'] ?> min<?php endif; ?>
                  <?php if (Str::bool($date['is_done'])): ?>· <span style="color:hsl(var(--success))">done ✅</span><?php endif; ?>
                </span>
              </div>
              <div class="nowrap">
                <form method="post" style="display:inline">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="favorite">
                  <input type="hidden" name="id" value="<?= Str::e($date['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit" title="Favourite"><?= Str::bool($date['is_favorite']) ? '★' : '☆' ?></button>
                </form>
                <form method="post" style="display:inline">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="done">
                  <input type="hidden" name="id" value="<?= Str::e($date['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit"><?= Str::bool($date['is_done']) ? 'Undo' : 'We did it' ?></button>
                </form>
                <form method="post" style="display:inline" data-confirm="Remove this idea?">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= Str::e($date['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit">×</button>
                </form>
              </div>
            </div>
            <?php if ($steps !== []): ?>
              <ol class="date-plan date-plan-sm mt-1">
                <?php foreach ($steps as $step): ?>
                  <li><span class="date-plan-emoji"><?= Str::e($step['emoji'] ?? '•') ?></span> <?= Str::e($step['text'] ?? '') ?></li>
                <?php endforeach; ?>
              </ol>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>

<?php View::end(); ?>
