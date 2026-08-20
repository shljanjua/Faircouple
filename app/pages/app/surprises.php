<?php
declare(strict_types=1);

/**
 * Surprise Mode. One partner writes something and schedules it; it stays sealed
 * for the recipient until the reveal time, then unlocks. The recipient never
 * sees the content — not even server-side — until it is revealable.
 */

$user      = Auth::require();
$context   = Auth::requireCouple();
$coupleId  = $context['couple']['id'];
$partner   = $context['partner'];
$partnerId = $partner['user_id'] ?? null;

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'create') {
        if (!$partnerId) {
            Flash::error('Invite your partner first — a surprise needs someone to surprise.');
            Response::redirect('/dashboard/surprises');
        }
        $type = Request::input('surprise_type');
        if (!isset(Surprises::TYPES[$type])) {
            Flash::error('Choose a kind of surprise.');
            Response::redirect('/dashboard/surprises');
        }

        // Parse the datetime-local value; must be in the future.
        $raw = str_replace('T', ' ', Request::input('reveal_at'));
        $ts = $raw !== '' ? strtotime($raw) : false;
        if ($ts === false || $ts <= time()) {
            Flash::error('Pick a reveal time in the future.');
            Response::redirect('/dashboard/surprises');
        }
        $revealAt = date('Y-m-d H:i:s', $ts);

        $message = trim(Request::raw('message'));
        $imageBucket = null;
        $imagePath = null;
        if (!empty($_FILES['image']['name'])) {
            $stored = Storage::store($_FILES['image'], 'couple-media', $coupleId, $user['id'], 'surprise');
            if ($stored['ok']) {
                $imageBucket = 'couple-media';
                $imagePath = $stored['path'];
            } else {
                Flash::error($stored['error']);
                Response::redirect('/dashboard/surprises');
            }
        }

        if ($message === '' && $imagePath === null) {
            Flash::error('Add a message or a photo to your surprise.');
            Response::redirect('/dashboard/surprises');
        }

        Db::insert('surprises', [
            'couple_id'     => $coupleId,
            'sender_id'     => $user['id'],
            'recipient_id'  => $partnerId,
            'surprise_type' => $type,
            'title'         => Request::nullable('title'),
            'message'       => $message !== '' ? $message : null,
            'image_bucket'  => $imageBucket,
            'image_path'    => $imagePath,
            'reveal_at'     => $revealAt,
        ]);

        Audit::notify($partnerId, 'A surprise is on its way 🎁',
            'Something will reveal itself on ' . Str::dateTime($revealAt) . '.',
            '/dashboard/surprises', 'love', '🎁', $coupleId);

        Flash::success('Sealed and scheduled. 🎁 They\'ll get it at the right moment.');
        Response::redirect('/dashboard/surprises');
    }

    if ($action === 'open') {
        $surprise = Db::one('SELECT * FROM surprises WHERE id = ? AND recipient_id = ? LIMIT 1',
            [Request::input('id'), $user['id']]);
        // Only openable once the reveal time has arrived (server-enforced).
        if ($surprise && Surprises::isRevealable($surprise)) {
            if ($surprise['opened_at'] === null) {
                Db::run('UPDATE surprises SET opened_at = UTC_TIMESTAMP() WHERE id = ?', [$surprise['id']]);
                Audit::notify($surprise['sender_id'], 'They opened your surprise 💛',
                    'Your surprise was just revealed.', '/dashboard/surprises', 'love', '🎁', $coupleId);
            }
        }
        Response::redirect('/dashboard/surprises?opened=' . urlencode(Request::input('id')));
    }

    if ($action === 'delete') {
        // The sender may delete their own surprise (e.g. before it reveals).
        $surprise = Db::one('SELECT * FROM surprises WHERE id = ? AND sender_id = ? LIMIT 1',
            [Request::input('id'), $user['id']]);
        if ($surprise) {
            if ($surprise['image_path']) {
                Storage::delete((string) $surprise['image_bucket'], (string) $surprise['image_path']);
            }
            Db::delete('surprises', 'id = ?', [$surprise['id']]);
            Flash::success('Surprise removed.');
        }
        Response::redirect('/dashboard/surprises');
    }
}

// Surprises FOR me — never select the content of a still-sealed one is fine to
// load, but the view only renders content when it's revealable.
$forMe = $partnerId
    ? Db::all('SELECT * FROM surprises WHERE couple_id = ? AND recipient_id = ? ORDER BY reveal_at ASC', [$coupleId, $user['id']])
    : [];

$sent = Db::all('SELECT * FROM surprises WHERE couple_id = ? AND sender_id = ? ORDER BY reveal_at DESC LIMIT 30',
    [$coupleId, $user['id']]);

$justOpened = (string) ($_GET['opened'] ?? '');
$partnerName = $partner['display_name'] ?? ($partner['full_name'] ?? 'your partner');
$defaultReveal = date('Y-m-d\TH:i', time() + 86400);

View::begin('layouts/app', ['title' => 'Surprises', 'no_index' => true]);
?>

<div class="page-head">
  <h1>🎁 Surprise mode</h1>
  <p>Write something now, schedule it for later. It stays sealed for <?= Str::e($partnerName) ?>
     until the moment you choose.</p>
</div>

<div class="grid grid-2 gap-lg">
  <!-- Create --------------------------------------------------------------- -->
  <form method="post" enctype="multipart/form-data" class="card love-card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="create">
    <div class="card-head"><h2>Create a surprise</h2></div>
    <div class="card-body">
      <div class="field">
        <label>Kind of surprise</label>
        <div class="surprise-types">
          <?php foreach (Surprises::TYPES as $key => [$emoji, $label]): ?>
            <label class="surprise-type">
              <input type="radio" name="surprise_type" value="<?= $key ?>" <?= $key === 'love_letter' ? 'checked' : '' ?> required>
              <span class="surprise-type-emoji"><?= $emoji ?></span>
              <span class="surprise-type-label"><?= Str::e($label) ?></span>
            </label>
          <?php endforeach; ?>
        </div>
      </div>
      <div class="field">
        <label for="title">A line on the outside <span class="muted">(optional)</span></label>
        <input class="input" id="title" name="title" maxlength="200" placeholder="For you, when it's time…">
      </div>
      <div class="field">
        <label for="message">Your message</label>
        <textarea class="textarea letter-writing" rows="6" id="message" name="message"
                  placeholder="Write what you want them to find…"></textarea>
      </div>
      <div class="field">
        <label for="image">Add a photo <span class="muted">(optional)</span></label>
        <input class="input" type="file" id="image" name="image" accept="image/*" style="height:auto;padding:0.6rem">
      </div>
      <div class="field">
        <label for="reveal_at">Reveal at</label>
        <input class="input" type="datetime-local" id="reveal_at" name="reveal_at" required
               value="<?= Str::e($defaultReveal) ?>">
      </div>
      <button class="btn btn-lg btn-block" type="submit" <?= $partnerId ? '' : 'disabled' ?>>Seal &amp; schedule 🎁</button>
    </div>
  </form>

  <!-- For me --------------------------------------------------------------- -->
  <div class="card love-card">
    <div class="card-head"><h2>For you</h2></div>
    <div class="card-body stack">
      <?php if ($forMe === []): ?>
        <p class="small muted">No surprises waiting… that you know of. 😌</p>
      <?php endif; ?>

      <?php foreach ($forMe as $surprise): ?>
        <?php
        [$emoji, $label, $hint] = Surprises::meta($surprise['surprise_type']);
        $revealable = Surprises::isRevealable($surprise);
        $opened = $surprise['opened_at'] !== null;
        $just = $surprise['id'] === $justOpened;
        ?>
        <div class="surprise <?= $revealable ? 'is-open' : 'is-sealed' ?> <?= $just ? 'just-opened' : '' ?>">
          <?php if (!$revealable): ?>
            <!-- SEALED: no content is rendered, only the teaser + countdown. -->
            <div class="surprise-sealed">
              <span class="surprise-lock">🔒</span>
              <div>
                <p class="bold"><?= $emoji ?> A surprise is waiting</p>
                <p class="small muted"><?= Str::e($hint) ?></p>
                <p class="tiny">Reveals in <strong><?= Str::e(Surprises::countdown($surprise)) ?></strong>
                  · <?= Str::e(Str::dateTime($surprise['reveal_at'])) ?></p>
              </div>
            </div>
          <?php elseif (!$opened): ?>
            <div class="surprise-ready">
              <p class="bold"><?= $emoji ?> <?= Str::e($label) ?> — ready for you</p>
              <?php if ($surprise['title']): ?><p class="small muted">“<?= Str::e($surprise['title']) ?>”</p><?php endif; ?>
              <form method="post" class="mt-2">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="open">
                <input type="hidden" name="id" value="<?= Str::e($surprise['id']) ?>">
                <button class="btn btn-block" type="submit"><?= $emoji ?> Open it</button>
              </form>
            </div>
          <?php else: ?>
            <div class="surprise-revealed">
              <p class="bold"><?= $emoji ?> <?= Str::e($surprise['title'] ?: $label) ?></p>
              <?php if ($surprise['image_path']): ?>
                <img class="surprise-photo" loading="lazy"
                     src="<?= Str::e(Storage::url($surprise['image_bucket'], $surprise['image_path'])) ?>" alt="">
              <?php endif; ?>
              <?php if ($surprise['message']): ?>
                <div class="letter-body mt-1"><?= Str::markdown($surprise['message']) ?></div>
              <?php endif; ?>
              <p class="tiny muted mt-1">Opened <?= Str::e(Str::timeAgo($surprise['opened_at'])) ?></p>
            </div>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<!-- Sent by me -------------------------------------------------------------- -->
<?php if ($sent !== []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>Surprises you've sent</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Kind</th><th>Line</th><th>Reveals</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <?php foreach ($sent as $surprise): ?>
            <?php [$emoji, $label] = Surprises::meta($surprise['surprise_type']); ?>
            <tr>
              <td><?= $emoji ?> <?= Str::e($label) ?></td>
              <td class="small muted"><?= Str::e($surprise['title'] ?: '—') ?></td>
              <td class="small muted nowrap"><?= Str::e(Str::dateTime($surprise['reveal_at'])) ?></td>
              <td>
                <?php if ($surprise['opened_at']): ?>
                  <span class="badge badge-success">opened</span>
                <?php elseif (Surprises::isRevealable($surprise)): ?>
                  <span class="badge badge-primary">ready</span>
                <?php else: ?>
                  <span class="badge badge-outline">sealed</span>
                <?php endif; ?>
              </td>
              <td class="right">
                <form method="post" data-confirm="Delete this surprise?">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= Str::e($surprise['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit">×</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
<?php endif; ?>

<?php View::end(); ?>
