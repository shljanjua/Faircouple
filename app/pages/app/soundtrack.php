<?php
declare(strict_types=1);

/**
 * Our Soundtrack — songs tied to the moments of the relationship. A link opens
 * in a new tab; nothing autoplays.
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'delete') {
        Db::delete('soundtrack_songs', 'id = ? AND couple_id = ?', [Request::input('id'), $coupleId]);
        Flash::success('Removed.');
        Response::redirect('/dashboard/soundtrack');
    }

    if ($action === 'anthem') {
        // Only one "our song" at a time.
        Db::run('UPDATE soundtrack_songs SET is_anthem = 0 WHERE couple_id = ?', [$coupleId]);
        Db::run('UPDATE soundtrack_songs SET is_anthem = 1 WHERE id = ? AND couple_id = ?',
            [Request::input('id'), $coupleId]);
        Flash::success('Set as your song. 🎶');
        Response::redirect('/dashboard/soundtrack');
    }

    // Add a song.
    $title = trim(Request::input('title'));
    if ($title === '') {
        Flash::error('What\'s the song called?');
        Response::redirect('/dashboard/soundtrack');
    }
    $moment = Request::input('moment');
    $moment = isset(Soundtrack::MOMENTS[$moment]) ? $moment : null;

    Db::insert('soundtrack_songs', [
        'couple_id' => $coupleId,
        'added_by'  => $user['id'],
        'title'     => mb_substr($title, 0, 200),
        'artist'    => Request::nullable('artist'),
        'moment'    => $moment,
        'url'       => Soundtrack::safeUrl(Request::input('url')),
        'note'      => Request::nullable('note'),
        'is_anthem' => $moment === 'anthem' ? 1 : 0,
    ]);

    if ($moment === 'anthem') {
        Db::run('UPDATE soundtrack_songs SET is_anthem = 0 WHERE couple_id = ? AND title <> ?', [$coupleId, mb_substr($title, 0, 200)]);
    }

    Audit::notify($context['partner']['user_id'] ?? '', 'Added to our soundtrack 🎶',
        $title, '/dashboard/soundtrack', 'love', '🎶', $coupleId);

    Flash::success('Added to your soundtrack. 🎶');
    Response::redirect('/dashboard/soundtrack');
}

$songs = Db::all('SELECT * FROM soundtrack_songs WHERE couple_id = ? ORDER BY is_anthem DESC, created_at DESC', [$coupleId]);
$anthem = null;
foreach ($songs as $s) { if (Str::bool($s['is_anthem'])) { $anthem = $s; break; } }

View::begin('layouts/app', ['title' => 'Our soundtrack', 'no_index' => true]);
?>

<div class="page-head">
  <h1>🎵 Our soundtrack</h1>
  <p>The songs of you two — first dance, road trips, late-night talks. Add a link and play them when you like.</p>
</div>

<?php if ($anthem): ?>
  <div class="card ld-countdown mt-1">
    <div class="card-body text-center">
      <p class="ll-today-eyebrow">Our song</p>
      <p class="ld-count-label" style="font-size:1.4rem">🎶 <?= Str::e($anthem['title']) ?>
        <?php if ($anthem['artist']): ?><span class="muted">— <?= Str::e($anthem['artist']) ?></span><?php endif; ?></p>
      <?php if ($url = Soundtrack::safeUrl($anthem['url'])): ?>
        <a class="btn btn-sm mt-2" href="<?= Str::e($url) ?>" target="_blank" rel="noopener">▶ Play our song</a>
      <?php endif; ?>
    </div>
  </div>
<?php endif; ?>

<form method="post" class="card love-card mt-3">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="add">
  <div class="card-head"><h2>Add a song</h2></div>
  <div class="card-body">
    <div class="field-row">
      <div class="field">
        <label for="title">Song <span class="required">*</span></label>
        <input class="input" id="title" name="title" required maxlength="200" placeholder="Song title">
      </div>
      <div class="field">
        <label for="artist">Artist</label>
        <input class="input" id="artist" name="artist" maxlength="200">
      </div>
      <div class="field">
        <label for="moment">The moment</label>
        <select class="select" id="moment" name="moment">
          <option value="">Just us</option>
          <?php foreach (Soundtrack::MOMENTS as $key => [$emoji, $label]): ?>
            <option value="<?= $key ?>"><?= $emoji ?>  <?= Str::e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="url">Link <span class="muted">(Spotify, YouTube, Apple Music…)</span></label>
        <input class="input" id="url" name="url" maxlength="500" placeholder="https://…">
      </div>
      <div class="field">
        <label for="note">Why this song</label>
        <input class="input" id="note" name="note" maxlength="280" placeholder="It was playing when…">
      </div>
    </div>
    <button class="btn btn-block mt-2" type="submit">Add to our soundtrack</button>
  </div>
</form>

<?php if ($songs !== []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2><?= count($songs) ?> song<?= count($songs) === 1 ? '' : 's' ?></h2></div>
    <div class="card-body stack-sm">
      <?php foreach ($songs as $song): ?>
        <?php
        $url = Soundtrack::safeUrl($song['url']);
        [$mEmoji, $mLabel] = Soundtrack::moment($song['moment']);
        ?>
        <div class="song-row">
          <span class="song-moment" title="<?= Str::e($mLabel) ?>"><?= $mEmoji ?></span>
          <div class="song-body">
            <span class="bold"><?= Str::e($song['title']) ?>
              <?php if ($song['artist']): ?><span class="muted">— <?= Str::e($song['artist']) ?></span><?php endif; ?>
              <?php if (Str::bool($song['is_anthem'])): ?><span class="badge badge-primary">our song</span><?php endif; ?>
            </span>
            <span class="tiny muted" style="display:block"><?= Str::e($mLabel) ?><?php if ($song['note']): ?> · “<?= Str::e($song['note']) ?>”<?php endif; ?></span>
          </div>
          <div class="song-actions nowrap">
            <?php if ($url): ?>
              <?php [$sEmoji, $sLabel] = Soundtrack::service($url); ?>
              <a class="btn btn-sm btn-outline" href="<?= Str::e($url) ?>" target="_blank" rel="noopener"><?= $sEmoji ?> <?= Str::e($sLabel ?: 'Play') ?></a>
            <?php endif; ?>
            <?php if (!Str::bool($song['is_anthem'])): ?>
              <form method="post" style="display:inline">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="anthem">
                <input type="hidden" name="id" value="<?= Str::e($song['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit" title="Set as our song">☆</button>
              </form>
            <?php endif; ?>
            <form method="post" style="display:inline" data-confirm="Remove this song?">
              <?= Csrf::field() ?>
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="id" value="<?= Str::e($song['id']) ?>">
              <button class="btn btn-sm btn-ghost" type="submit">×</button>
            </form>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>

<?php View::end(); ?>
