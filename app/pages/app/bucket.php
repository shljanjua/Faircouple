<?php
declare(strict_types=1);

/**
 * Our bucket list — the things a couple wants to do together, with a warm
 * progress bar and gentle suggestions when it's empty.
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'add') {
        $title = trim(Request::input('title'));
        if ($title === '') {
            Flash::error('What would you like to do together?');
            Response::redirect('/dashboard/bucket');
        }
        $category = Request::input('category', 'experience');
        if (!isset(LoveCare::BUCKET_CATEGORIES[$category])) {
            $category = 'experience';
        }

        Db::insert('bucket_list_items', [
            'couple_id'  => $coupleId,
            'created_by' => $user['id'],
            'title'      => mb_substr($title, 0, 200),
            'category'   => $category,
            'emoji'      => LoveCare::BUCKET_CATEGORIES[$category][0],
        ]);

        Flash::success('Added to your list. 🌎');
        Response::redirect('/dashboard/bucket');
    }

    if ($action === 'add_suggestion') {
        $i = Request::int('i');
        $s = LoveCare::BUCKET_SUGGESTIONS[$i] ?? null;
        if ($s) {
            Db::insert('bucket_list_items', [
                'couple_id' => $coupleId, 'created_by' => $user['id'],
                'title' => $s[1], 'category' => $s[2], 'emoji' => $s[0],
            ]);
        }
        Response::redirect('/dashboard/bucket');
    }

    if ($action === 'toggle') {
        $item = Db::one('SELECT is_done FROM bucket_list_items WHERE id = ? AND couple_id = ? LIMIT 1',
            [Request::input('id'), $coupleId]);
        if ($item) {
            $done = !Str::bool($item['is_done']);
            Db::run('UPDATE bucket_list_items SET is_done = ?, done_at = ? WHERE id = ? AND couple_id = ?',
                [$done ? 1 : 0, $done ? Str::now() : null, Request::input('id'), $coupleId]);
            if ($done) {
                Audit::notify($context['partner']['user_id'] ?? '', 'You did it together! 🎉',
                    'Ticked off your bucket list.', '/dashboard/bucket', 'love', '✅', $coupleId);
            }
        }
        Response::redirect('/dashboard/bucket');
    }

    if ($action === 'delete') {
        Db::delete('bucket_list_items', 'id = ? AND couple_id = ?', [Request::input('id'), $coupleId]);
        Response::redirect('/dashboard/bucket');
    }
}

$items = Db::all(
    'SELECT * FROM bucket_list_items WHERE couple_id = ?
      ORDER BY is_done ASC, created_at DESC',
    [$coupleId]
);

$total = count($items);
$done  = 0;
foreach ($items as $item) {
    if (Str::bool($item['is_done'])) { $done++; }
}
$percent = $total > 0 ? (int) round($done / $total * 100) : 0;

View::begin('layouts/app', ['title' => 'Our bucket list', 'no_index' => true]);
?>

<div class="page-head">
  <h1>🌎 Things we want to do together</h1>
  <p>Dream a little. Add what you want to share, then tick them off — together.</p>
</div>

<div class="card love-card">
  <div class="card-body">
    <div class="row-between">
      <p class="bold"><?= $done ?> of <?= $total ?> done together</p>
      <p class="bold" style="color:hsl(var(--primary))"><?= $percent ?>%</p>
    </div>
    <?= View::meter($done, max(1, $total), 'primary') ?>
  </div>
</div>

<form method="post" class="card mt-3">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="add">
  <div class="card-body">
    <div class="field-row" style="align-items:flex-end">
      <div class="field" style="flex:2 1 16rem">
        <label for="title">Add something</label>
        <input class="input" id="title" name="title" required maxlength="200"
               placeholder="Watch the sunrise from a mountain">
      </div>
      <div class="field">
        <label for="category">Category</label>
        <select class="select" id="category" name="category">
          <?php foreach (LoveCare::BUCKET_CATEGORIES as $key => [$emoji, $label]): ?>
            <option value="<?= $key ?>"><?= $emoji ?>  <?= Str::e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <button class="btn" type="submit">Add</button>
    </div>
  </div>
</form>

<?php if ($items === []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>Need a spark?</h2></div>
    <div class="card-body">
      <div class="bucket-suggestions">
        <?php foreach (LoveCare::BUCKET_SUGGESTIONS as $i => $s): ?>
          <form method="post">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="add_suggestion">
            <input type="hidden" name="i" value="<?= $i ?>">
            <button class="bucket-suggestion" type="submit"><?= $s[0] ?> <?= Str::e($s[1]) ?> +</button>
          </form>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
<?php else: ?>
  <div class="card mt-3">
    <div class="card-body bucket-list">
      <?php foreach ($items as $item): ?>
        <div class="bucket-item <?= Str::bool($item['is_done']) ? 'is-done' : '' ?>">
          <form method="post" style="display:inline-flex">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="toggle">
            <input type="hidden" name="id" value="<?= Str::e($item['id']) ?>">
            <button class="bucket-check" type="submit" aria-label="Toggle done">
              <?= Str::bool($item['is_done']) ? '✅' : '⬜' ?>
            </button>
          </form>
          <span class="bucket-title">
            <span class="bucket-emoji"><?= Str::e($item['emoji'] ?: '⭐') ?></span>
            <?= Str::e($item['title']) ?>
            <?php if (Str::bool($item['is_done']) && $item['done_at']): ?>
              <span class="tiny muted">· done <?= Str::e(Str::date($item['done_at'])) ?></span>
            <?php endif; ?>
          </span>
          <form method="post" style="margin-left:auto">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= Str::e($item['id']) ?>">
            <button class="btn btn-sm btn-ghost" type="submit">×</button>
          </form>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>

<?php View::end(); ?>
