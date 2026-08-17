<?php
declare(strict_types=1);

$templates = Db::all('SELECT * FROM checklist_templates WHERE is_public = 1 ORDER BY sort_order ASC');

$byCategory = [];
foreach ($templates as $template) {
    $byCategory[$template['category'] ?: 'other'][] = $template;
}

$categoryLabels = [
    'packing'      => 'Packing lists',
    'travel'       => 'Travel admin',
    'honeymoon'    => 'Honeymoon',
    'relationship' => 'Relationship rituals',
    'money'        => 'Money',
    'other'        => 'More',
];

Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'Checklists', 'url' => '/checklists']]);

View::begin('layouts/public', [
    'title'       => 'Travel Packing & Relationship Checklists for Couples',
    'description' => 'Ready-made checklists for beach, city, winter, hiking and honeymoon trips, plus the weekly fairness ritual, the repair conversation and the monthly money review.',
]);
?>

<section class="section-tight">
  <div class="container">
    <p class="eyebrow">Checklists</p>
    <h1>Every list, already written</h1>
    <p class="muted mt-2" style="max-width:62ch">
      Packing lists for every climate and trip type, plus the relationship rituals that actually change
      something. Copy any of them into your space and tick items off together.
    </p>
  </div>
</section>

<?php foreach ($categoryLabels as $key => $label): ?>
  <?php $rows = $byCategory[$key] ?? []; ?>
  <?php if ($rows === []) { continue; } ?>

  <section class="section-tight">
    <div class="container">
      <h2 style="font-size:1.3rem"><?= Str::e($label) ?></h2>

      <div class="grid grid-2 mt-3">
        <?php foreach ($rows as $template): ?>
          <?php $items = Str::json($template['items']); ?>
          <details class="card">
            <summary style="padding:1.25rem;cursor:pointer;list-style:none">
              <div class="row-between">
                <span>
                  <span style="font-size:1.3rem"><?= Str::e($template['emoji']) ?></span>
                  <strong><?= Str::e($template['name']) ?></strong>
                  <?php if (Str::bool($template['is_premium'])): ?>
                    <span class="badge badge-primary">Paid plans</span>
                  <?php endif; ?>
                </span>
                <span class="small muted nowrap"><?= count($items) ?> items</span>
              </div>
              <?php if ($template['description']): ?>
                <p class="small muted mt-2"><?= Str::e($template['description']) ?></p>
              <?php endif; ?>
            </summary>

            <div style="padding:0 1.25rem 1.25rem">
              <ul class="list-plain">
                <?php foreach ($items as $item): ?>
                  <li class="row" style="align-items:flex-start;gap:0.55rem;margin-top:0.35rem">
                    <span class="<?= !empty($item['essential']) ? 'tone-danger' : 'muted' ?>">
                      <?= !empty($item['essential']) ? '★' : '○' ?>
                    </span>
                    <span class="small">
                      <?= Str::e($item['name'] ?? '') ?>
                      <?php if (!empty($item['category'])): ?>
                        <span class="tiny muted">· <?= Str::e($item['category']) ?></span>
                      <?php endif; ?>
                    </span>
                  </li>
                <?php endforeach; ?>
              </ul>

              <a class="btn btn-sm btn-outline mt-3"
                 href="<?= Auth::check() ? '/dashboard/checklists?template=' . Str::e($template['id']) : '/signup' ?>">
                Use this list
              </a>
            </div>
          </details>
        <?php endforeach; ?>
      </div>
    </div>
  </section>
<?php endforeach; ?>

<section class="section-tight">
  <div class="container">
    <div class="card card-accent">
      <div class="card-body center" style="padding:2.5rem 1.5rem">
        <h2>Tick them off together</h2>
        <p class="muted mt-2">Assign items to each other, and see who has actually done what.</p>
        <a class="btn btn-lg mt-3" href="/signup">Create a free account</a>
      </div>
    </div>
  </div>
</section>

<?php View::end(); ?>
