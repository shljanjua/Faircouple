<?php
declare(strict_types=1);

$faqs = Db::all('SELECT * FROM faqs WHERE is_active = 1 ORDER BY category ASC, sort_order ASC');

$byCategory = [];
foreach ($faqs as $faq) {
    $byCategory[$faq['category'] ?: 'general'][] = $faq;
}

$labels = [
    'general' => 'General',
    'product' => 'The product',
    'billing' => 'Billing & plans',
    'privacy' => 'Privacy & data',
    'travel'  => 'Travel',
];

Seo::faq($faqs);
Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'FAQ', 'url' => '/faq']]);

View::begin('layouts/public', [
    'title'       => 'Frequently Asked Questions',
    'description' => 'Answers about how FairCouples measures fairness, what your partner can see, billing in five currencies, privacy and travel planning.',
]);
?>

<section class="section-tight">
  <div class="container container-narrow">
    <p class="eyebrow">FAQ</p>
    <h1>Questions people actually ask</h1>
    <p class="muted mt-2">
      Still unsure? Email
      <a href="mailto:<?= Str::e(Settings::text('support_email')) ?>"><?= Str::e(Settings::text('support_email')) ?></a>
      and a human replies within one business day.
    </p>

    <?php foreach ($labels as $key => $label): ?>
      <?php $rows = $byCategory[$key] ?? []; ?>
      <?php if ($rows === []) { continue; } ?>

      <h2 class="mt-4" style="font-size:1.25rem"><?= Str::e($label) ?></h2>
      <div class="mt-3">
        <?php foreach ($rows as $faq): ?>
          <details class="accordion">
            <summary><?= Str::e($faq['question']) ?></summary>
            <div class="accordion-body"><?= Str::e($faq['answer']) ?></div>
          </details>
        <?php endforeach; ?>
      </div>
    <?php endforeach; ?>

    <div class="card card-accent mt-4">
      <div class="card-body">
        <h2 style="font-size:1.1rem">Ready to try it?</h2>
        <p class="small mt-2">The free plan gives you the weekly fairness score, daily emotions and your own private space.</p>
        <div class="row mt-3">
          <a class="btn" href="/signup">Start free</a>
          <a class="btn btn-outline" href="/contact">Talk to us</a>
        </div>
      </div>
    </div>
  </div>
</section>

<?php View::end(); ?>
