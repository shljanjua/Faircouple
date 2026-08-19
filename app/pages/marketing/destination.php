<?php
declare(strict_types=1);

$destination = Db::one(
    'SELECT d.*, c.name AS country_name, c.flag_emoji, c.slug AS country_slug, c.currency_code,
            c.best_season AS country_season, c.is_schengen, c.visa_note
       FROM destinations d
       LEFT JOIN countries c ON c.code = d.country_code
      WHERE d.slug = ? AND d.is_active = 1
      LIMIT 1',
    [$params['slug']]
);

if (!$destination) {
    Response::notFound('We do not have a guide for that destination yet.');
}

$attractions = Db::all(
    'SELECT * FROM attractions WHERE destination_id = ? ORDER BY sort_order ASC',
    [$destination['id']]
);

$nearby = Db::all(
    'SELECT slug, name, summary, hero_image, avg_daily_cost_usd
       FROM destinations
      WHERE country_code = ? AND id <> ? AND is_active = 1
      ORDER BY popularity DESC LIMIT 3',
    [$destination['country_code'], $destination['id']]
);

$bestMonths = Str::json($destination['best_months']);
$highlights = Str::json($destination['highlights']);
$tags       = Str::json($destination['tags']);

Seo::touristDestination($destination, ['code' => $destination['country_code']]);
Seo::breadcrumbs([
    ['name' => 'Home', 'url' => '/'],
    ['name' => 'Destinations', 'url' => '/destinations'],
    ['name' => $destination['country_name'], 'url' => '/countries/' . $destination['country_slug']],
    ['name' => $destination['name'], 'url' => '/destinations/' . $destination['slug']],
]);

$idealDays = (int) ($destination['ideal_days'] ?: 5);
$dailyCost = (int) ($destination['avg_daily_cost_usd'] ?: 0);

View::begin('layouts/public', [
    'title'       => $destination['meta_title'] ?: ($destination['name'] . ' Honeymoon Guide — Costs, Best Time & Itinerary'),
    'description' => $destination['meta_description'] ?: Str::excerpt($destination['summary'], 155),
    'keywords'    => Str::json($destination['keywords']),
    'image'       => $destination['hero_image'],
]);
?>

<section class="section-tight">
  <div class="container">
    <nav class="small muted" aria-label="Breadcrumb">
      <a href="/destinations">Destinations</a> ›
      <a href="/countries/<?= Str::e($destination['country_slug']) ?>"><?= Str::e($destination['country_name']) ?></a>
    </nav>

    <div class="row-between mt-3">
      <div>
        <h1><?= Str::e($destination['name']) ?></h1>
        <p class="muted mt-1">
          <?= Str::e($destination['flag_emoji']) ?> <?= Str::e($destination['country_name']) ?>
          · <?= Str::e(ucfirst($destination['destination_type'])) ?>
          <?php if ($destination['city'] && $destination['city'] !== $destination['name']): ?>
            · <?= Str::e($destination['city']) ?>
          <?php endif; ?>
        </p>
      </div>
      <?php if (Str::bool($destination['is_honeymoon'])): ?>
        <span class="badge badge-primary">💍 Honeymoon score <?= (int) $destination['honeymoon_score'] ?>/100</span>
      <?php endif; ?>
    </div>

    <?php if ($destination['hero_image']): ?>
      <img class="mt-3" src="<?= Str::e($destination['hero_image']) ?>?w=1400&q=75" alt=""
           style="width:100%;aspect-ratio:21/9;object-fit:cover;border-radius:var(--radius)">
    <?php endif; ?>

    <p class="lead mt-3"><?= Str::e($destination['summary']) ?></p>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <div class="grid grid-4">
      <div class="card stat">
        <p class="stat-label">Daily budget</p>
        <p class="stat-value"><?= $dailyCost ? '$' . $dailyCost : '—' ?></p>
        <p class="stat-hint">per couple, mid-range</p>
      </div>
      <div class="card stat">
        <p class="stat-label">Ideal length</p>
        <p class="stat-value"><?= $idealDays ?> days</p>
        <p class="stat-hint">
          <?= $dailyCost ? 'about $' . number_format($dailyCost * $idealDays) . ' total' : 'excluding flights' ?>
        </p>
      </div>
      <div class="card stat">
        <p class="stat-label">Romance score</p>
        <p class="stat-value"><?= (int) $destination['romance_score'] ?></p>
        <p class="stat-hint">out of 100</p>
      </div>
      <div class="card stat">
        <p class="stat-label">Budget level</p>
        <p class="stat-value" style="font-size:1.4rem"><?= Str::e(ucfirst((string) $destination['budget_level'])) ?></p>
        <p class="stat-hint"><?= Str::e($destination['currency_code'] ?? '') ?></p>
      </div>
    </div>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <div class="grid grid-sidebar">
      <div>
        <?php if ($destination['description']): ?>
          <div class="prose"><?= Str::markdown($destination['description']) ?></div>
        <?php endif; ?>

        <?php if ($highlights !== []): ?>
          <h2 class="mt-4">What you will actually do</h2>
          <ul class="list-plain mt-3">
            <?php foreach ($highlights as $highlight): ?>
              <li class="row" style="align-items:flex-start;gap:0.6rem">
                <span class="tone-primary">◆</span><span><?= Str::e($highlight) ?></span>
              </li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>

        <?php if ($attractions !== []): ?>
          <h2 class="mt-4">Attractions the itinerary generator uses</h2>
          <div class="stack mt-3">
            <?php foreach ($attractions as $attraction): ?>
              <div class="card">
                <div class="card-body" style="padding:1rem 1.25rem">
                  <div class="row-between">
                    <p class="bold">
                      <?= Str::e($attraction['name']) ?>
                      <?php if (Str::bool($attraction['is_must_see'])): ?>
                        <span class="badge badge-primary">Must see</span>
                      <?php endif; ?>
                      <?php if (Str::bool($attraction['is_romantic'])): ?>
                        <span class="badge">💕 Romantic</span>
                      <?php endif; ?>
                    </p>
                    <span class="small muted nowrap">
                      <?php if ($attraction['ticket_price_usd'] !== null): ?>
                        <?= ((float) $attraction['ticket_price_usd']) > 0 ? '$' . number_format((float) $attraction['ticket_price_usd'], 0) : 'Free' ?>
                      <?php endif; ?>
                      <?php if ($attraction['duration_minutes']): ?>
                        · <?= (int) round($attraction['duration_minutes'] / 60) ?>h
                      <?php endif; ?>
                    </span>
                  </div>
                  <?php if ($attraction['description']): ?>
                    <p class="small muted mt-1"><?= Str::e($attraction['description']) ?></p>
                  <?php endif; ?>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

      <aside class="stack">
        <div class="card card-accent">
          <div class="card-body">
            <h2 style="font-size:1.05rem">Plan this trip together</h2>
            <p class="small mt-2">
              Add <?= Str::e($destination['name']) ?> as a trip, generate a <?= $idealDays ?>-day itinerary,
              split the budget fairly and keep every ticket in one vault.
            </p>
            <a class="btn btn-block mt-3" href="/signup?destination=<?= Str::e($destination['slug']) ?>">
              Start planning free
            </a>
          </div>
        </div>

        <?php if ($bestMonths !== []): ?>
          <div class="card">
            <div class="card-body">
              <h3 style="font-family:var(--font);font-size:0.95rem">Best months</h3>
              <p class="row mt-2">
                <?php foreach ($bestMonths as $month): ?>
                  <span class="badge"><?= Str::e($month) ?></span>
                <?php endforeach; ?>
              </p>
              <?php if ($destination['country_season']): ?>
                <p class="tiny muted mt-2">Country-wide: <?= Str::e($destination['country_season']) ?></p>
              <?php endif; ?>
            </div>
          </div>
        <?php endif; ?>

        <?php if ($destination['visa_note'] || Str::bool($destination['is_schengen'])): ?>
          <div class="card">
            <div class="card-body">
              <h3 style="font-family:var(--font);font-size:0.95rem">Entry</h3>
              <?php if (Str::bool($destination['is_schengen'])): ?>
                <p class="small mt-2">In the Schengen area — one visa covers the whole zone.</p>
              <?php endif; ?>
              <?php if ($destination['visa_note']): ?>
                <p class="small muted mt-1"><?= Str::e($destination['visa_note']) ?></p>
              <?php endif; ?>
              <p class="tiny muted mt-2">Always check the official rules for your own passport before booking.</p>
            </div>
          </div>
        <?php endif; ?>

        <?php if ($tags !== []): ?>
          <div class="card">
            <div class="card-body">
              <h3 style="font-family:var(--font);font-size:0.95rem">Good for</h3>
              <p class="row mt-2">
                <?php foreach ($tags as $tag): ?><span class="badge"><?= Str::e($tag) ?></span><?php endforeach; ?>
              </p>
            </div>
          </div>
        <?php endif; ?>
      </aside>
    </div>
  </div>
</section>

<?php if ($nearby !== []): ?>
<section class="section-tight">
  <div class="container">
    <h2 style="font-size:1.3rem">Also in <?= Str::e($destination['country_name']) ?></h2>
    <div class="grid grid-3 mt-3">
      <?php foreach ($nearby as $item): ?>
        <a class="card" href="/destinations/<?= Str::e($item['slug']) ?>" style="color:inherit;overflow:hidden">
          <?php if ($item['hero_image']): ?>
            <img src="<?= Str::e($item['hero_image']) ?>?w=500&q=70" alt="" loading="lazy"
                 style="aspect-ratio:16/10;object-fit:cover;width:100%">
          <?php endif; ?>
          <div class="card-body" style="padding:1rem">
            <p class="bold"><?= Str::e($item['name']) ?></p>
            <p class="small muted mt-1"><?= Str::e(Str::excerpt($item['summary'], 90)) ?></p>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php View::end(); ?>
