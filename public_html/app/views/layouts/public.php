<!doctype html>
<html lang="en">
<head>
  <?php View::partial('partials/head'); ?>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <?php View::partial('partials/site-header'); ?>

  <main id="main">
    <div class="container section-tight"><?php View::partial('partials/flash'); ?></div>
    <?= $content ?>
  </main>

  <?php View::partial('partials/site-footer'); ?>
  <script src="/assets/js/app.js?v=1" defer></script>
</body>
</html>
