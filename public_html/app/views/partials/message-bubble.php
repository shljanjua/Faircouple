<?php
/** One chat bubble. Also rendered server-side for the polling endpoint. */
$isMine = $message['sender_id'] === $meId;
$reactions = Str::json($message['reactions'] ?? null);
?>
<div class="bubble-row <?= $isMine ? 'is-mine' : '' ?>" id="msg-<?= Str::e($message['id']) ?>">
  <div style="max-width:100%">
    <div class="bubble">
      <?php if ($message['message_type'] === 'image' && $message['attachment_path']): ?>
        <?php $url = Storage::url('couple-media', $message['attachment_path']); ?>
        <a href="#" data-lightbox="<?= Str::e($url) ?>">
          <img src="<?= Str::e($url) ?>" alt="<?= Str::e($message['attachment_name'] ?: 'Shared photo') ?>" loading="lazy">
        </a>
      <?php else: ?>
        <span style="white-space:pre-wrap"><?= Str::e($message['body']) ?></span>
      <?php endif; ?>
    </div>

    <div class="bubble-meta">
      <?= Str::e(Str::timeAgo($message['created_at'])) ?>
      <?php if ($isMine && $message['read_at']): ?> · seen<?php endif; ?>

      <?php foreach (['❤️', '😂', '👍'] as $emoji): ?>
        <form method="post" style="display:inline">
          <?= Csrf::field() ?>
          <input type="hidden" name="action" value="react">
          <input type="hidden" name="id" value="<?= Str::e($message['id']) ?>">
          <input type="hidden" name="emoji" value="<?= Str::e($emoji) ?>">
          <button type="submit" style="border:0;background:none;padding:0 0.1rem;font-size:0.8rem"
                  aria-label="React <?= Str::e($emoji) ?>"><?= $emoji ?></button>
        </form>
      <?php endforeach; ?>

      <?php if ($isMine): ?>
        <form method="post" style="display:inline" data-confirm="Delete this message?">
          <?= Csrf::field() ?>
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="id" value="<?= Str::e($message['id']) ?>">
          <button type="submit" style="border:0;background:none;padding:0 0.1rem;font-size:0.75rem"
                  aria-label="Delete message">✕</button>
        </form>
      <?php endif; ?>
    </div>

    <?php if ($reactions !== []): ?>
      <div class="row" style="gap:0.25rem;<?= $isMine ? 'justify-content:flex-end' : '' ?>">
        <?php foreach ($reactions as $emoji => $people): ?>
          <span class="badge"><?= Str::e($emoji) ?> <?= count((array) $people) ?></span>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</div>
