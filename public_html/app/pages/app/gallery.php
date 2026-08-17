<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

if (Request::isPost()) {
    $action = Request::input('action', 'upload');

    if ($action === 'delete') {
        $asset = Db::one('SELECT * FROM media_assets WHERE id = ? AND couple_id = ? LIMIT 1', [Request::input('id'), $coupleId]);
        if ($asset) {
            Db::delete('media_assets', 'id = ? AND couple_id = ?', [$asset['id'], $coupleId]);
            Storage::delete($asset['bucket'] ?: 'couple-media', $asset['path']);
            Flash::success('Deleted.');
        }
        Response::redirect('/dashboard/gallery');
    }

    if ($action === 'favourite') {
        Db::run(
            'UPDATE media_assets SET is_favorite = 1 - is_favorite WHERE id = ? AND couple_id = ?',
            [Request::input('id'), $coupleId]
        );
        Response::redirect('/dashboard/gallery');
    }

    // Uploading. Multiple files arrive in one request.
    $files = $_FILES['photos'] ?? null;
    if (!$files || empty($files['name'][0])) {
        Flash::error('Choose at least one photo.');
        Response::redirect('/dashboard/gallery');
    }

    $album = Request::nullable('album');
    $caption = Request::nullable('caption');
    $isPrivate = Request::bool('is_private');
    $uploaded = 0;

    foreach (array_keys($files['name']) as $index) {
        $file = [
            'name'     => $files['name'][$index],
            'type'     => $files['type'][$index],
            'tmp_name' => $files['tmp_name'][$index],
            'error'    => $files['error'][$index],
            'size'     => $files['size'][$index],
        ];

        if ($file['error'] === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        $quotaError = Plans::storageProblem($coupleId, (int) $file['size']);
        if ($quotaError !== null) {
            Flash::error($quotaError);
            break;
        }

        $stored = Storage::store($file, 'couple-media', $coupleId, $user['id'], 'photo');
        if (!$stored['ok']) {
            Flash::error($file['name'] . ': ' . $stored['error']);
            continue;
        }

        Db::insert('media_assets', [
            'couple_id'  => $coupleId,
            'user_id'    => $user['id'],
            'bucket'     => 'couple-media',
            'path'       => $stored['path'],
            'file_name'  => $stored['name'],
            'mime_type'  => $stored['mime'],
            'size_bytes' => $stored['size'],
            'kind'       => str_starts_with($stored['mime'], 'video') ? 'video' : 'photo',
            'album'      => $album,
            'caption'    => $caption,
            'is_private' => $isPrivate,
        ]);

        $uploaded++;
    }

    if ($uploaded > 0) {
        Flash::success($uploaded . ' file' . ($uploaded === 1 ? '' : 's') . ' uploaded.');
    }

    Response::redirect('/dashboard/gallery');
}

$album = trim((string) ($_GET['album'] ?? ''));

$where = 'couple_id = ? AND (is_private = 0 OR user_id = ?)';
$params = [$coupleId, $user['id']];

if ($album !== '') {
    $where .= ' AND album = ?';
    $params[] = $album;
}

$assets = Db::all(
    "SELECT * FROM media_assets WHERE {$where} ORDER BY created_at DESC LIMIT 400",
    $params
);

$albums = Db::all(
    'SELECT album, COUNT(*) AS total FROM media_assets
      WHERE couple_id = ? AND album IS NOT NULL AND album <> ""
      GROUP BY album ORDER BY album ASC',
    [$coupleId]
);

$quotaMb = Auth::entitlements()['limits']['storage_mb'];
$usedBytes = Plans::storageUsed($coupleId);

View::begin('layouts/app', ['title' => 'Photos', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Photos</h1>
  <p>
    Private to this space. Files sit outside the web root, and are served only after we check your session
    and that you are a member of this couple.
  </p>
</div>

<div class="grid grid-sidebar">
  <div class="stack">
    <?php if ($albums !== []): ?>
      <div class="tabs">
        <a href="/dashboard/gallery" class="<?= $album === '' ? 'is-active' : '' ?>">All</a>
        <?php foreach ($albums as $row): ?>
          <a href="/dashboard/gallery?album=<?= urlencode((string) $row['album']) ?>"
             class="<?= $album === $row['album'] ? 'is-active' : '' ?>">
            <?= Str::e($row['album']) ?> (<?= (int) $row['total'] ?>)
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <?php if ($assets === []): ?>
      <div class="card"><div class="card-body empty">
        <p class="empty-emoji">📷</p>
        <p class="bold">No photos yet</p>
        <p>Upload the ones you actually want to keep — trips, anniversaries, ordinary days.</p>
      </div></div>
    <?php else: ?>
      <div class="gallery">
        <?php foreach ($assets as $asset): ?>
          <?php $url = Storage::url('couple-media', $asset['path']); ?>
          <figure>
            <?php if (str_starts_with((string) $asset['mime_type'], 'video')): ?>
              <video src="<?= Str::e($url) ?>" controls preload="metadata"></video>
            <?php else: ?>
              <a href="#" data-lightbox="<?= Str::e($url) ?>" title="<?= Str::e($asset['caption'] ?: $asset['file_name']) ?>">
                <img src="<?= Str::e($url) ?>" alt="<?= Str::e($asset['caption'] ?: $asset['file_name']) ?>" loading="lazy">
              </a>
            <?php endif; ?>

            <div class="gallery-actions">
              <?php if (Str::bool($asset['is_private'])): ?>
                <span class="badge">🔒</span>
              <?php else: ?><span></span><?php endif; ?>

              <?php if ($asset['user_id'] === $user['id']): ?>
                <form method="post" data-confirm="Delete this photo permanently?">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= Str::e($asset['id']) ?>">
                  <button class="btn btn-sm btn-danger" type="submit" aria-label="Delete">✕</button>
                </form>
              <?php endif; ?>
            </div>
          </figure>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>

  <aside class="stack">
    <form method="post" enctype="multipart/form-data" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="upload">

      <div class="card-head"><h2>Upload</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="photos">Photos or videos</label>
          <input class="input" type="file" id="photos" name="photos[]" multiple
                 accept="image/*,video/mp4" required style="height:auto;padding:0.6rem">
          <span class="hint">Up to 25 MB each. JPEG, PNG, WebP, GIF, HEIC, MP4.</span>
        </div>

        <div class="field">
          <label for="album">Album</label>
          <input class="input" id="album" name="album" list="album-list" maxlength="100" placeholder="Italy 2026">
          <datalist id="album-list">
            <?php foreach ($albums as $row): ?>
              <option value="<?= Str::e($row['album']) ?>"></option>
            <?php endforeach; ?>
          </datalist>
        </div>

        <div class="field">
          <label for="caption">Caption</label>
          <input class="input" id="caption" name="caption" maxlength="200">
        </div>

        <label class="checkbox mt-2">
          <input type="checkbox" name="is_private" value="1">
          <span class="small muted">Private — only you can see these.</span>
        </label>

        <button class="btn btn-block mt-3" type="submit">Upload</button>
      </div>
    </form>

    <div class="card">
      <div class="card-body">
        <h2 style="font-size:1rem">Storage</h2>
        <?php if ((int) $quotaMb === -1): ?>
          <p class="small mt-2"><?= Str::e(number_format($usedBytes / 1048576, 1)) ?> MB used · unlimited</p>
        <?php else: ?>
          <p class="small mt-2">
            <?= Str::e(number_format($usedBytes / 1048576, 1)) ?> MB of <?= (int) $quotaMb ?> MB
          </p>
          <?php $percent = min(100, ($usedBytes / max(1, $quotaMb * 1048576)) * 100); ?>
          <?= View::meter($percent, 100, $percent > 85 ? 'danger' : ($percent > 60 ? 'warning' : 'primary')) ?>
          <?php if ($percent > 80): ?>
            <a class="btn btn-sm btn-outline btn-block mt-2" href="/pricing">Get more storage</a>
          <?php endif; ?>
        <?php endif; ?>
      </div>
    </div>
  </aside>
</div>

<?php View::end(); ?>
