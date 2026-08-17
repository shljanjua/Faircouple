<?php
declare(strict_types=1);

$country = Db::one('SELECT * FROM countries WHERE slug = ? AND is_active = 1 LIMIT 1', [$params['slug']]);

if (!$country) {
    Response::notFound('We do not have a guide for that country yet.');
}

$destinations = Db::all(
    'SELECT * FROM destinations WHERE country_code = ? AND is_active = 1 ORDER BY is_featured DESC, popularity DESC',
    [$country['code']]
);

Seo::breadcrumbs([
    ['name' => 'Home', 'url' => '/'],
    ['name' => 'Countries', 'url' => '/countries'],
    ['name' => $country['name'], 'url' => '/countries/' . $country['slug']],
]);

View::begin('layouts/public', [
    'title'       => $country['meta_title'] ?: ($country['name'] . ' Travel Guide for Couples'),
    'description' => $country['meta_description'] ?: Str::excerpt($country['summary'], 155),
    'image'       => $country['hero_image'],
]);
?>

<section class="section-tight">
  <div class="container">
    <nav class="small muted" aria-label="Breadcrumb"><a href="/countries">← All countries</a></nav>

    <h1 class="mt-3"><?= Str::e($country['flag_emoji']) ?> <?= Str::e($country['name']) ?></h1>
    <p class="lead mt-2"><?= Str::e($country['summary']) ?></p>

    <div class="grid grid-4 mt-4">
      <div class="card stat">
        <p class="stat-label">Capital</p>
        <p class="stat-value" style="font-size:1.3rem"><?= Str::e($country['capital'] ?: '—') ?></p>
      </div>
      <div class="card stat">
        <p class="stat-label">Currency</p>
        <p class="stat-value" style="font-size:1.3rem">
          <?= Str::e($country['currency_symbol'] ?? '') ?> <?= Str::e($country['currency_code'] ?? '—') ?>
        </p>
      </div>
      <div class="card stat">
        <p class="stat-label">Daily budget</p>
        <p class="stat-value" style="font-size:1.3rem">
          <?= $country['avg_daily_cost_usd'] ? '$' . (int) $country['avg_daily_cost_usd'] : '—' ?>
        </p>
      </div>
      <div class="card stat">
        <p class="stat-label">Best season</p>
        <p class="stat-value" style="font-size:1.05rem"><?= Str::e($country['best_season'] ?: '—') ?></p>
      </div>
    </div>

    <?php if (Str::bool($country['is_schengen'])): ?>
      <div class="alert alert-info mt-3">
        <div>In the Schengen area — one visa covers the whole zone. Check the rules for your own passport.</div>
      </div>
    <?php endif; ?>

    <?php if ($country['description']): ?>
      <div class="prose mt-4"><?= Str::markdown($country['description']) ?></div>
    <?php endif; ?>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <h2>Destinations in <?= Str::e($country['name']) ?></h2>

    <?php if ($destinations === []): ?>
      <p class="muted mt-2">No destination guides here yet — <a href="/destinations">browse everywhere else</a>.</p>
    <?php else: ?>
      <div class="grid grid-3 mt-3">
        <?php foreach ($destinations as $destination): ?>
          <a class="card" href="/destinations/<?= Str::e($destination['slug']) ?>" style="color:inherit;overflow:hidden">
            <?php if ($destination['hero_image']): ?>
              <img src="<?= Str::e($destination['hero_image']) ?>?w=600&q=70" alt="" loading="lazy"
                   style="aspect-ratio:16/10;object-fit:cover;width:100%">
            <?php endif; ?>
            <div class="card-body">
              <div class="row-between">
                <p class="bold"><?= Str::e($destination['name']) ?></p>
                <?php if (Str::bool($destination['is_honeymoon'])): ?>
                  <span class="badge badge-primary">💍</span>
                <?php endif; ?>
              </div>
              <p class="small muted mt-1"><?= Str::e(Str::excerpt($destination['summary'], 100)) ?></p>
              <p class="tiny muted mt-2">
                <?php if ($destination['avg_daily_cost_usd']): ?>≈ $<?= (int) $destination['avg_daily_cost_usd'] ?>/day<?php endif; ?>
                <?php if ($destination['ideal_days']): ?> · <?= (int) $destination['ideal_days'] ?> days<?php endif; ?>
              </p>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <div class="card card-accent mt-4">
      <div class="card-body">
        <h2 style="font-size:1.15rem">Plan it properly</h2>
        <p class="small mt-2">
          Add the trip, generate the itinerary, split the costs by income and keep every booking in the vault
          so you both have it offline.
        </p>
        <a class="btn mt-3" href="/signup">Start free</a>
      </div>
    </div>
  </div>
</section>

<?php View::end(); ?>
