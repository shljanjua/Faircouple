<?php
declare(strict_types=1);

/**
 * The guided conflict-repair flow. Start a repair for a disagreement; each
 * partner answers the same five steps for themselves; both sides are shown
 * together; and warm "repair together" gestures move it toward resolved.
 */

$user      = Auth::require();
$context   = Auth::requireCouple();
$coupleId  = $context['couple']['id'];
$partner   = $context['partner'];
$partnerId = $partner['user_id'] ?? null;

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'start') {
        $title = trim(Request::input('title'));
        if ($title === '') {
            Flash::error('Give this a short name so you can both find it.');
            Response::redirect('/dashboard/repair');
        }
        $id = Db::insert('conflict_repairs', [
            'couple_id'  => $coupleId,
            'started_by' => $user['id'],
            'title'      => mb_substr($title, 0, 200),
            'status'     => 'open',
        ]);
        Audit::notify($partnerId ?? '', 'Let\'s repair this 💙',
            'Your partner opened a repair: "' . $title . '".', '/dashboard/repair?id=' . $id, 'love', '💙', $coupleId);
        Flash::success('Repair started. Take your time with your side.');
        Response::redirect('/dashboard/repair?id=' . urlencode((string) $id));
    }

    // The rest act on a specific repair the couple owns.
    $repairId = Request::input('repair_id');
    $repair = Db::one('SELECT * FROM conflict_repairs WHERE id = ? AND couple_id = ? LIMIT 1', [$repairId, $coupleId]);
    if (!$repair) {
        Flash::error('That repair no longer exists.');
        Response::redirect('/dashboard/repair');
    }

    if ($action === 'reflect') {
        $fields = [];
        foreach (Repair::STEP_KEYS as $key) {
            $fields[$key] = Request::nullable($key);
        }
        Db::run(
            'INSERT INTO repair_reflections (id, repair_id, couple_id, user_id, what_happened, how_felt, what_needed, wish_understood, do_differently)
             VALUES (?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               what_happened = VALUES(what_happened), how_felt = VALUES(how_felt),
               what_needed = VALUES(what_needed), wish_understood = VALUES(wish_understood),
               do_differently = VALUES(do_differently)',
            [Str::uuid(), $repairId, $coupleId, $user['id'],
             $fields['what_happened'], $fields['how_felt'], $fields['what_needed'],
             $fields['wish_understood'], $fields['do_differently']]
        );
        Audit::notify($partnerId ?? '', 'They shared their side 💙',
            'Open the repair to read it and add yours.', '/dashboard/repair?id=' . $repairId, 'love', '💙', $coupleId);
        Flash::success('Your side is saved. 💙');
        Response::redirect('/dashboard/repair?id=' . urlencode($repairId));
    }

    if ($action === 'respond') {
        $type = Request::input('response_type');
        if (isset(Repair::RESPONSES[$type])) {
            Db::insert('repair_responses', [
                'repair_id' => $repairId, 'couple_id' => $coupleId,
                'user_id' => $user['id'], 'response_type' => $type,
            ]);
            [$emoji, $label] = Repair::response($type);
            Audit::notify($partnerId ?? '', $emoji . ' ' . $label, null,
                '/dashboard/repair?id=' . $repairId, 'love', $emoji, $coupleId);
        }
        Response::redirect('/dashboard/repair?id=' . urlencode($repairId));
    }

    if ($action === 'resolve') {
        Db::run('UPDATE conflict_repairs SET status = ?, resolved_at = UTC_TIMESTAMP() WHERE id = ? AND couple_id = ?',
            ['resolved', $repairId, $coupleId]);
        Audit::notify($partnerId ?? '', 'Repaired 💚', 'You marked a repair resolved together.',
            '/dashboard/repair?id=' . $repairId, 'love', '💚', $coupleId);
        Flash::success('Marked resolved. Well done — that\'s the hard part. 💚');
        Response::redirect('/dashboard/repair?id=' . urlencode($repairId));
    }

    if ($action === 'reopen') {
        Db::run('UPDATE conflict_repairs SET status = ?, resolved_at = NULL WHERE id = ? AND couple_id = ?',
            ['open', $repairId, $coupleId]);
        Response::redirect('/dashboard/repair?id=' . urlencode($repairId));
    }

    if ($action === 'delete') {
        Db::delete('conflict_repairs', 'id = ? AND couple_id = ?', [$repairId, $coupleId]);
        Flash::success('Repair removed.');
        Response::redirect('/dashboard/repair');
    }
}

$repairs = Db::all('SELECT * FROM conflict_repairs WHERE couple_id = ? ORDER BY status = "open" DESC, created_at DESC LIMIT 40',
    [$coupleId]);

// The active repair: from ?id, else the most recent open one.
$activeId = (string) ($_GET['id'] ?? '');
$active = null;
if ($activeId !== '') {
    foreach ($repairs as $r) { if ($r['id'] === $activeId) { $active = $r; break; } }
} else {
    foreach ($repairs as $r) { if ($r['status'] === 'open') { $active = $r; break; } }
}

$mine = null;
$theirs = null;
$responses = [];
if ($active) {
    $mine = Db::one('SELECT * FROM repair_reflections WHERE repair_id = ? AND user_id = ? LIMIT 1', [$active['id'], $user['id']]);
    if ($partnerId) {
        $theirs = Db::one('SELECT * FROM repair_reflections WHERE repair_id = ? AND user_id = ? LIMIT 1', [$active['id'], $partnerId]);
    }
    $responses = Db::all(
        'SELECT r.*, p.display_name, p.full_name FROM repair_responses r
           LEFT JOIN profiles p ON p.id = r.user_id
          WHERE r.repair_id = ? ORDER BY r.created_at ASC', [$active['id']]);
}

$partnerName = $partner['display_name'] ?? ($partner['full_name'] ?? 'Your partner');

View::begin('layouts/app', ['title' => 'Repair together', 'no_index' => true]);
?>

<div class="page-head">
  <h1>💙 Let's repair this</h1>
  <p>A calm, structured way through a disagreement. You each answer the same five steps for yourself,
     then read both sides. Not to win — to understand.</p>
</div>

<div class="grid grid-3 gap-lg">
  <!-- Sidebar: start + list ------------------------------------------------ -->
  <div style="grid-column:span 1">
    <form method="post" class="card love-card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="start">
      <div class="card-head"><h2>New repair</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="title">What's it about?</label>
          <input class="input" id="title" name="title" required maxlength="200" placeholder="The weekend plans">
        </div>
        <button class="btn btn-block" type="submit" <?= $partnerId ? '' : 'disabled' ?>>Start a repair</button>
        <?php if (!$partnerId): ?>
          <p class="tiny muted mt-2">Invite your partner first.</p>
        <?php endif; ?>
      </div>
    </form>

    <?php if ($repairs !== []): ?>
      <div class="card mt-3">
        <div class="card-head"><h2>Repairs</h2></div>
        <div class="card-body stack-sm">
          <?php foreach ($repairs as $r): ?>
            <a class="repair-item <?= $active && $r['id'] === $active['id'] ? 'is-active' : '' ?>"
               href="/dashboard/repair?id=<?= Str::e($r['id']) ?>">
              <span class="repair-item-title"><?= Str::e($r['title']) ?></span>
              <span class="badge badge-<?= $r['status'] === 'resolved' ? 'success' : 'outline' ?>"><?= Str::e($r['status']) ?></span>
            </a>
          <?php endforeach; ?>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <!-- Main: the active repair ---------------------------------------------- -->
  <div style="grid-column:span 2">
    <?php if (!$active): ?>
      <div class="card"><div class="card-body">
        <p class="small muted">No repair open. When something's come up between you, start one on the left —
          it's easier to sort out with a little structure. 💙</p>
      </div></div>
    <?php else: ?>
      <div class="card">
        <div class="card-head">
          <h2><?= Str::e($active['title']) ?></h2>
          <span class="badge badge-<?= $active['status'] === 'resolved' ? 'success' : 'outline' ?>"><?= Str::e($active['status']) ?></span>
        </div>
        <div class="card-body">
          <!-- Both sides -->
          <div class="grid grid-2 gap-lg">
            <div>
              <p class="side-heading">Their side</p>
              <?php if ($theirs): ?>
                <?php foreach (Repair::STEPS as $key => [$label]): ?>
                  <?php if (trim((string) ($theirs[$key] ?? '')) !== ''): ?>
                    <div class="repair-answer">
                      <p class="repair-q"><?= Str::e($label) ?></p>
                      <p class="repair-a"><?= Str::e($theirs[$key]) ?></p>
                    </div>
                  <?php endif; ?>
                <?php endforeach; ?>
                <?php if (Repair::completion($theirs) === 0): ?>
                  <p class="small muted"><?= Str::e($partnerName) ?> hasn't written their side yet.</p>
                <?php endif; ?>
              <?php else: ?>
                <p class="small muted"><?= Str::e($partnerName) ?> hasn't opened this yet. Your side stays here waiting.</p>
              <?php endif; ?>
            </div>

            <!-- Your side (editable) -->
            <form method="post">
              <?= Csrf::field() ?>
              <input type="hidden" name="action" value="reflect">
              <input type="hidden" name="repair_id" value="<?= Str::e($active['id']) ?>">
              <p class="side-heading">Your side</p>
              <?php foreach (Repair::STEPS as $key => [$label, $prompt, $placeholder]): ?>
                <div class="field">
                  <label for="r-<?= $key ?>"><?= Str::e($label) ?></label>
                  <textarea class="textarea" rows="2" id="r-<?= $key ?>" name="<?= $key ?>"
                            placeholder="<?= Str::e($placeholder) ?>"><?= Str::e($mine[$key] ?? '') ?></textarea>
                  <span class="hint"><?= Str::e($prompt) ?></span>
                </div>
              <?php endforeach; ?>
              <button class="btn btn-block" type="submit">Save my side 💙</button>
            </form>
          </div>

          <hr class="divider">

          <!-- Repair together gestures -->
          <p class="side-heading">Repair together</p>
          <form method="post" class="repair-gestures">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="respond">
            <input type="hidden" name="repair_id" value="<?= Str::e($active['id']) ?>">
            <?php foreach (Repair::RESPONSES as $key => [$emoji, $label]): ?>
              <button class="repair-gesture" type="submit" name="response_type" value="<?= $key ?>">
                <?= $emoji ?> <?= Str::e($label) ?>
              </button>
            <?php endforeach; ?>
          </form>

          <?php if ($responses !== []): ?>
            <div class="repair-log mt-2">
              <?php foreach ($responses as $resp): ?>
                <?php [$emoji, $label] = Repair::response($resp['response_type']); ?>
                <span class="repair-log-item">
                  <?= $emoji ?> <strong><?= Str::e($resp['user_id'] === $user['id'] ? 'You' : ($resp['display_name'] ?: $partnerName)) ?></strong>
                  <?= Str::e(strtolower($label)) ?> · <?= Str::e(Str::timeAgo($resp['created_at'])) ?>
                </span>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>

          <div class="row mt-3">
            <?php if ($active['status'] === 'open'): ?>
              <form method="post">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="resolve">
                <input type="hidden" name="repair_id" value="<?= Str::e($active['id']) ?>">
                <button class="btn" type="submit">💚 Mark resolved together</button>
              </form>
            <?php else: ?>
              <form method="post">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="reopen">
                <input type="hidden" name="repair_id" value="<?= Str::e($active['id']) ?>">
                <button class="btn btn-outline" type="submit">Reopen</button>
              </form>
            <?php endif; ?>
            <form method="post" data-confirm="Delete this repair for both of you?">
              <?= Csrf::field() ?>
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="repair_id" value="<?= Str::e($active['id']) ?>">
              <button class="btn btn-ghost" type="submit">Delete</button>
            </form>
          </div>
        </div>
      </div>
    <?php endif; ?>
  </div>
</div>

<?php View::end(); ?>
