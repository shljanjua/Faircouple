<?php
declare(strict_types=1);

/**
 * Voice notes — recorded in the browser (MediaRecorder), stored in the private
 * couple-media area and played back only through the membership-checked
 * streamer. More intimate than text.
 */

$user      = Auth::require();
$context   = Auth::requireCouple();
$coupleId  = $context['couple']['id'];
$partner   = $context['partner'];
$partnerId = $partner['user_id'] ?? null;

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'record') {
        if (!$partnerId) {
            Response::json(['ok' => false, 'error' => 'Invite your partner first.'], 422);
        }
        if (empty($_FILES['audio']['name'])) {
            Response::json(['ok' => false, 'error' => 'No recording arrived.'], 422);
        }

        $stored = Storage::store($_FILES['audio'], 'couple-media', $coupleId, $user['id'], 'voice');
        if (!$stored['ok']) {
            Response::json(['ok' => false, 'error' => $stored['error']], 422);
        }

        Db::insert('voice_notes', [
            'couple_id'        => $coupleId,
            'sender_id'        => $user['id'],
            'recipient_id'     => $partnerId,
            'title'            => Request::nullable('title'),
            'audio_bucket'     => 'couple-media',
            'audio_path'       => $stored['path'],
            'audio_mime'       => $stored['mime'],
            'duration_seconds' => Request::int('duration') ?: null,
        ]);

        Audit::notify($partnerId, 'A voice note for you 🎙️',
            Request::nullable('title'), '/dashboard/voice-notes', 'love', '🎙️', $coupleId);

        Response::json(['ok' => true]);
    }

    if ($action === 'read') {
        Db::run('UPDATE voice_notes SET is_read = 1, read_at = UTC_TIMESTAMP() WHERE id = ? AND recipient_id = ?',
            [Request::input('id'), $user['id']]);
        Response::redirect('/dashboard/voice-notes');
    }

    if ($action === 'delete') {
        $note = Db::one('SELECT * FROM voice_notes WHERE id = ? AND couple_id = ? AND sender_id = ? LIMIT 1',
            [Request::input('id'), $coupleId, $user['id']]);
        if ($note) {
            Storage::delete((string) $note['audio_bucket'], (string) $note['audio_path']);
            Db::delete('voice_notes', 'id = ?', [$note['id']]);
            Flash::success('Voice note deleted.');
        }
        Response::redirect('/dashboard/voice-notes');
    }
}

$received = $partnerId
    ? Db::all('SELECT * FROM voice_notes WHERE couple_id = ? AND recipient_id = ? ORDER BY created_at DESC LIMIT 40', [$coupleId, $user['id']])
    : [];
$sent = Db::all('SELECT * FROM voice_notes WHERE couple_id = ? AND sender_id = ? ORDER BY created_at DESC LIMIT 40', [$coupleId, $user['id']]);

$partnerName = $partner['display_name'] ?? ($partner['full_name'] ?? 'your partner');

$fmtDuration = static function ($s): string {
    $s = (int) $s;
    return $s > 0 ? sprintf('%d:%02d', intdiv($s, 60), $s % 60) : '';
};

View::begin('layouts/app', ['title' => 'Voice notes', 'no_index' => true]);
?>

<div class="page-head">
  <h1>🎙️ Voice notes</h1>
  <p>Say it, don't type it. Record a little message for <?= Str::e($partnerName) ?> — a good-morning, an
     I-miss-you, a laugh.</p>
</div>

<div class="card love-card" id="recorder"<?= $partnerId ? '' : ' hidden' ?>>
  <div class="card-head"><h2>Record a note</h2></div>
  <div class="card-body">
    <div class="field">
      <label for="vn-title">A little label <span class="muted">(optional)</span></label>
      <input class="input" id="vn-title" maxlength="200" placeholder="Good morning 🌅">
    </div>

    <div class="voice-recorder">
      <button type="button" class="btn btn-lg" id="vn-record">● Record</button>
      <button type="button" class="btn btn-lg btn-danger" id="vn-stop" hidden>■ Stop</button>
      <span class="voice-timer" id="vn-timer" hidden>0:00</span>
    </div>

    <div id="vn-preview" hidden class="mt-3">
      <audio id="vn-audio" controls class="voice-audio"></audio>
      <div class="row mt-2">
        <button type="button" class="btn" id="vn-send">Send to <?= Str::e($partnerName) ?> 🎙️</button>
        <button type="button" class="btn btn-ghost" id="vn-discard">Discard</button>
      </div>
    </div>

    <p class="hint mt-2" id="vn-hint">Your browser will ask for microphone access the first time.</p>
  </div>
</div>

<?php if (!$partnerId): ?>
  <div class="card"><div class="card-body"><p class="small muted">Invite your partner from
    <a href="/dashboard/partner">Partner &amp; space</a> to leave them a voice note.</p></div></div>
<?php endif; ?>

<!-- Received --------------------------------------------------------------- -->
<div class="card mt-3">
  <div class="card-head"><h2>From <?= Str::e($partnerName) ?></h2></div>
  <div class="card-body stack-sm">
    <?php if ($received === []): ?>
      <p class="small muted">No voice notes yet.</p>
    <?php endif; ?>
    <?php foreach ($received as $note): ?>
      <div class="voice-note <?= Str::bool($note['is_read']) ? '' : 'is-new' ?>">
        <span class="voice-note-icon">🎙️</span>
        <div class="voice-note-body">
          <span class="bold small"><?= Str::e($note['title'] ?: 'Voice note') ?>
            <?php if ($d = $fmtDuration($note['duration_seconds'])): ?><span class="tiny muted">· <?= $d ?></span><?php endif; ?>
          </span>
          <audio controls preload="none" class="voice-audio"
                 src="<?= Str::e(Storage::url($note['audio_bucket'], $note['audio_path'])) ?>"></audio>
          <span class="tiny muted"><?= Str::e(Str::timeAgo($note['created_at'])) ?></span>
        </div>
        <?php if (!Str::bool($note['is_read'])): ?>
          <form method="post">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="read">
            <input type="hidden" name="id" value="<?= Str::e($note['id']) ?>">
            <button class="btn btn-sm btn-ghost" type="submit">Heard it ❤️</button>
          </form>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  </div>
</div>

<!-- Sent ------------------------------------------------------------------- -->
<?php if ($sent !== []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>You sent</h2></div>
    <div class="card-body stack-sm">
      <?php foreach ($sent as $note): ?>
        <div class="voice-note">
          <span class="voice-note-icon">🎙️</span>
          <div class="voice-note-body">
            <span class="bold small"><?= Str::e($note['title'] ?: 'Voice note') ?>
              <?php if ($d = $fmtDuration($note['duration_seconds'])): ?><span class="tiny muted">· <?= $d ?></span><?php endif; ?>
              <?php if (Str::bool($note['is_read'])): ?><span class="badge badge-success">heard</span><?php endif; ?>
            </span>
            <audio controls preload="none" class="voice-audio"
                   src="<?= Str::e(Storage::url($note['audio_bucket'], $note['audio_path'])) ?>"></audio>
          </div>
          <form method="post" data-confirm="Delete this voice note?">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= Str::e($note['id']) ?>">
            <button class="btn btn-sm btn-ghost" type="submit">×</button>
          </form>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>

<script>
(function () {
  var recordBtn = document.getElementById('vn-record');
  if (!recordBtn) return;
  var stopBtn = document.getElementById('vn-stop');
  var timerEl = document.getElementById('vn-timer');
  var preview = document.getElementById('vn-preview');
  var audioEl = document.getElementById('vn-audio');
  var sendBtn = document.getElementById('vn-send');
  var discardBtn = document.getElementById('vn-discard');
  var hint = document.getElementById('vn-hint');
  var titleInput = document.getElementById('vn-title');

  if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
    hint.textContent = 'Recording is not supported in this browser — try Chrome, Edge, Firefox or Safari.';
    recordBtn.disabled = true;
    return;
  }

  var mediaRecorder, chunks = [], blob = null, startedAt = 0, timerId = null, seconds = 0, ext = 'webm';

  function pickType() {
    var candidates = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    for (var i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return '';
  }

  function tick() {
    seconds = Math.round((Date.now() - startedAt) / 1000);
    var m = Math.floor(seconds / 60), s = seconds % 60;
    timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    if (seconds >= 300) stop(); // 5-minute cap
  }

  recordBtn.addEventListener('click', function () {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      chunks = [];
      var type = pickType();
      ext = type.indexOf('ogg') > -1 ? 'ogg' : (type.indexOf('mp4') > -1 ? 'm4a' : 'webm');
      mediaRecorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
      mediaRecorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = function () {
        blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        audioEl.src = URL.createObjectURL(blob);
        preview.hidden = false;
        stream.getTracks().forEach(function (t) { t.stop(); });
      };
      mediaRecorder.start();
      startedAt = Date.now(); seconds = 0;
      timerId = setInterval(tick, 500); tick();
      recordBtn.hidden = true; stopBtn.hidden = false; timerEl.hidden = false; preview.hidden = true;
      hint.textContent = 'Recording… tap stop when you\'re done.';
    }).catch(function () {
      hint.textContent = 'Microphone access was blocked. Allow it in your browser to record.';
    });
  });

  function stop() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    clearInterval(timerId);
    recordBtn.hidden = false; stopBtn.hidden = true;
  }
  stopBtn.addEventListener('click', stop);

  discardBtn.addEventListener('click', function () {
    blob = null; preview.hidden = true; timerEl.hidden = true; hint.textContent = 'Discarded. Record again whenever.';
  });

  sendBtn.addEventListener('click', function () {
    if (!blob) return;
    sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
    var fd = new FormData();
    fd.append('_token', <?= json_encode(Csrf::token()) ?>);
    fd.append('action', 'record');
    fd.append('title', titleInput.value || '');
    fd.append('duration', String(seconds));
    fd.append('audio', blob, 'voice.' + ext);
    fetch('/dashboard/voice-notes', { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok) { window.location.reload(); }
        else { hint.textContent = (data && data.error) || 'Could not send. Try again.'; sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
      })
      .catch(function () { hint.textContent = 'Could not send. Try again.'; sendBtn.disabled = false; sendBtn.textContent = 'Send'; });
  });
})();
</script>

<?php View::end(); ?>
