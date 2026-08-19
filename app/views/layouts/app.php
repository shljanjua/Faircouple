<?php
$user = Auth::user();
$context = Auth::couple();
$entitlements = Auth::entitlements();
$unread = $user ? Audit::unreadCount($user['id']) : 0;
$partner = $context['partner'] ?? null;
?>
<!doctype html>
<html lang="en">
<head>
  <?php View::partial('partials/head'); ?>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <div class="app-shell">
    <aside class="app-sidebar" id="app-sidebar">
      <div class="row-between">
        <a class="logo" href="/dashboard">
          <svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="currentColor" d="M24 43.2 8.6 28.6a10.2 10.2 0 0 1 14.4-14.4l1 1 1-1a10.2 10.2 0 1 1 14.4 14.4Z"/>
          </svg>
          <?= Str::e(Settings::text('site_name', 'FairCouples')) ?>
        </a>
        <button type="button" class="btn btn-ghost btn-icon" data-toggle="app-sidebar" style="display:none">
          <?= View::icon('close') ?><span class="sr-only">Close menu</span>
        </button>
      </div>

      <?php if ($context): ?>
        <div class="card card-flat mt-3" style="padding:0.75rem">
          <div class="row" style="gap:0.6rem">
            <span class="avatar-pair">
              <?= View::avatar($user['avatar_url'] ?? null, $user['full_name'] ?? null, 30) ?>
              <?= View::avatar($partner['avatar_url'] ?? null, $partner['full_name'] ?? 'Partner', 30) ?>
            </span>
            <span class="small truncate" style="min-width:0">
              <span class="bold truncate"><?= Str::e($context['couple']['name'] ?: 'Our space') ?></span>
              <span class="tiny muted"><?= Str::e($entitlements['plan']['name']) ?> plan</span>
            </span>
          </div>
        </div>
      <?php endif; ?>

      <nav aria-label="Dashboard">
        <ul class="side-nav">
          <li><a href="/dashboard" class="<?= Request::path() === '/dashboard' ? 'is-active' : '' ?>"><?= View::icon('chart') ?> Overview</a></li>
        </ul>

        <p class="side-heading">Love &amp; care</p>
        <ul class="side-nav">
          <li><a href="/dashboard/love" class="<?= View::active('/dashboard/love') ?>"><?= View::icon('heart') ?> Love &amp; care</a></li>
          <li><a href="/dashboard/letters" class="<?= View::active('/dashboard/letters') ?>"><?= View::icon('mail') ?> Open when… letters</a></li>
          <li><a href="/dashboard/story" class="<?= View::active('/dashboard/story') ?>"><?= View::icon('star') ?> Our Story</a></li>
          <li><a href="/dashboard/bucket" class="<?= View::active('/dashboard/bucket') ?>"><?= View::icon('globe') ?> Bucket list</a></li>
          <li><a href="/dashboard/distance" class="<?= View::active('/dashboard/distance') ?>"><?= View::icon('plane') ?> Long-distance</a></li>
          <li><a href="/dashboard/challenges" class="<?= View::active('/dashboard/challenges') ?>"><?= View::icon('check') ?> Challenges</a></li>
        </ul>

        <p class="side-heading">Relationship</p>
        <ul class="side-nav">
          <li><a href="/dashboard/fairness" class="<?= View::active('/dashboard/fairness') ?>"><?= View::icon('scale') ?> Fairness report</a></li>
          <li><a href="/dashboard/emotions" class="<?= View::active('/dashboard/emotions') ?>"><?= View::icon('smile') ?> Emotions</a></li>
          <li><a href="/dashboard/checkin" class="<?= View::active('/dashboard/checkin') ?>"><?= View::icon('calendar') ?> Daily check-in</a></li>
          <li><a href="/dashboard/compatibility" class="<?= View::active('/dashboard/compatibility') ?>"><?= View::icon('heart') ?> Compatibility</a></li>
          <li><a href="/dashboard/messages" class="<?= View::active('/dashboard/messages') ?>"><?= View::icon('message') ?> Messages</a></li>
          <li><a href="/dashboard/gallery" class="<?= View::active('/dashboard/gallery') ?>"><?= View::icon('image') ?> Photos</a></li>
        </ul>

        <p class="side-heading">Plan together</p>
        <ul class="side-nav">
          <li><a href="/dashboard/checklists" class="<?= View::active('/dashboard/checklists') ?>"><?= View::icon('checklist') ?> Checklists</a></li>
          <li><a href="/dashboard/budget" class="<?= View::active('/dashboard/budget') ?>"><?= View::icon('wallet') ?> Money &amp; budget</a></li>
          <li><a href="/dashboard/gifts" class="<?= View::active('/dashboard/gifts') ?>"><?= View::icon('gift') ?> Gifts</a></li>
          <li><a href="/dashboard/travel" class="<?= View::active('/dashboard/travel') ?>"><?= View::icon('plane') ?> Travel</a></li>
          <li><a href="/dashboard/documents" class="<?= View::active('/dashboard/documents') ?>"><?= View::icon('folder') ?> Ticket vault</a></li>
        </ul>

        <p class="side-heading">Account</p>
        <ul class="side-nav">
          <li><a href="/dashboard/partner" class="<?= View::active('/dashboard/partner') ?>"><?= View::icon('users') ?> Partner &amp; space</a></li>
          <li><a href="/dashboard/billing" class="<?= View::active('/dashboard/billing') ?>"><?= View::icon('card') ?> Plan &amp; billing</a></li>
          <li><a href="/dashboard/settings" class="<?= View::active('/dashboard/settings') ?>"><?= View::icon('settings') ?> Settings</a></li>
          <?php if (Auth::isAdmin()): ?>
            <li><a href="/admin"><?= View::icon('shield') ?> Admin panel</a></li>
          <?php endif; ?>
        </ul>
      </nav>

      <?php if (!$entitlements['is_paid']): ?>
        <div class="card card-accent mt-3">
          <div class="card-body" style="padding:1rem">
            <p class="small bold">You are on the free plan</p>
            <p class="tiny muted mt-1">Unlimited emotions, full reports, the itinerary generator and 5&nbsp;GB of vault storage.</p>
            <a class="btn btn-sm btn-block mt-2" href="/pricing">See the plans</a>
          </div>
        </div>
      <?php endif; ?>
    </aside>

    <div class="app-main">
      <div class="app-topbar">
        <button type="button" class="btn btn-ghost btn-icon" data-toggle="app-sidebar"
                aria-expanded="false" aria-controls="app-sidebar" style="display:inline-flex">
          <?= View::icon('menu') ?><span class="sr-only">Menu</span>
        </button>

        <span class="spacer"></span>

        <button type="button" class="btn btn-ghost btn-icon" data-theme-toggle title="Switch theme">
          <?= View::icon('moon') ?><span class="sr-only" data-theme-label>Dark mode</span>
        </button>

        <div class="dropdown">
          <button type="button" class="btn btn-ghost btn-icon" data-toggle="notif-menu"
                  aria-expanded="false" aria-controls="notif-menu">
            <?= View::icon('bell') ?>
            <span class="sr-only">Notifications</span>
            <?php if ($unread > 0): ?>
              <span class="badge badge-danger" style="position:absolute;transform:translate(0.7rem,-0.7rem);padding:0 0.35rem"><?= (int) $unread ?></span>
            <?php endif; ?>
          </button>
          <div class="dropdown-menu" id="notif-menu" hidden>
            <?php $notifications = $user ? Audit::recent($user['id'], 8) : []; ?>
            <?php if ($notifications === []): ?>
              <p class="small muted" style="padding:0.75rem">Nothing new yet.</p>
            <?php else: ?>
              <?php foreach ($notifications as $notification): ?>
                <a href="<?= Str::e($notification['link'] ?: '/dashboard') ?>">
                  <span class="small bold"><?= Str::e($notification['emoji'] ?? '') ?> <?= Str::e($notification['title']) ?></span>
                  <?php if ($notification['body']): ?>
                    <span class="tiny muted" style="display:block"><?= Str::e($notification['body']) ?></span>
                  <?php endif; ?>
                  <span class="tiny muted"><?= Str::e(Str::timeAgo($notification['created_at'])) ?></span>
                </a>
              <?php endforeach; ?>
              <form method="post" action="/dashboard/notifications">
                <?= Csrf::field() ?>
                <button type="submit" name="action" value="read_all" class="small">Mark all read</button>
              </form>
            <?php endif; ?>
          </div>
        </div>

        <div class="dropdown">
          <button type="button" class="btn btn-ghost btn-sm" data-toggle="user-menu"
                  aria-expanded="false" aria-controls="user-menu" style="gap:0.5rem">
            <?= View::avatar($user['avatar_url'] ?? null, $user['full_name'] ?? null, 26) ?>
            <span class="truncate" style="max-width:9rem"><?= Str::e($user['display_name'] ?: $user['full_name'] ?: $user['email']) ?></span>
          </button>
          <div class="dropdown-menu" id="user-menu" hidden style="min-width:13rem">
            <a href="/dashboard/settings">Settings</a>
            <a href="/dashboard/billing">Plan &amp; billing</a>
            <a href="/dashboard/partner">Partner &amp; space</a>
            <?php if (Auth::isAdmin()): ?><a href="/admin">Admin panel</a><?php endif; ?>
            <form method="post" action="/signout">
              <?= Csrf::field() ?>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </div>

      <main id="main" class="app-content">
        <?php View::partial('partials/flash'); ?>
        <?= $content ?>
      </main>
    </div>
  </div>

  <script src="/assets/js/app.js?v=1" defer></script>
</body>
</html>
