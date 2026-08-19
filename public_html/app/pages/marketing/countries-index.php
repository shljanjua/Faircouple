<?php
declare(strict_types=1);

$countries = Db::all(
    'SELECT c.*, COUNT(d.id) AS destination_count
       FROM countries c
       LEFT JOIN destinations d ON d.country_code = c.code AND d.is_active = 1
      WHERE c.is_active = 1
      GROUP BY c.code
      ORDER BY c.sort_order ASC, c.name ASC'
);

$byRegion = [];
foreach ($countries as $country) {
    $byRegion[$country['continent'] ?: 'Elsewhere'][] = $country;
}

Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'Countries', 'url' => '/countries']]);

View::begin('layouts/public', [
    'title'       => 'Countries A–Z — Couples Travel Guides, Costs and Seasons',
    'description' => 'Every country FairCouples covers, with daily budgets, the best months to travel and the destinations inside each one.',
]);
?>

<section class="section-tight">
  <div class="container">
    <p class="eyebrow">Travel</p>
    <h1>Countries A–Z</h1>
    <p class="muted mt-2" style="max-width:62ch">
      <?= count($countries) ?> countries with realistic daily budgets, the months worth travelling in,
      and every destination guide inside them.
    </p>
  </div>
</section>

<?php foreach ($byRegion as $region => $rows): ?>
  <section class="section-tight">
    <div class="container">
      <h2 style="font-size:1.3rem"><?= Str::e($region) ?></h2>
      <div class="grid grid-4 mt-3">
        <?php foreach ($rows as $country): ?>
          <a class="card" href="/countries/<?= Str::e($country['slug']) ?>" style="color:inherit">
            <div class="card-body" style="padding:1rem">
              <p class="bold">
                <?= Str::e($country['flag_emoji']) ?> <?= Str::e($country['name']) ?>
                <?php if (Str::bool($country['is_tier1'])): ?><span class="badge">Tier 1</span><?php endif; ?>
              </p>
              <p class="tiny muted mt-1">
                <?= (int) $country['destination_count'] ?> destination<?= (int) $country['destination_count'] === 1 ? '' : 's' ?>
                <?php if ($country['avg_daily_cost_usd']): ?>
                  · ≈ $<?= (int) $country['avg_daily_cost_usd'] ?>/day
                <?php endif; ?>
              </p>
              <?php if ($country['best_season']): ?>
                <p class="tiny muted">Best: <?= Str::e($country['best_season']) ?></p>
              <?php endif; ?>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    </div>
  </section>
<?php endforeach; ?>

<?php View::end(); ?>
