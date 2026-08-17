<?php
declare(strict_types=1);

$type      = trim((string) ($_GET['type'] ?? ''));
$countryId = trim((string) ($_GET['country'] ?? ''));
$budget    = trim((string) ($_GET['budget'] ?? ''));
$search    = trim((string) ($_GET['q'] ?? ''));

$where = ['d.is_active = 1'];
$params = [];

if ($type === 'honeymoon') {
    $where[] = 'd.is_honeymoon = 1';
} elseif ($type !== '') {
    $where[] = 'd.destination_type = ?';
    $params[] = $type;
}
if ($countryId !== '') {
    $where[] = 'd.country_code = ?';
    $params[] = strtoupper($countryId);
}
if ($budget !== '') {
    $where[] = 'd.budget_level = ?';
    $params[] = $budget;
}
if ($search !== '') {
    $where[] = '(d.name LIKE ? OR d.city LIKE ? OR d.summary LIKE ?)';
    $params[] = '%' . $search . '%';
    $params[] = '%' . $search . '%';
    $params[] = '%' . $search . '%';
}

$clause = implode(' AND ', $where);

$destinations = Db::all(
    "SELECT d.*, c.name AS country_name, c.flag_emoji, c.slug AS country_slug
       FROM destinations d
       LEFT JOIN countries c ON c.code = d.country_code
      WHERE {$clause}
      ORDER BY d.is_featured DESC, d.popularity DESC
      LIMIT 120",
    $params
);

$countries = Db::all(
    'SELECT DISTINCT c.code, c.name, c.flag_emoji
       FROM countries c JOIN destinations d ON d.country_code = c.code
      WHERE d.is_active = 1 ORDER BY c.name ASC'
);

Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'Destinations', 'url' => '/destinations']]);

View::begin('layouts/public', [
    'title'       => 'Honeymoon & Couples Travel Destinations — Costs, Seasons and Itineraries',
    'description' => 'Browse honeymoon and couples destinations across Europe, the USA, Canada, Australia and beyond, with daily costs, best months and ready-made itineraries.',
    'no_index'    => $search !== '',
]);
?>

<section class="section-tight">
  <div class="container">
    <p class="eyebrow">Travel</p>
    <h1>Where to go, what it costs, when to go</h1>
    <p class="muted mt-2" style="max-width:62ch">
      <?= count($destinations) ?> destinations with honeymoon scores, realistic daily budgets and the months
      that are actually worth it. Pick one and the itinerary generator lays out your days.
    </p>

    <form method="get" class="toolbar mt-3">
      <div class="field" style="flex:1 1 14rem">
        <label class="sr-only" for="q">Search</label>
        <input class="input" type="search" id="q" name="q" value="<?= Str::e($search) ?>" placeholder="Search destinations…">
      </div>

      <div class="field">
        <label class="sr-only" for="country">Country</label>
        <select class="select" id="country" name="country">
          <option value="">All countries</option>
          <?php foreach ($countries as $country): ?>
            <option value="<?= Str::e($country['code']) ?>" <?= strtoupper($countryId) === $country['code'] ? 'selected' : '' ?>>
              <?= Str::e($country['flag_emoji'] . ' ' . $country['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>

      <div class="field">
        <label class="sr-only" for="type">Type</label>
        <select class="select" id="type" name="type">
          <option value="">Any type</option>
          <option value="honeymoon" <?= $type === 'honeymoon' ? 'selected' : '' ?>>Honeymoon picks</option>
          <?php foreach (['city', 'beach', 'island', 'mountain', 'countryside', 'lake', 'historic', 'ski', 'desert', 'safari'] as $option): ?>
            <option value="<?= $option ?>" <?= $type === $option ? 'selected' : '' ?>><?= ucfirst($option) ?></option>
          <?php endforeach; ?>
        </select>
      </div>

      <div class="field">
        <label class="sr-only" for="budget">Budget</label>
        <select class="select" id="budget" name="budget">
          <option value="">Any budget</option>
          <?php foreach (['budget', 'moderate', 'premium', 'luxury'] as $option): ?>
            <option value="<?= $option ?>" <?= $budget === $option ? 'selected' : '' ?>><?= ucfirst($option) ?></option>
          <?php endforeach; ?>
        </select>
      </div>

      <button class="btn" type="submit">Filter</button>
      <?php if ($search !== '' || $type !== '' || $countryId !== '' || $budget !== ''): ?>
        <a class="btn btn-ghost" href="/destinations">Clear</a>
      <?php endif; ?>
    </form>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <?php if ($destinations === []): ?>
      <div class="card"><div class="card-body empty">
        <p class="empty-emoji">🗺️</p>
        <p class="bold">Nothing matches those filters</p>
        <a class="btn btn-outline mt-3" href="/destinations">Show everything</a>
      </div></div>
    <?php else: ?>
      <div class="grid grid-3">
        <?php foreach ($destinations as $destination): ?>
          <article class="card" style="overflow:hidden">
            <a href="/destinations/<?= Str::e($destination['slug']) ?>">
              <?php if ($destination['hero_image']): ?>
                <img src="<?= Str::e($destination['hero_image']) ?>?w=600&q=70" alt="" loading="lazy"
                     style="aspect-ratio:16/10;object-fit:cover;width:100%">
              <?php endif; ?>
            </a>
            <div class="card-body">
              <div class="row-between">
                <h2 style="font-family:var(--font);font-size:1.05rem">
                  <a href="/destinations/<?= Str::e($destination['slug']) ?>" style="color:inherit">
                    <?= Str::e($destination['name']) ?>
                  </a>
                </h2>
                <?php if (Str::bool($destination['is_honeymoon'])): ?>
                  <span class="badge badge-primary">💍 <?= (int) $destination['honeymoon_score'] ?></span>
                <?php endif; ?>
              </div>

              <p class="tiny muted mt-1">
                <?= Str::e($destination['flag_emoji']) ?> <?= Str::e($destination['country_name']) ?>
                · <?= Str::e(ucfirst($destination['destination_type'])) ?>
              </p>

              <p class="small muted mt-2"><?= Str::e(Str::excerpt($destination['summary'], 110)) ?></p>

              <div class="row-between mt-3 tiny muted">
                <span>
                  <?php if ($destination['avg_daily_cost_usd']): ?>
                    ≈ $<?= (int) $destination['avg_daily_cost_usd'] ?>/day
                  <?php endif; ?>
                </span>
                <span>
                  <?php if ($destination['ideal_days']): ?><?= (int) $destination['ideal_days'] ?> days<?php endif; ?>
                  <?php if ($destination['rating']): ?> · ★ <?= number_format((float) $destination['rating'], 1) ?><?php endif; ?>
                </span>
              </div>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php View::end(); ?>
