<?php $messages = Flash::take(); ?>
<?php if ($messages !== []): ?>
  <div class="stack-sm mb-2" role="status" aria-live="polite">
    <?php foreach ($messages as $message): ?>
      <div class="alert alert-<?= Str::e($message['tone']) ?>">
        <?= Str::e($message['message']) ?>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>
