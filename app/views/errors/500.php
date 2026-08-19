<section class="section">
  <div class="container container-tight center">
    <p class="eyebrow">Error</p>
    <h1>Something went wrong</h1>
    <p class="muted mt-2">
      The problem has been logged. Please try again in a moment — and if it keeps happening,
      email <a href="mailto:<?= Str::e(Settings::text('support_email')) ?>"><?= Str::e(Settings::text('support_email')) ?></a>.
    </p>
    <a class="btn mt-3" href="/">Back to the home page</a>
  </div>
</section>
