<?php
declare(strict_types=1);

/**
 * Our Story — a beautiful timeline of the couple's milestones. Each moment can
 * carry a date, a place, a few words, an emoji and a photo. Rendered as a
 * vertical timeline rather than a table.
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'delete') {
        $milestone = Db::one('SELECT * FROM story_milestones WHERE id = ? AND couple_id = ? LIMIT 1',
            [Request::input('id'), $coupleId]);
        if ($milestone) {
            if ($milestone['image_path']) {
                Storage::delete((string) $milestone['image_bucket'], (string) $milestone['image_path']);
            }
            Db::delete('story_milestones', 'id = ? AND couple_id = ?', [$milestone['id'], $coupleId]);
            Flash::success('Moment removed.');
        }
        Response::redirect('/dashboard/story');
    }

    $title = trim(Request::input('title'));
    if ($title === '') {
        Flash::error('Give this moment a title.');
        Response::redirect('/dashboard/story');
    }

    $imageBucket = null;
    $imagePath   = null;
    if (!empty($_FILES['photo']['name'])) {
        $stored = Storage::store($_FILES['photo'], 'couple-media', $coupleId, $user['id'], 'story');
        if ($stored['ok']) {
            $imageBucket = 'couple-media';
            $imagePath   = $stored['path'];
        } else {
            Flash::error($stored['error']);
            Response::redirect('/dashboard/story');
        }
    }

    Db::insert('story_milestones', [
        'couple_id'    => $coupleId,
        'created_by'   => $user['id'],
        'title'        => mb_substr($title, 0, 160),
        'happened_on'  => Request::date('happened_on'),
        'description'  => Request::nullable('description'),
        'emoji'        => Request::input('emoji', '💕') ?: '💕',
        'location'     => Request::nullable('location'),
        'image_bucket' => $imageBucket,
        'image_path'   => $imagePath,
    ]);

    Audit::notify($context['partner']['user_id'] ?? '', 'A new moment in your story',
        $title, '/dashboard/story', 'love', '💕', $coupleId);

    Flash::success('Added to your story. 💕');
    Response::redirect('/dashboard/story');
}

// Newest first for editing, but the timeline renders oldest → today.
$milestones = Db::all(
    'SELECT * FROM story_milestones WHERE couple_id = ?
      ORDER BY happened_on IS NULL, happened_on ASC, created_at ASC',
    [$coupleId]
);

$emojiChoices = ['💕','❤️','😍','💍','🏡','✈️','🎉','🌅','🎂','👶','🐶','🌹','📸','🎓','🌊','🏔️'];

View::begin('layouts/app', ['title' => 'Our Story', 'no_index' => true]);
?>

<div class="page-head">
  <h1>💕 Our Story</h1>
  <p>The moments that made you. Add the day you met, your first trip, the moment you knew —
     with photos, places and the words you'll want to remember.</p>
</div>

<div class="grid grid-3 gap-lg">
  <!-- Add a moment --------------------------------------------------------- -->
  <form method="post" enctype="multipart/form-data" class="card love-card" style="grid-column:span 1">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="add">
    <div class="card-head"><h2>Add a moment</h2></div>
    <div class="card-body">
      <div class="field">
        <label for="title">What happened? <span class="required">*</span></label>
        <input class="input" id="title" name="title" required maxlength="160" placeholder="The day we met">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="happened_on">When</label>
          <input class="input" type="date" id="happened_on" name="happened_on">
        </div>
        <div class="field">
          <label for="location">Where</label>
          <input class="input" id="location" name="location" maxlength="160" placeholder="Paris">
        </div>
      </div>
      <div class="field">
        <label>Emoji</label>
        <div class="emoji-pick">
          <?php foreach ($emojiChoices as $i => $emoji): ?>
            <label class="emoji-opt">
              <input type="radio" name="emoji" value="<?= $emoji ?>" <?= $i === 0 ? 'checked' : '' ?>>
              <span><?= $emoji ?></span>
            </label>
          <?php endforeach; ?>
        </div>
      </div>
      <div class="field">
        <label for="description">The story</label>
        <textarea class="textarea" rows="4" id="description" name="description"
                  placeholder="How it felt, what you said, why it mattered…"></textarea>
      </div>
      <div class="field">
        <label for="photo">Photo <span class="muted">(optional)</span></label>
        <input class="input" type="file" id="photo" name="photo" accept="image/*" style="height:auto;padding:0.6rem">
      </div>
      <button class="btn btn-lg btn-block" type="submit">Add to our story 💕</button>
    </div>
  </form>

  <!-- Timeline ------------------------------------------------------------- -->
  <div style="grid-column:span 2">
    <?php if ($milestones === []): ?>
      <div class="card"><div class="card-body">
        <p class="small muted">Your story starts with a single moment. Add the day you met on the left,
          and watch your timeline grow. 💕</p>
      </div></div>
    <?php else: ?>
      <div class="story-timeline">
        <?php foreach ($milestones as $milestone): ?>
          <div class="story-node">
            <div class="story-dot"><?= Str::e($milestone['emoji'] ?: '💕') ?></div>
            <div class="card story-card">
              <?php if ($milestone['image_path']): ?>
                <img class="story-photo" loading="lazy"
                     src="<?= Str::e(Storage::url($milestone['image_bucket'], $milestone['image_path'])) ?>"
                     alt="<?= Str::e($milestone['title']) ?>">
              <?php endif; ?>
              <div class="card-body">
                <div class="row-between">
                  <div>
                    <p class="story-title"><?= Str::e($milestone['title']) ?></p>
                    <p class="tiny muted">
                      <?php if ($milestone['happened_on']): ?>
                        📅 <?= Str::e(Str::date($milestone['happened_on'])) ?>
                      <?php endif; ?>
                      <?php if ($milestone['location']): ?>
                        · 📍 <?= Str::e($milestone['location']) ?>
                      <?php endif; ?>
                    </p>
                  </div>
                  <form method="post" data-confirm="Remove this moment?">
                    <?= Csrf::field() ?>
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="id" value="<?= Str::e($milestone['id']) ?>">
                    <button class="btn btn-sm btn-ghost" type="submit">×</button>
                  </form>
                </div>
                <?php if ($milestone['description']): ?>
                  <p class="small mt-1" style="white-space:pre-wrap"><?= Str::e($milestone['description']) ?></p>
                <?php endif; ?>
              </div>
            </div>
          </div>
        <?php endforeach; ?>
        <div class="story-node story-today">
          <div class="story-dot">❤️</div>
          <div class="story-card-today"><span class="bold">Today</span>
            <span class="small muted">— and every moment still to come.</span></div>
        </div>
      </div>
    <?php endif; ?>
  </div>
</div>

<?php View::end(); ?>
