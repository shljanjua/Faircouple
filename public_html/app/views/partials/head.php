<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#e11d48" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)">
<meta name="format-detection" content="telephone=no">

<?= Seo::renderHead() ?>

<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/favicon.svg">
<link rel="stylesheet" href="/assets/css/app.css?v=1">
<link rel="alternate" type="application/rss+xml" title="FairCouples blog" href="/blog">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">

<script>
  /* Applied before paint so a dark-mode reader never sees a white flash. */
  (function () {
    try {
      var stored = localStorage.getItem('fc-theme');
      if (stored === 'light' || stored === 'dark') {
        document.documentElement.setAttribute('data-theme', stored);
      }
    } catch (e) {}
  })();
</script>

<?= Seo::renderSchemas() ?>
<?php View::partial('partials/analytics'); ?>
