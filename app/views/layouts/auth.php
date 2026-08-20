<!doctype html>
<html lang="en">
<head>
  <?php View::partial('partials/head'); ?>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <div style="min-height:100vh;display:grid;place-items:center;padding:2rem 1rem">
    <main id="main" style="width:100%;max-width:26rem">
      <div class="center mb-2">
        <a class="logo" href="/" style="justify-content:center">
          <svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="currentColor" d="M24 43.2 8.6 28.6a10.2 10.2 0 0 1 14.4-14.4l1 1 1-1a10.2 10.2 0 1 1 14.4 14.4Z"/>
          </svg>
          <?= Str::e(Settings::text('site_name', 'FairCouples')) ?>
        </a>
      </div>

      <?php View::partial('partials/flash'); ?>

      <div class="card">
        <div class="card-body"><?= $content ?></div>
      </div>

      <p class="center small muted mt-3">
        <a href="/">Back to the site</a> ·
        <button type="button" class="btn btn-ghost btn-sm" data-theme-toggle>
          <span data-theme-label>Dark mode</span>
        </button>
      </p>
    </main>
  </div>

  <script src="/assets/js/app.js?v=2" defer></script>
</body>
</html>
