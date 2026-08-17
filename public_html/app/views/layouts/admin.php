<?php $user = Auth::user(); ?>
<!doctype html>
<html lang="en">
<head>
  <?php View::partial('partials/head'); ?>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <div class="app-shell">
    <aside class="app-sidebar" id="admin-sidebar">
      <a class="logo" href="/admin">
        <svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="currentColor" d="M24 43.2 8.6 28.6a10.2 10.2 0 0 1 14.4-14.4l1 1 1-1a10.2 10.2 0 1 1 14.4 14.4Z"/>
        </svg>
        Admin
      </a>

      <nav aria-label="Admin">
        <ul class="side-nav">
          <li><a href="/admin" class="<?= Request::path() === '/admin' ? 'is-active' : '' ?>"><?= View::icon('chart') ?> Dashboard</a></li>
        </ul>

        <p class="side-heading">People</p>
        <ul class="side-nav">
          <li><a href="/admin/users" class="<?= View::active('/admin/users') ?>"><?= View::icon('users') ?> Users</a></li>
          <li><a href="/admin/couples" class="<?= View::active('/admin/couples') ?>"><?= View::icon('heart') ?> Relationship spaces</a></li>
        </ul>

        <p class="side-heading">Money</p>
        <ul class="side-nav">
          <li><a href="/admin/plans" class="<?= View::active('/admin/plans') ?>"><?= View::icon('card') ?> Plans &amp; pricing</a></li>
          <li><a href="/admin/subscriptions" class="<?= View::active('/admin/subscriptions') ?>"><?= View::icon('check') ?> Subscriptions</a></li>
          <li><a href="/admin/payments" class="<?= View::active('/admin/payments') ?>"><?= View::icon('wallet') ?> Payments &amp; gateways</a></li>
          <li><a href="/admin/coupons" class="<?= View::active('/admin/coupons') ?>"><?= View::icon('gift') ?> Coupons</a></li>
        </ul>

        <p class="side-heading">Content</p>
        <ul class="side-nav">
          <li><a href="/admin/blog" class="<?= View::active('/admin/blog') ?>"><?= View::icon('file-text') ?> Blog</a></li>
          <li><a href="/admin/pages" class="<?= View::active('/admin/pages') ?>"><?= View::icon('file-text') ?> Pages &amp; legal</a></li>
          <li><a href="/admin/content" class="<?= View::active('/admin/content') ?>"><?= View::icon('star') ?> FAQ &amp; testimonials</a></li>
          <li><a href="/admin/destinations" class="<?= View::active('/admin/destinations') ?>"><?= View::icon('globe') ?> Destinations</a></li>
          <li><a href="/admin/seo" class="<?= View::active('/admin/seo') ?>"><?= View::icon('search') ?> SEO &amp; redirects</a></li>
        </ul>

        <p class="side-heading">Platform</p>
        <ul class="side-nav">
          <li><a href="/admin/emails" class="<?= View::active('/admin/emails') ?>"><?= View::icon('mail') ?> Email &amp; SMTP</a></li>
          <li><a href="/admin/contacts" class="<?= View::active('/admin/contacts') ?>"><?= View::icon('message') ?> Inbox &amp; subscribers</a></li>
          <li><a href="/admin/settings" class="<?= View::active('/admin/settings') ?>"><?= View::icon('settings') ?> Settings</a></li>
          <li><a href="/admin/audit" class="<?= View::active('/admin/audit') ?>"><?= View::icon('lock') ?> Audit log</a></li>
        </ul>

        <p class="side-heading">Back</p>
        <ul class="side-nav">
          <li><a href="/dashboard"><?= View::icon('arrow-left') ?> My dashboard</a></li>
          <li><a href="/" target="_blank"><?= View::icon('globe') ?> View the site</a></li>
        </ul>
      </nav>
    </aside>

    <div class="app-main">
      <div class="app-topbar">
        <button type="button" class="btn btn-ghost btn-icon" data-toggle="admin-sidebar"
                aria-expanded="false" aria-controls="admin-sidebar">
          <?= View::icon('menu') ?><span class="sr-only">Menu</span>
        </button>

        <span class="spacer"></span>

        <span class="badge badge-primary"><?= Str::e($user['role']) ?></span>

        <button type="button" class="btn btn-ghost btn-icon" data-theme-toggle title="Switch theme">
          <?= View::icon('moon') ?><span class="sr-only" data-theme-label>Dark mode</span>
        </button>

        <form method="post" action="/signout">
          <?= Csrf::field() ?>
          <button type="submit" class="btn btn-ghost btn-sm"><?= View::icon('logout') ?> Sign out</button>
        </form>
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
