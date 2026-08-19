<section class="section">
  <div class="container container-tight center">
    <p class="eyebrow">404</p>
    <h1>We cannot find that page</h1>
    <p class="muted mt-2"><?= Str::e($message ?? 'That page does not exist.') ?></p>
    <div class="row mt-3" style="justify-content:center">
      <a class="btn" href="/">Back to the home page</a>
      <a class="btn btn-outline" href="/blog">Read the blog</a>
    </div>
  </div>
</section>
