<?php
declare(strict_types=1);

/**
 * The Love & Care hub — the warm, emotional home of the couple space.
 * Today's feeling and need, one-tap love notes, gratitude, the connection
 * streak and a warm summary, with links out to letters, Our Story and the
 * bucket list.
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$partner  = $context['partner'];
$partnerId = $partner['user_id'] ?? null;
$today    = Str::today();

if (Request::isPost()) {
    $action = Request::input('action');

    // ---- Set (or update) today's feeling + need --------------------------
    if ($action === 'mood') {
        $feeling = Request::input('feeling');
        if (!isset(LoveCare::FEELINGS[$feeling])) {
            Flash::error('Pick how you are feeling first.');
            Response::redirect('/dashboard/love');
        }
        $need = Request::input('need');
        $need = isset(LoveCare::NEEDS[$need]) ? $need : null;

        Db::run(
            'INSERT INTO love_moods (id, couple_id, user_id, mood_date, feeling, need, note)
             VALUES (?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE feeling = VALUES(feeling), need = VALUES(need), note = VALUES(note)',
            [Str::uuid(), $coupleId, $user['id'], $today, $feeling, $need, Request::nullable('note')]
        );

        if ($partnerId) {
            [$emoji, $label] = LoveCare::feeling($feeling);
            Audit::notify(
                $partnerId,
                trim(($context['me']['display_name'] ?? 'Your partner')) . " is feeling {$label} today",
                $need ? 'They could use ' . strtolower(LoveCare::need($need)[1]) . '.' : null,
                '/dashboard/love',
                'love',
                $emoji,
                $coupleId
            );
        }

        Flash::success('Shared with your partner. ' . LoveCare::feeling($feeling)[0]);
        Response::redirect('/dashboard/love');
    }

    // ---- Send a little love ---------------------------------------------
    if ($action === 'love_note') {
        if (!$partnerId) {
            Flash::error('Invite your partner first so there is someone to send love to.');
            Response::redirect('/dashboard/love');
        }
        $type = Request::input('note_type');
        if (!isset(LoveCare::NOTE_TYPES[$type])) {
            Flash::error('Pick something from the heart.');
            Response::redirect('/dashboard/love');
        }

        Db::insert('love_notes', [
            'couple_id'    => $coupleId,
            'sender_id'    => $user['id'],
            'recipient_id' => $partnerId,
            'note_type'    => $type,
            'message'      => Request::nullable('message'),
        ]);

        [$emoji, $label] = LoveCare::noteType($type);
        Audit::notify($partnerId, $label, Request::nullable('message'), '/dashboard/love', 'love', $emoji, $coupleId);

        Flash::success("Sent {$emoji}  “{$label}” is on its way.");
        Response::redirect('/dashboard/love');
    }

    // ---- Mark a received love note read ---------------------------------
    if ($action === 'read_note') {
        Db::run(
            'UPDATE love_notes SET is_read = 1, read_at = UTC_TIMESTAMP()
              WHERE id = ? AND recipient_id = ?',
            [Request::input('id'), $user['id']]
        );
        Response::redirect('/dashboard/love');
    }

    // ---- Add a gratitude ------------------------------------------------
    if ($action === 'gratitude') {
        $message = trim(Request::raw('message'));
        if ($message === '') {
            Flash::error('Write what you are grateful for first.');
            Response::redirect('/dashboard/love');
        }

        Db::insert('gratitude_notes', [
            'couple_id' => $coupleId,
            'user_id'   => $user['id'],
            'message'   => mb_substr($message, 0, 500),
        ]);

        if ($partnerId) {
            Audit::notify($partnerId, 'A note of gratitude for you', mb_substr($message, 0, 120),
                '/dashboard/love', 'love', '🌷', $coupleId);
        }

        Flash::success('Shared. 🌷');
        Response::redirect('/dashboard/love');
    }

    if ($action === 'gratitude_delete') {
        Db::delete('gratitude_notes', 'id = ? AND user_id = ?', [Request::input('id'), $user['id']]);
        Response::redirect('/dashboard/love');
    }
}

/* ------------------------------------------------------------------ Reading */

$myMood = Db::one('SELECT * FROM love_moods WHERE couple_id = ? AND user_id = ? AND mood_date = ? LIMIT 1',
    [$coupleId, $user['id'], $today]);

$partnerMood = $partnerId
    ? Db::one('SELECT * FROM love_moods WHERE couple_id = ? AND user_id = ? AND mood_date = ? LIMIT 1',
        [$coupleId, $partnerId, $today])
    : null;

$streak   = LoveCare::streak($coupleId);
$weather  = LoveCare::weather($coupleId);
$counts   = LoveCare::counts($coupleId);

$inbox = Db::all(
    'SELECT n.*, p.display_name, p.full_name FROM love_notes n
       LEFT JOIN profiles p ON p.id = n.sender_id
      WHERE n.couple_id = ? AND n.recipient_id = ?
      ORDER BY n.is_read ASC, n.created_at DESC LIMIT 12',
    [$coupleId, $user['id']]
);

$gratitude = Db::all(
    'SELECT g.*, p.display_name, p.full_name FROM gratitude_notes g
       LEFT JOIN profiles p ON p.id = g.user_id
      WHERE g.couple_id = ? ORDER BY g.created_at DESC LIMIT 8',
    [$coupleId]
);

$unopenedLetters = $partnerId
    ? Db::count('open_when_letters', 'couple_id = ? AND recipient_id = ? AND opened_at IS NULL', [$coupleId, $user['id']])
    : 0;

$meName = $context['me']['display_name'] ?: ($context['me']['full_name'] ?? 'You');
$partnerName = $partner['display_name'] ?? ($partner['full_name'] ?? 'Your partner');

View::begin('layouts/app', ['title' => 'Love & Care', 'no_index' => true]);
?>

<div class="love-hero">
  <p class="love-eyebrow"><?= Str::e(Str::date($today, 'l, j F')) ?></p>
  <h1>Your relationship today</h1>
  <div class="love-weather">
    <span class="love-weather-emoji"><?= $weather['emoji'] ?></span>
    <span>
      <span class="love-weather-label"><?= Str::e($weather['label']) ?></span>
      <span class="tiny muted" style="display:block">Relationship weather</span>
    </span>
  </div>
</div>

<div class="grid grid-4 mt-3">
  <div class="card stat love-stat">
    <p class="stat-value">🔥 <?= (int) $streak ?></p>
    <p class="stat-label">day connection streak</p>
  </div>
  <div class="card stat love-stat">
    <p class="stat-value">📸 <?= number_format($counts['memories']) ?></p>
    <p class="stat-label">shared memories</p>
  </div>
  <div class="card stat love-stat">
    <p class="stat-value">🌷 <?= number_format($counts['gratitude']) ?></p>
    <p class="stat-label">appreciations</p>
  </div>
  <div class="card stat love-stat">
    <p class="stat-value">💌 <?= number_format($counts['letters']) ?></p>
    <p class="stat-label">letters written</p>
  </div>
</div>

<!-- ---------------------------------------------------- Today's feeling -->
<div class="grid grid-2 gap-lg mt-3">
  <form method="post" class="card love-card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="mood">
    <div class="card-head"><h2>How are you feeling?</h2></div>
    <div class="card-body">
      <div class="feeling-grid">
        <?php foreach (LoveCare::FEELINGS as $key => [$emoji, $label]): ?>
          <label class="feeling-chip">
            <input type="radio" name="feeling" value="<?= $key ?>"
                   <?= ($myMood['feeling'] ?? '') === $key ? 'checked' : '' ?> required>
            <span class="feeling-emoji"><?= $emoji ?></span>
            <span class="feeling-label"><?= Str::e($label) ?></span>
          </label>
        <?php endforeach; ?>
      </div>

      <p class="side-heading mt-3">What do you need today?</p>
      <div class="need-grid">
        <?php foreach (LoveCare::NEEDS as $key => [$emoji, $label]): ?>
          <label class="need-chip">
            <input type="radio" name="need" value="<?= $key ?>"
                   <?= ($myMood['need'] ?? '') === $key ? 'checked' : '' ?>>
            <span><?= $emoji ?> <?= Str::e($label) ?></span>
          </label>
        <?php endforeach; ?>
      </div>

      <div class="field mt-3">
        <input class="input" name="note" maxlength="280" placeholder="Anything you want them to know? (optional)"
               value="<?= Str::e($myMood['note'] ?? '') ?>">
      </div>

      <button class="btn btn-lg btn-block mt-2" type="submit">
        <?= $myMood ? 'Update how I feel' : 'Share with ' . Str::e($partnerName) ?>
      </button>
    </div>
  </form>

  <div class="card love-card">
    <div class="card-head"><h2><?= Str::e($partnerName) ?> today</h2></div>
    <div class="card-body">
      <?php if ($partnerMood): ?>
        <div class="partner-feeling">
          <span class="partner-feeling-emoji"><?= LoveCare::feeling($partnerMood['feeling'])[0] ?></span>
          <div>
            <p class="bold">Feeling <?= Str::e(LoveCare::feeling($partnerMood['feeling'])[1]) ?></p>
            <?php if ($partnerMood['need']): ?>
              <p class="small">Needs <?= LoveCare::need($partnerMood['need'])[0] ?>
                <?= Str::e(strtolower(LoveCare::need($partnerMood['need'])[1])) ?></p>
            <?php endif; ?>
            <?php if ($partnerMood['note']): ?>
              <p class="small muted mt-1">“<?= Str::e($partnerMood['note']) ?>”</p>
            <?php endif; ?>
          </div>
        </div>
      <?php elseif (!$partnerId): ?>
        <p class="small muted">Invite your partner from
          <a href="/dashboard/partner">Partner &amp; space</a> and you'll both see how the
          other is doing here.</p>
      <?php else: ?>
        <p class="small muted"><?= Str::e($partnerName) ?> hasn't shared how they feel yet today.
          Why not send a little love below? 💛</p>
      <?php endif; ?>

      <hr class="divider">
      <p class="side-heading">Send a little love</p>
      <form method="post" class="love-send-grid">
        <?= Csrf::field() ?>
        <input type="hidden" name="action" value="love_note">
        <?php foreach (LoveCare::NOTE_TYPES as $key => [$emoji, $label]): ?>
          <button class="love-send-btn" type="submit" name="note_type" value="<?= $key ?>"
                  <?= $partnerId ? '' : 'disabled' ?> title="<?= Str::e($label) ?>">
            <span class="love-send-emoji"><?= $emoji ?></span>
            <span class="love-send-label"><?= Str::e($label) ?></span>
          </button>
        <?php endforeach; ?>
      </form>
    </div>
  </div>
</div>

<!-- ------------------------------------------------ Little love received -->
<?php if ($inbox !== []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>From <?= Str::e($partnerName) ?>'s heart</h2></div>
    <div class="card-body love-inbox">
      <?php foreach ($inbox as $note): ?>
        <div class="love-received <?= Str::bool($note['is_read']) ? '' : 'is-new' ?>">
          <span class="love-received-emoji"><?= LoveCare::noteType($note['note_type'])[0] ?></span>
          <div class="love-received-body">
            <span class="bold"><?= Str::e(LoveCare::noteType($note['note_type'])[1]) ?></span>
            <?php if ($note['message']): ?>
              <span class="small" style="display:block">“<?= Str::e($note['message']) ?>”</span>
            <?php endif; ?>
            <span class="tiny muted"><?= Str::e(Str::timeAgo($note['created_at'])) ?></span>
          </div>
          <?php if (!Str::bool($note['is_read'])): ?>
            <form method="post">
              <?= Csrf::field() ?>
              <input type="hidden" name="action" value="read_note">
              <input type="hidden" name="id" value="<?= Str::e($note['id']) ?>">
              <button class="btn btn-sm btn-ghost" type="submit">Got it ❤️</button>
            </form>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>

<!-- ------------------------------------------------------------ Gratitude -->
<div class="grid grid-2 gap-lg mt-3">
  <form method="post" class="card love-card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="gratitude">
    <div class="card-head"><h2>🌷 Grateful for you</h2></div>
    <div class="card-body">
      <div class="field">
        <label for="gratitude-msg">Today I'm grateful for you because…</label>
        <textarea class="textarea" rows="3" id="gratitude-msg" name="message" maxlength="500"
                  placeholder="…you made me laugh when I needed it."></textarea>
      </div>
      <button class="btn btn-block" type="submit">Share gratitude</button>
    </div>
  </form>

  <div class="card love-card">
    <div class="card-head"><h2>Recent gratitude</h2></div>
    <div class="card-body stack-sm">
      <?php if ($gratitude === []): ?>
        <p class="small muted">Nothing yet — be the first to say why you're grateful. 🌷</p>
      <?php endif; ?>
      <?php foreach ($gratitude as $note): ?>
        <div class="gratitude-note">
          <p class="small">“<?= Str::e($note['message']) ?>”</p>
          <p class="tiny muted">
            — <?= Str::e($note['user_id'] === $user['id'] ? 'You' : ($note['display_name'] ?: $partnerName)) ?>
            · <?= Str::e(Str::timeAgo($note['created_at'])) ?>
            <?php if ($note['user_id'] === $user['id']): ?>
              <form method="post" style="display:inline">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="gratitude_delete">
                <input type="hidden" name="id" value="<?= Str::e($note['id']) ?>">
                <button class="link-btn tiny" type="submit">remove</button>
              </form>
            <?php endif; ?>
          </p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<!-- --------------------------------------------------------- Jump-off cards -->
<div class="grid grid-3 gap-lg mt-3">
  <a class="card love-link-card" href="/dashboard/letters">
    <span class="love-link-emoji">💌</span>
    <span class="bold">Open when… letters</span>
    <span class="small muted">
      <?= $unopenedLetters > 0
          ? $unopenedLetters . ' waiting to be opened'
          : 'Write a letter for the right moment' ?>
    </span>
  </a>
  <a class="card love-link-card" href="/dashboard/story">
    <span class="love-link-emoji">💕</span>
    <span class="bold">Our Story</span>
    <span class="small muted"><?= $counts['memories'] ?> moments in your timeline</span>
  </a>
  <a class="card love-link-card" href="/dashboard/bucket">
    <span class="love-link-emoji">🌎</span>
    <span class="bold">Our bucket list</span>
    <span class="small muted"><?= $counts['bucket_done'] ?> / <?= $counts['bucket_total'] ?> done together</span>
  </a>
</div>

<?php View::end(); ?>
