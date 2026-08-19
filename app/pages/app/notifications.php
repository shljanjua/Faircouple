<?php
declare(strict_types=1);

$user = Auth::require();

if (Request::isPost()) {
    if (Request::input('action') === 'read_all') {
        Audit::markAllRead($user['id']);
    }
    Response::back('/dashboard/notifications');
}

$notifications = Db::all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    [$user['id']]
);

Audit::markAllRead($user['id']);

View::begin('layouts/app', ['title' => 'Notifications', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Notifications</h1>
  <p>Everything your partner has done that involves you. Private entries never appear here.</p>
</div>

<div class="card">
  <div class="card-body">
    <?php if ($notifications === []): ?>
      <div class="empty">
        <p class="empty-emoji">🔔</p>
        <p class="bold">Nothing yet</p>
        <p>You will hear when your partner logs an entry, replies or joins.</p>
      </div>
    <?php else: ?>
      <ul class="list-plain">
        <?php foreach ($notifications as $notification): ?>
          <li class="row" style="align-items:flex-start;gap:0.7rem">
            <span style="font-size:1.3rem;line-height:1.3"><?= Str::e($notification['emoji'] ?: '🔔') ?></span>
            <div style="flex:1;min-width:0">
              <p class="small bold">
                <?php if ($notification['link']): ?>
                  <a href="<?= Str::e($notification['link']) ?>" style="color:inherit"><?= Str::e($notification['title']) ?></a>
                <?php else: ?>
                  <?= Str::e($notification['title']) ?>
                <?php endif; ?>
              </p>
              <?php if ($notification['body']): ?>
                <p class="small muted"><?= Str::e($notification['body']) ?></p>
              <?php endif; ?>
              <p class="tiny muted"><?= Str::e(Str::timeAgo($notification['created_at'])) ?></p>
            </div>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </div>
</div>

<?php View::end(); ?>
