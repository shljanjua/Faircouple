<?php
declare(strict_types=1);

/**
 * "Open when…" letters. One partner writes a letter for a moment — a bad day,
 * missing you, an argument — and the other opens it when that moment comes.
 * A letter stays sealed (body hidden) for its recipient until they open it.
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$partner  = $context['partner'];
$partnerId = $partner['user_id'] ?? null;

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'write') {
        if (!$partnerId) {
            Flash::error('Invite your partner first — a letter needs someone to open it.');
            Response::redirect('/dashboard/letters');
        }
        $occasion = Request::input('occasion');
        if (!isset(LoveCare::OCCASIONS[$occasion])) {
            Flash::error('Choose when this letter should be opened.');
            Response::redirect('/dashboard/letters');
        }
        $body = trim(Request::raw('body'));
        if ($body === '') {
            Flash::error('Write your letter first.');
            Response::redirect('/dashboard/letters');
        }

        Db::insert('open_when_letters', [
            'couple_id'    => $coupleId,
            'author_id'    => $user['id'],
            'recipient_id' => $partnerId,
            'occasion'     => $occasion,
            'title'        => Request::nullable('title'),
            'body'         => $body,
        ]);

        [$emoji, $label] = LoveCare::occasion($occasion);
        Audit::notify($partnerId, 'A sealed letter is waiting for you',
            'Open when ' . $label . '.', '/dashboard/letters', 'love', '💌', $coupleId);

        Flash::success('Sealed. 💌 It will be there when they need it.');
        Response::redirect('/dashboard/letters');
    }

    if ($action === 'open') {
        // Only the recipient can open, and only once (records the moment).
        $letter = Db::one('SELECT * FROM open_when_letters WHERE id = ? AND recipient_id = ? LIMIT 1',
            [Request::input('id'), $user['id']]);
        if ($letter && $letter['opened_at'] === null) {
            Db::run('UPDATE open_when_letters SET opened_at = UTC_TIMESTAMP() WHERE id = ?', [$letter['id']]);
            if ($letter['author_id']) {
                Audit::notify($letter['author_id'], 'Your letter was opened 💛',
                    'They opened “Open when ' . LoveCare::occasion($letter['occasion'])[1] . '”.',
                    '/dashboard/letters', 'love', '💌', $coupleId);
            }
        }
        Response::redirect('/dashboard/letters?opened=' . urlencode(Request::input('id')));
    }

    if ($action === 'delete') {
        // Only the author may delete, and only while still sealed.
        Db::delete('open_when_letters', 'id = ? AND author_id = ? AND opened_at IS NULL',
            [Request::input('id'), $user['id']]);
        Flash::success('Letter removed.');
        Response::redirect('/dashboard/letters');
    }
}

// Letters I wrote (to my partner) and letters written for me.
$written = Db::all(
    'SELECT * FROM open_when_letters WHERE couple_id = ? AND author_id = ? ORDER BY created_at DESC',
    [$coupleId, $user['id']]
);
$forMe = Db::all(
    'SELECT * FROM open_when_letters WHERE couple_id = ? AND recipient_id = ? ORDER BY opened_at IS NULL DESC, created_at DESC',
    [$coupleId, $user['id']]
);

$justOpenedId = (string) ($_GET['opened'] ?? '');
$partnerName = $partner['display_name'] ?? ($partner['full_name'] ?? 'your partner');

View::begin('layouts/app', ['title' => 'Open when… letters', 'no_index' => true]);
?>

<div class="page-head">
  <h1>💌 Open when…</h1>
  <p>Write a letter for a moment that hasn't happened yet. <?= Str::e(ucfirst($partnerName)) ?>
     opens it exactly when they need it — and stays sealed until then.</p>
</div>

<div class="grid grid-2 gap-lg">
  <!-- Write ---------------------------------------------------------------- -->
  <form method="post" class="card love-card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="write">
    <div class="card-head"><h2>Write a letter</h2></div>
    <div class="card-body">
      <div class="field">
        <label for="occasion">Open when…</label>
        <select class="select" id="occasion" name="occasion" required>
          <option value="">Choose the moment…</option>
          <?php foreach (LoveCare::OCCASIONS as $key => [$emoji, $label]): ?>
            <option value="<?= $key ?>"><?= $emoji ?>  <?= Str::e(ucfirst($label)) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label for="title">A line on the envelope <span class="muted">(optional)</span></label>
        <input class="input" id="title" name="title" maxlength="160" placeholder="Read me slowly…">
      </div>
      <div class="field">
        <label for="body">Your letter</label>
        <textarea class="textarea letter-writing" rows="9" id="body" name="body" required
                  placeholder="My love,&#10;&#10;If you're reading this, it means…"></textarea>
      </div>
      <button class="btn btn-lg btn-block" type="submit" <?= $partnerId ? '' : 'disabled' ?>>Seal this letter 💌</button>
      <?php if (!$partnerId): ?>
        <p class="tiny muted mt-2">Invite your partner from
          <a href="/dashboard/partner">Partner &amp; space</a> to start writing.</p>
      <?php endif; ?>
    </div>
  </form>

  <!-- For me --------------------------------------------------------------- -->
  <div class="card love-card">
    <div class="card-head"><h2>Letters for you</h2></div>
    <div class="card-body stack">
      <?php if ($forMe === []): ?>
        <p class="small muted">No letters waiting yet. When <?= Str::e($partnerName) ?> writes one,
          it appears here — sealed until the right moment.</p>
      <?php endif; ?>

      <?php foreach ($forMe as $letter): ?>
        <?php
        [$emoji, $label] = LoveCare::occasion($letter['occasion']);
        $isOpen = $letter['opened_at'] !== null;
        $justOpened = $letter['id'] === $justOpenedId;
        ?>
        <div class="letter <?= $isOpen ? 'is-open' : 'is-sealed' ?> <?= $justOpened ? 'just-opened' : '' ?>">
          <div class="letter-occasion"><span class="letter-emoji"><?= $emoji ?></span>
            Open when <?= Str::e($label) ?></div>

          <?php if ($isOpen): ?>
            <?php if ($letter['title']): ?><p class="letter-title"><?= Str::e($letter['title']) ?></p><?php endif; ?>
            <div class="letter-body"><?= Str::markdown($letter['body']) ?></div>
            <p class="tiny muted mt-2">Opened <?= Str::e(Str::timeAgo($letter['opened_at'])) ?></p>
          <?php else: ?>
            <p class="letter-sealed-note">A sealed letter from <?= Str::e($partnerName) ?>.
              Only open it when the moment is real.</p>
            <form method="post" data-confirm="Open this letter now? You can only do it once.">
              <?= Csrf::field() ?>
              <input type="hidden" name="action" value="open">
              <input type="hidden" name="id" value="<?= Str::e($letter['id']) ?>">
              <button class="btn btn-block" type="submit">💌 Open this letter</button>
            </form>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<!-- Letters I wrote --------------------------------------------------------- -->
<?php if ($written !== []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>Letters you've written (<?= count($written) ?>)</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Open when</th><th>Envelope</th><th>Status</th><th>Written</th><th></th></tr></thead>
        <tbody>
          <?php foreach ($written as $letter): ?>
            <tr>
              <td><?= LoveCare::occasion($letter['occasion'])[0] ?>
                  <?= Str::e(ucfirst(LoveCare::occasion($letter['occasion'])[1])) ?></td>
              <td class="small muted"><?= Str::e($letter['title'] ?: '—') ?></td>
              <td>
                <?php if ($letter['opened_at']): ?>
                  <span class="badge badge-success">opened</span>
                <?php else: ?>
                  <span class="badge badge-outline">sealed</span>
                <?php endif; ?>
              </td>
              <td class="small muted nowrap"><?= Str::e(Str::date($letter['created_at'])) ?></td>
              <td class="right">
                <?php if (!$letter['opened_at']): ?>
                  <form method="post" data-confirm="Delete this sealed letter?">
                    <?= Csrf::field() ?>
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="id" value="<?= Str::e($letter['id']) ?>">
                    <button class="btn btn-sm btn-ghost" type="submit">Delete</button>
                  </form>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
<?php endif; ?>

<?php View::end(); ?>
