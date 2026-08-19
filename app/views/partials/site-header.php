<header class="site-header">
  <div class="container">
    <a class="logo" href="/">
      <svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M24 43.2 8.6 28.6a10.2 10.2 0 0 1 14.4-14.4l1 1 1-1a10.2 10.2 0 1 1 14.4 14.4Z"/>
      </svg>
      <?= Str::e(Settings::text('site_name', 'FairCouples')) ?>
    </a>

    <nav class="site-nav" aria-label="Main">
      <a href="/features" class="<?= View::active('/features') ?>">Features</a>
      <a href="/fairness" class="<?= View::active('/fairness') ?>">Fairness</a>
      <a href="/destinations" class="<?= View::active('/destinations') ?>">Travel</a>
      <a href="/checklists" class="<?= View::active('/checklists') ?>">Checklists</a>
      <a href="/pricing" class="<?= View::active('/pricing') ?>">Pricing</a>
      <a href="/blog" class="<?= View::active('/blog') ?>">Blog</a>
    </nav>

    <div class="header-actions">
      <button type="button" class="btn btn-ghost btn-icon" data-theme-toggle aria-pressed="false" title="Switch theme">
        <?= View::icon('sun') ?>
        <span class="sr-only" data-theme-label>Dark mode</span>
      </button>

      <?php if (Auth::check()): ?>
        <a class="btn btn-sm" href="/dashboard">Dashboard</a>
      <?php else: ?>
        <a class="btn btn-ghost btn-sm" href="/signin">Sign in</a>
        <a class="btn btn-sm" href="/signup">Start free</a>
      <?php endif; ?>

      <button type="button" class="btn btn-ghost btn-icon menu-toggle" data-toggle="mobile-nav"
              aria-expanded="false" aria-controls="mobile-nav">
        <?= View::icon('menu') ?>
        <span class="sr-only">Menu</span>
      </button>
    </div>
  </div>

  <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile">
    <a href="/features">Features</a>
    <a href="/fairness">The fairness framework</a>
    <a href="/destinations">Travel &amp; honeymoons</a>
    <a href="/checklists">Checklists</a>
    <a href="/love-or-attraction">Love or attraction test</a>
    <a href="/pricing">Pricing</a>
    <a href="/blog">Blog</a>
    <a href="/faq">FAQ</a>
    <a href="/contact">Contact</a>
    <?php if (Auth::check()): ?>
      <a href="/dashboard">Go to my dashboard</a>
    <?php else: ?>
      <a href="/signin">Sign in</a>
      <a href="/signup">Create a free account</a>
    <?php endif; ?>
  </nav>
</header>
