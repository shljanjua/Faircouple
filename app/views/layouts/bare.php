<!doctype html>
<html lang="en">
<head>
  <?php View::partial('partials/head'); ?>
</head>
<body>
  <main id="main" class="container container-tight section">
    <?php View::partial('partials/flash'); ?>
    <?= $content ?>
  </main>
  <script src="/assets/js/app.js?v=1" defer></script>
</body>
</html>
