<?php
declare(strict_types=1);

/**
 * The love-language tool. Each partner scores the five languages and can flag
 * what they need most right now; the other partner gets a concrete "how to love
 * them today".
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$partner  = $context['partner'];
$partnerId = $partner['user_id'] ?? null;

if (Request::isPost()) {
    $data = ['couple_id' => $coupleId, 'user_id' => $user['id']];
    foreach (LoveLanguage::KEYS as $key) {
        $data[$key] = (int) Str::clamp((float) Request::int($key, 3), 1, 5);
    }
    $focus = Request::input('current_focus');
    $data['current_focus'] = isset(LoveLanguage::LANGUAGES[$focus]) ? $focus : null;

    Db::run(
        'INSERT INTO love_languages (id, couple_id, user_id, words, quality_time, acts, gifts, physical, current_focus)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           words = VALUES(words), quality_time = VALUES(quality_time), acts = VALUES(acts),
           gifts = VALUES(gifts), physical = VALUES(physical), current_focus = VALUES(current_focus)',
        [Str::uuid(), $coupleId, $user['id'], $data['words'], $data['quality_time'],
         $data['acts'], $data['gifts'], $data['physical'], $data['current_focus']]
    );

    if ($partnerId) {
        $primary = LoveLanguage::actionable($data);
        Audit::notify($partnerId, 'Updated how I feel loved 💗',
            $primary ? 'Right now: ' . LoveLanguage::meta($primary)[1] . '.' : null,
            '/dashboard/love-language', 'love', LoveLanguage::meta($primary)[0], $coupleId);
    }

    Flash::success('Saved. Your partner can see how to love you best. 💗');
    Response::redirect('/dashboard/love-language');
}

$mine    = Db::one('SELECT * FROM love_languages WHERE user_id = ? LIMIT 1', [$user['id']]);
$theirs  = $partnerId ? Db::one('SELECT * FROM love_languages WHERE user_id = ? LIMIT 1', [$partnerId]) : null;

$partnerName = $partner['display_name'] ?? ($partner['full_name'] ?? 'Your partner');
$theirAction = LoveLanguage::actionable($theirs);

View::begin('layouts/app', ['title' => 'Love language', 'no_index' => true]);
?>

<div class="page-head">
  <h1>❤️ How you each feel loved</h1>
  <p>Not a one-off quiz — a living guide. Score what matters to you, and see how to love
     <?= Str::e($partnerName) ?> the way they actually feel it.</p>
</div>

<!-- How to love your partner today ---------------------------------------- -->
<?php if ($theirAction): ?>
  <?php [$emoji, $label, $desc] = LoveLanguage::meta($theirAction); ?>
  <div class="card ll-today">
    <div class="card-body">
      <p class="ll-today-eyebrow">How to love <?= Str::e($partnerName) ?> today</p>
      <p class="ll-today-lang"><?= $emoji ?> <?= Str::e($label) ?>
        <?php if (($theirs['current_focus'] ?? null) === $theirAction): ?>
          <span class="badge badge-primary">what they need most right now</span>
        <?php endif; ?>
      </p>
      <p class="ll-today-try"><strong>Try this:</strong> <?= Str::e(LoveLanguage::todaySuggestion($theirAction)) ?></p>
      <p class="tiny muted mt-1"><?= Str::e($desc) ?></p>
    </div>
  </div>
<?php elseif ($partnerId): ?>
  <div class="card"><div class="card-body">
    <p class="small muted"><?= Str::e($partnerName) ?> hasn't set their love language yet.
      Once they do, you'll see exactly how to make them feel loved.</p>
  </div></div>
<?php endif; ?>

<div class="grid grid-2 gap-lg mt-3">
  <!-- My love language ---------------------------------------------------- -->
  <form method="post" class="card love-card">
    <?= Csrf::field() ?>
    <div class="card-head"><h2>How I feel loved</h2></div>
    <div class="card-body">
      <p class="small muted">Slide each one from a little to a lot.</p>
      <?php foreach (LoveLanguage::LANGUAGES as $key => [$emoji, $label, $desc]): ?>
        <div class="ll-slider">
          <label for="ll-<?= $key ?>"><span class="ll-emoji"><?= $emoji ?></span> <?= Str::e($label) ?>
            <span class="ll-val" data-for="ll-<?= $key ?>"><?= (int) ($mine[$key] ?? 3) ?></span></label>
          <input type="range" id="ll-<?= $key ?>" name="<?= $key ?>" min="1" max="5" step="1"
                 value="<?= (int) ($mine[$key] ?? 3) ?>" class="ll-range">
          <span class="hint"><?= Str::e($desc) ?></span>
        </div>
      <?php endforeach; ?>

      <div class="field mt-2">
        <label for="current_focus">What do you need most right now? <span class="muted">(optional)</span></label>
        <select class="select" id="current_focus" name="current_focus">
          <option value="">No particular focus</option>
          <?php foreach (LoveLanguage::LANGUAGES as $key => [$emoji, $label]): ?>
            <option value="<?= $key ?>" <?= ($mine['current_focus'] ?? '') === $key ? 'selected' : '' ?>>
              <?= $emoji ?>  <?= Str::e($label) ?>
            </option>
          <?php endforeach; ?>
        </select>
        <span class="hint">This is what your partner is nudged toward first.</span>
      </div>

      <button class="btn btn-lg btn-block mt-3" type="submit">Save my love language</button>
    </div>
  </form>

  <!-- Partner's ranking --------------------------------------------------- -->
  <div class="card love-card">
    <div class="card-head"><h2><?= Str::e($partnerName) ?>'s love languages</h2></div>
    <div class="card-body">
      <?php if ($theirs): ?>
        <?php foreach (LoveLanguage::ranking($theirs) as $i => $row): ?>
          <?php [$emoji, $label] = LoveLanguage::meta($row['key']); ?>
          <div class="ll-rank <?= $i === 0 ? 'is-top' : '' ?>">
            <span class="ll-rank-emoji"><?= $emoji ?></span>
            <span class="ll-rank-label"><?= Str::e($label) ?>
              <?php if ($i === 0): ?><span class="badge badge-success">their top</span><?php endif; ?>
            </span>
            <span class="ll-rank-meter"><?= View::meter($row['score'], 5, 'primary') ?></span>
          </div>
        <?php endforeach; ?>
        <?php if ($theirs['current_focus']): ?>
          <p class="small mt-2">Right now they most value
            <strong><?= Str::e(LoveLanguage::meta($theirs['current_focus'])[1]) ?></strong>.</p>
        <?php endif; ?>
      <?php elseif (!$partnerId): ?>
        <p class="small muted">Invite your partner from
          <a href="/dashboard/partner">Partner &amp; space</a> to compare love languages.</p>
      <?php else: ?>
        <p class="small muted"><?= Str::e($partnerName) ?> hasn't filled this in yet.</p>
      <?php endif; ?>
    </div>
  </div>
</div>

<script>
  // Live value labels for the sliders.
  document.querySelectorAll('.ll-range').forEach(function (range) {
    var out = document.querySelector('.ll-val[data-for="' + range.id + '"]');
    if (out) range.addEventListener('input', function () { out.textContent = range.value; });
  });
</script>

<?php View::end(); ?>
