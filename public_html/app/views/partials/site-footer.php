<?php
$legalPages = Db::all(
    'SELECT slug, title FROM pages WHERE status = "published" AND show_in_footer = 1 ORDER BY sort_order ASC LIMIT 12'
);

$socials = array_filter([
    'X'         => Settings::text('social_twitter'),
    'Instagram' => Settings::text('social_instagram'),
    'Facebook'  => Settings::text('social_facebook'),
    'Pinterest' => Settings::text('social_pinterest'),
]);
?>
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <a class="logo" href="/">
          <svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="currentColor" d="M24 43.2 8.6 28.6a10.2 10.2 0 0 1 14.4-14.4l1 1 1-1a10.2 10.2 0 1 1 14.4 14.4Z"/>
          </svg>
          <?= Str::e(Settings::text('site_name', 'FairCouples')) ?>
        </a>
        <p class="small muted mt-1" style="max-width:32ch">
          <?= Str::e(Settings::text('site_tagline', 'Fair love, measured.')) ?>
          Both partners log their own side — the report belongs to both of you.
        </p>

        <form method="post" action="/newsletter" class="mt-3">
          <?= Csrf::field() ?>
          <label class="label" for="footer-email">Weekly fairness tips</label>
          <div class="row" style="flex-wrap:nowrap">
            <input class="input" type="email" id="footer-email" name="email" placeholder="you@example.com" required>
            <button class="btn btn-sm" type="submit">Join</button>
          </div>
        </form>
      </div>

      <div>
        <h3>Product</h3>
        <ul>
          <li><a href="/features">Features</a></li>
          <li><a href="/fairness">The 10 fairness areas</a></li>
          <li><a href="/love-or-attraction">Love or attraction test</a></li>
          <li><a href="/checklists">Checklists &amp; packing</a></li>
          <li><a href="/pricing">Pricing</a></li>
        </ul>
      </div>

      <div>
        <h3>Travel</h3>
        <ul>
          <li><a href="/destinations">All destinations</a></li>
          <li><a href="/destinations?type=honeymoon">Honeymoon ideas</a></li>
          <li><a href="/countries">Countries A–Z</a></li>
          <li><a href="/blog?category=travel">Travel guides</a></li>
        </ul>
      </div>

      <div>
        <h3>Company</h3>
        <ul>
          <li><a href="/blog">Blog</a></li>
          <li><a href="/faq">FAQ</a></li>
          <li><a href="/contact">Contact</a></li>
          <?php foreach ($legalPages as $page): ?>
            <li><a href="/<?= Str::e($page['slug']) ?>"><?= Str::e($page['title']) ?></a></li>
          <?php endforeach; ?>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <p>
        &copy; <?= date('Y') ?> <?= Str::e(Settings::text('company_name', 'FairCouples')) ?>.
        Not therapy or counselling.
      </p>
      <?php if ($socials !== []): ?>
        <p class="row" style="gap:1rem">
          <?php foreach ($socials as $label => $url): ?>
            <a href="<?= Str::e($url) ?>" rel="me noopener" target="_blank"><?= Str::e($label) ?></a>
          <?php endforeach; ?>
        </p>
      <?php endif; ?>
    </div>
  </div>
</footer>

<?php if (Settings::bool('cookie_banner_enabled', true)): ?>
  <div class="cookie-banner" id="cookie-banner" hidden role="dialog" aria-label="Cookie notice">
    <div class="row-between">
      <p style="flex:1 1 16rem">
        We use essential cookies to keep you signed in. With your permission we also use analytics and
        advertising cookies to understand what people read — nothing else is loaded until you choose.
        See the <a href="/cookie-policy">cookie policy</a>.
      </p>
      <span class="row" style="gap:0.5rem">
        <button type="button" class="btn btn-sm btn-ghost" data-cookie-decline>Essential only</button>
        <button type="button" class="btn btn-sm" data-cookie-accept>Accept all</button>
      </span>
    </div>
  </div>
<?php endif; ?>
