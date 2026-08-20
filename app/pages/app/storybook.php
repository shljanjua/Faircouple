<?php
declare(strict_types=1);

/**
 * The Storybook — written, co-authored chapters of the couple's story. Distinct
 * from the dated "Our Story" timeline: this is prose, guided by prompts, that
 * both partners write and that reads like a book.
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'delete') {
        $chapter = Db::one('SELECT * FROM story_chapters WHERE id = ? AND couple_id = ? LIMIT 1',
            [Request::input('id'), $coupleId]);
        if ($chapter) {
            if ($chapter['image_path']) {
                Storage::delete((string) $chapter['image_bucket'], (string) $chapter['image_path']);
            }
            Db::delete('story_chapters', 'id = ? AND couple_id = ?', [$chapter['id'], $coupleId]);
            Flash::success('Chapter removed.');
        }
        Response::redirect('/dashboard/storybook');
    }

    // Write a chapter.
    $title = trim(Request::input('title'));
    $body  = trim(Request::raw('body'));
    if ($title === '' && $body === '') {
        Flash::error('Give your chapter a title or some words.');
        Response::redirect('/dashboard/storybook');
    }

    $promptKey = Request::input('prompt_key');
    $promptKey = isset(Storybook::PROMPTS[$promptKey]) ? $promptKey : null;
    if ($title === '' && $promptKey) {
        $title = Storybook::prompt($promptKey)[1];
    }

    $imageBucket = null;
    $imagePath = null;
    if (!empty($_FILES['image']['name'])) {
        $stored = Storage::store($_FILES['image'], 'couple-media', $coupleId, $user['id'], 'chapter');
        if ($stored['ok']) {
            $imageBucket = 'couple-media';
            $imagePath = $stored['path'];
        } else {
            Flash::error($stored['error']);
            Response::redirect('/dashboard/storybook');
        }
    }

    $nextOrder = (int) Db::value('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM story_chapters WHERE couple_id = ?', [$coupleId], 1);

    Db::insert('story_chapters', [
        'couple_id'    => $coupleId,
        'author_id'    => $user['id'],
        'title'        => mb_substr($title, 0, 200),
        'prompt_key'   => $promptKey,
        'body'         => $body !== '' ? $body : null,
        'image_bucket' => $imageBucket,
        'image_path'   => $imagePath,
        'sort_order'   => $nextOrder,
    ]);

    Audit::notify($context['partner']['user_id'] ?? '', 'A new chapter in our story 📖',
        $title, '/dashboard/storybook', 'love', '📖', $coupleId);

    Flash::success('Chapter added to your storybook. 📖');
    Response::redirect('/dashboard/storybook');
}

$chapters = Db::all(
    'SELECT c.*, p.display_name, p.full_name FROM story_chapters c
       LEFT JOIN profiles p ON p.id = c.author_id
      WHERE c.couple_id = ? ORDER BY c.sort_order ASC, c.created_at ASC',
    [$coupleId]
);

$prefillPrompt = (string) ($_GET['prompt'] ?? '');
$prefill = isset(Storybook::PROMPTS[$prefillPrompt]) ? $prefillPrompt : '';

View::begin('layouts/app', ['title' => 'Our storybook', 'no_index' => true]);
?>

<div class="page-head">
  <h1>📖 Our storybook</h1>
  <p>Write your story together, a chapter at a time. Not dates on a timeline — the words, in your own voice.</p>
</div>

<!-- Prompts ---------------------------------------------------------------- -->
<div class="card">
  <div class="card-head"><h2>Start a chapter</h2></div>
  <div class="card-body">
    <div class="prompt-chips">
      <?php foreach (Storybook::PROMPTS as $key => [$emoji, $label]): ?>
        <a class="prompt-chip <?= $prefill === $key ? 'is-active' : '' ?>" href="/dashboard/storybook?prompt=<?= $key ?>#write">
          <?= $emoji ?> <?= Str::e($label) ?>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<!-- Write ------------------------------------------------------------------ -->
<form method="post" enctype="multipart/form-data" class="card love-card mt-3" id="write">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="write">
  <input type="hidden" name="prompt_key" value="<?= Str::e($prefill) ?>">
  <div class="card-head">
    <h2><?= $prefill ? Str::e(Storybook::prompt($prefill)[0] . ' ' . Storybook::prompt($prefill)[1]) : 'Write a chapter' ?></h2>
  </div>
  <div class="card-body">
    <?php if ($prefill): ?>
      <p class="small muted"><?= Str::e(Storybook::prompt($prefill)[2]) ?></p>
    <?php endif; ?>
    <div class="field mt-2">
      <label for="title">Chapter title</label>
      <input class="input" id="title" name="title" maxlength="200"
             value="<?= $prefill ? Str::e(Storybook::prompt($prefill)[1]) : '' ?>" placeholder="Give it a title">
    </div>
    <div class="field">
      <label for="body">The words</label>
      <textarea class="textarea letter-writing" rows="10" id="body" name="body"
                placeholder="Write it the way you'd tell it…"></textarea>
      <span class="hint">Markdown works: **bold**, *italic*, and blank lines between paragraphs.</span>
    </div>
    <div class="field">
      <label for="image">A photo for this chapter <span class="muted">(optional)</span></label>
      <input class="input" type="file" id="image" name="image" accept="image/*" style="height:auto;padding:0.6rem">
    </div>
    <button class="btn btn-lg btn-block" type="submit">Add this chapter 📖</button>
  </div>
</form>

<!-- The book --------------------------------------------------------------- -->
<?php if ($chapters !== []): ?>
  <div class="storybook mt-3">
    <?php foreach ($chapters as $i => $chapter): ?>
      <article class="card chapter">
        <div class="card-body">
          <p class="chapter-num">Chapter <?= $i + 1 ?></p>
          <div class="row-between">
            <h2 class="chapter-title">
              <?php if ($chapter['prompt_key']): ?><?= Storybook::prompt($chapter['prompt_key'])[0] ?> <?php endif; ?>
              <?= Str::e($chapter['title']) ?>
            </h2>
            <form method="post" data-confirm="Delete this chapter?">
              <?= Csrf::field() ?>
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="id" value="<?= Str::e($chapter['id']) ?>">
              <button class="btn btn-sm btn-ghost" type="submit">×</button>
            </form>
          </div>
          <p class="tiny muted">by <?= Str::e($chapter['display_name'] ?: ($chapter['full_name'] ?? 'one of you')) ?>
            · <?= Str::e(Str::date($chapter['created_at'])) ?></p>

          <?php if ($chapter['image_path']): ?>
            <img class="chapter-photo mt-2" loading="lazy"
                 src="<?= Str::e(Storage::url($chapter['image_bucket'], $chapter['image_path'])) ?>"
                 alt="<?= Str::e($chapter['title']) ?>">
          <?php endif; ?>

          <?php if ($chapter['body']): ?>
            <div class="chapter-body mt-2"><?= Str::markdown($chapter['body']) ?></div>
          <?php endif; ?>
        </div>
      </article>
    <?php endforeach; ?>
    <p class="text-center muted small mt-2">— to be continued —</p>
  </div>
<?php else: ?>
  <div class="card mt-3"><div class="card-body">
    <p class="small muted">Your storybook is blank — the best kind of beginning. Pick a prompt above and write
      your first chapter. 📖</p>
  </div></div>
<?php endif; ?>

<?php View::end(); ?>
