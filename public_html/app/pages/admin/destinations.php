<?php
declare(strict_types=1);

Auth::requireAdmin();

/*
 * Destinations are the travel catalogue the itinerary generator and the
 * public /destinations pages read from. Each row carries its own SEO fields
 * and feeds TouristDestination structured data.
 */

if (Request::isPost()) {
    $action = Request::input('action');
    $id = Request::input('id');

    if ($action === 'delete') {
        Db::delete('destinations', 'id = ?', [$id]);
        Audit::record('admin.destination.delete', 'destination', $id, 'Deleted a destination');
        Flash::success('Destination deleted.');
        Response::redirect('/admin/destinations');
    }

    if ($action === 'toggle') {
        Db::run('UPDATE destinations SET is_active = 1 - is_active WHERE id = ?', [$id]);
        Response::redirect('/admin/destinations');
    }

    if ($action === 'country') {
        $code = strtoupper(substr(Request::input('country_code'), 0, 2));
        if (strlen($code) !== 2) {
            Flash::error('A country needs a two-letter code.');
            Response::redirect('/admin/destinations');
        }

        Db::run(
            'UPDATE countries
                SET is_featured = ?, is_active = ?, best_season = ?, visa_note = ?,
                    meta_title = ?, meta_description = ?, summary = ?, sort_order = ?
              WHERE code = ?',
            [
                Request::bool('is_featured') ? 1 : 0,
                Request::bool('is_active') ? 1 : 0,
                Request::nullable('best_season'),
                Request::nullable('visa_note'),
                Request::nullable('meta_title'),
                Request::nullable('meta_description'),
                Request::nullable('summary'),
                Request::int('sort_order'),
                $code,
            ]
        );

        Audit::record('admin.country.save', 'country', $code, 'Updated country ' . $code);
        Flash::success('Country updated.');
        Response::redirect('/admin/destinations?country=' . urlencode($code));
    }

    // Saving a destination.
    $name = trim(Request::input('name'));
    $slug = Str::slug(Request::input('slug') !== '' ? Request::input('slug') : $name);
    $country = strtoupper(substr(Request::input('country_code'), 0, 2));

    if ($name === '' || $slug === '' || strlen($country) !== 2) {
        Flash::error('A destination needs a name, a slug and a country.');
        Response::redirect('/admin/destinations');
    }

    $types = ['city', 'beach', 'mountain', 'island', 'countryside', 'desert', 'lake',
              'historic', 'ski', 'safari', 'cruise'];
    $budgets = ['budget', 'moderate', 'premium', 'luxury'];

    $data = [
        'country_code'       => $country,
        'name'               => mb_substr($name, 0, 160),
        'slug'               => substr($slug, 0, 160),
        'city'               => Request::nullable('city'),
        'state_region'       => Request::nullable('state_region'),
        'destination_type'   => in_array(Request::input('destination_type'), $types, true)
            ? Request::input('destination_type')
            : 'city',
        'summary'            => Request::nullable('summary'),
        'description'        => Request::nullable('description'),
        'hero_image'         => Request::nullable('hero_image'),
        'latitude'           => Request::input('latitude') !== '' ? Request::float('latitude') : null,
        'longitude'          => Request::input('longitude') !== '' ? Request::float('longitude') : null,
        'avg_daily_cost_usd' => Request::int('avg_daily_cost_usd') ?: null,
        'honeymoon_score'    => (int) Str::clamp((float) Request::int('honeymoon_score'), 0, 100),
        'romance_score'      => (int) Str::clamp((float) Request::int('romance_score'), 0, 100),
        'budget_level'       => in_array(Request::input('budget_level'), $budgets, true)
            ? Request::input('budget_level')
            : 'moderate',
        'ideal_days'         => Request::int('ideal_days') ?: null,
        'best_months'        => json_encode(array_values(array_filter(
            array_map('trim', explode(',', Request::input('best_months')))
        ))),
        'tags'               => json_encode(array_values(array_filter(
            array_map('trim', explode(',', Request::input('tags')))
        ))),
        'highlights'         => json_encode(array_values(array_filter(
            array_map('trim', explode("\n", Request::raw('highlights')))
        ))),
        'keywords'           => json_encode(array_values(array_filter(
            array_map('trim', explode(',', Request::input('keywords')))
        ))),
        'is_honeymoon'       => Request::bool('is_honeymoon'),
        'is_featured'        => Request::bool('is_featured'),
        'is_active'          => Request::bool('is_active'),
        'meta_title'         => Request::nullable('meta_title'),
        'meta_description'   => Request::nullable('meta_description'),
    ];

    if ($id !== '') {
        $saved = Db::update('destinations', $id, $data);
    } else {
        if (Db::one('SELECT id FROM destinations WHERE slug = ? LIMIT 1', [$data['slug']])) {
            Flash::error('A destination with that slug already exists.');
            Response::redirect('/admin/destinations');
        }
        $saved = Db::insert('destinations', $data) !== null;
    }

    if (!$saved) {
        Flash::error('Could not save that destination: ' . (Db::lastError() ?? 'unknown database error'));
        Response::redirect('/admin/destinations');
    }

    Audit::record('admin.destination.save', 'destination', $data['slug'], 'Saved destination "' . $name . '"');
    Flash::success('Destination saved.');
    Response::redirect('/admin/destinations');
}

$countries = Db::all('SELECT code, name, flag_emoji, is_active, is_featured, is_tier1, sort_order,
                             best_season, visa_note, meta_title, meta_description, summary
                        FROM countries ORDER BY is_tier1 DESC, name ASC');

$filter = strtoupper(trim((string) ($_GET['country'] ?? '')));

$destinations = $filter !== ''
    ? Db::all('SELECT d.*, c.name AS country_name, c.flag_emoji
                 FROM destinations d LEFT JOIN countries c ON c.code = d.country_code
                WHERE d.country_code = ?
                ORDER BY d.is_featured DESC, d.name ASC', [$filter])
    : Db::all('SELECT d.*, c.name AS country_name, c.flag_emoji
                 FROM destinations d LEFT JOIN countries c ON c.code = d.country_code
                ORDER BY c.name ASC, d.name ASC LIMIT 300');

$editing = null;
if (($_GET['edit'] ?? '') !== '') {
    $editing = Db::one('SELECT * FROM destinations WHERE id = ? LIMIT 1', [$_GET['edit']]);
}

$editCountry = null;
if ($filter !== '') {
    foreach ($countries as $row) {
        if ($row['code'] === $filter) { $editCountry = $row; break; }
    }
}

$attractionCounts = [];
foreach (Db::all('SELECT destination_id, COUNT(*) AS total FROM attractions GROUP BY destination_id') as $row) {
    $attractionCounts[$row['destination_id']] = (int) $row['total'];
}

View::begin('layouts/admin', ['title' => 'Destinations', 'no_index' => true]);
?>

<div class="page-head">
  <div class="row-between">
    <div>
      <h1>Destinations</h1>
      <p>
        <?= number_format(Db::count('destinations')) ?> destinations across
        <?= number_format(count($countries)) ?> countries. These power the itinerary generator,
        the honeymoon finder and every <code>/destinations/…</code> landing page.
      </p>
    </div>
    <?php if ($editing || $filter !== ''): ?>
      <a class="btn btn-outline" href="/admin/destinations">Clear</a>
    <?php endif; ?>
  </div>
</div>

<div class="tabs">
  <a href="/admin/destinations" class="<?= $filter === '' ? 'is-active' : '' ?>">All</a>
  <?php foreach ($countries as $country): ?>
    <?php if (!Str::bool($country['is_tier1'])) { continue; } ?>
    <a href="/admin/destinations?country=<?= Str::e($country['code']) ?>"
       class="<?= $filter === $country['code'] ? 'is-active' : '' ?>">
      <?= Str::e($country['flag_emoji'] ?? '') ?> <?= Str::e($country['name']) ?>
    </a>
  <?php endforeach; ?>
</div>

<?php if ($editCountry): ?>
  <form method="post" class="card mb-3">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="country">
    <input type="hidden" name="country_code" value="<?= Str::e($editCountry['code']) ?>">

    <div class="card-head">
      <h2><?= Str::e($editCountry['flag_emoji'] ?? '') ?> <?= Str::e($editCountry['name']) ?> — country page</h2>
      <a class="small" href="/destinations/<?= Str::e(strtolower($editCountry['code'])) ?>" target="_blank">View →</a>
    </div>

    <div class="card-body">
      <div class="field-row">
        <div class="field">
          <label for="best_season">Best season</label>
          <input class="input" id="best_season" name="best_season"
                 value="<?= Str::e($editCountry['best_season'] ?? '') ?>" placeholder="May to September">
        </div>
        <div class="field">
          <label for="c_sort">Sort order</label>
          <input class="input" type="number" id="c_sort" name="sort_order"
                 value="<?= (int) ($editCountry['sort_order'] ?? 0) ?>">
        </div>
      </div>

      <div class="field">
        <label for="summary">Summary</label>
        <textarea class="textarea" rows="2" id="summary" name="summary"><?= Str::e($editCountry['summary'] ?? '') ?></textarea>
      </div>

      <div class="field">
        <label for="visa_note">Visa note</label>
        <textarea class="textarea" rows="2" id="visa_note" name="visa_note"><?= Str::e($editCountry['visa_note'] ?? '') ?></textarea>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="c_meta_title">Meta title</label>
          <input class="input" id="c_meta_title" name="meta_title" maxlength="250"
                 value="<?= Str::e($editCountry['meta_title'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="c_meta_desc">Meta description</label>
          <input class="input" id="c_meta_desc" name="meta_description"
                 value="<?= Str::e($editCountry['meta_description'] ?? '') ?>">
        </div>
      </div>

      <div class="row">
        <label class="checkbox">
          <input type="checkbox" name="is_featured" value="1"
                 <?= Str::bool($editCountry['is_featured']) ? 'checked' : '' ?>> Featured
        </label>
        <label class="checkbox">
          <input type="checkbox" name="is_active" value="1"
                 <?= Str::bool($editCountry['is_active']) ? 'checked' : '' ?>> Active
        </label>
      </div>

      <button class="btn mt-3" type="submit">Save country</button>
    </div>
  </form>
<?php endif; ?>

<form method="post" class="card">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="save">
  <input type="hidden" name="id" value="<?= Str::e($editing['id'] ?? '') ?>">

  <div class="card-head">
    <h2><?= $editing ? 'Edit: ' . Str::e($editing['name']) : 'Add a destination' ?></h2>
    <?php if ($editing): ?>
      <a class="small" href="/destinations/<?= Str::e($editing['slug']) ?>" target="_blank">View →</a>
    <?php endif; ?>
  </div>

  <div class="card-body">
    <div class="field-row">
      <div class="field">
        <label for="name">Name <span class="required">*</span></label>
        <input class="input" id="name" name="name" required maxlength="160"
               value="<?= Str::e($editing['name'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="slug">Slug</label>
        <input class="input mono" id="slug" name="slug" maxlength="160"
               value="<?= Str::e($editing['slug'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="country_code">Country <span class="required">*</span></label>
        <select class="select" id="country_code" name="country_code" required>
          <?php foreach ($countries as $country): ?>
            <option value="<?= Str::e($country['code']) ?>"
                    <?= ($editing['country_code'] ?? $filter) === $country['code'] ? 'selected' : '' ?>>
              <?= Str::e($country['flag_emoji'] ?? '') ?> <?= Str::e($country['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="city">City</label>
        <input class="input" id="city" name="city" value="<?= Str::e($editing['city'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="state_region">State / region</label>
        <input class="input" id="state_region" name="state_region"
               value="<?= Str::e($editing['state_region'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="destination_type">Type</label>
        <select class="select" id="destination_type" name="destination_type">
          <?= View::options([
              'city' => 'City', 'beach' => 'Beach', 'mountain' => 'Mountain', 'island' => 'Island',
              'countryside' => 'Countryside', 'desert' => 'Desert', 'lake' => 'Lake',
              'historic' => 'Historic', 'ski' => 'Ski', 'safari' => 'Safari', 'cruise' => 'Cruise',
          ], $editing['destination_type'] ?? 'city') ?>
        </select>
      </div>
      <div class="field">
        <label for="budget_level">Budget level</label>
        <select class="select" id="budget_level" name="budget_level">
          <?= View::options([
              'budget' => 'Budget', 'moderate' => 'Moderate', 'premium' => 'Premium', 'luxury' => 'Luxury',
          ], $editing['budget_level'] ?? 'moderate') ?>
        </select>
      </div>
    </div>

    <div class="field">
      <label for="d_summary">Summary</label>
      <textarea class="textarea" rows="2" id="d_summary" name="summary"><?= Str::e($editing['summary'] ?? '') ?></textarea>
    </div>

    <div class="field">
      <label for="description">Description (Markdown)</label>
      <textarea class="textarea" rows="8" id="description" name="description"><?= Str::e($editing['description'] ?? '') ?></textarea>
    </div>

    <div class="field">
      <label for="highlights">Highlights — one per line</label>
      <textarea class="textarea" rows="4" id="highlights"
                name="highlights"><?= Str::e(implode("\n", Str::json($editing['highlights'] ?? null))) ?></textarea>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="hero_image">Hero image URL</label>
        <input class="input" id="hero_image" name="hero_image" value="<?= Str::e($editing['hero_image'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="latitude">Latitude</label>
        <input class="input" type="number" step="0.000001" id="latitude" name="latitude"
               value="<?= Str::e($editing['latitude'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="longitude">Longitude</label>
        <input class="input" type="number" step="0.000001" id="longitude" name="longitude"
               value="<?= Str::e($editing['longitude'] ?? '') ?>">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="avg_daily_cost_usd">Average daily cost (USD)</label>
        <input class="input" type="number" min="0" id="avg_daily_cost_usd" name="avg_daily_cost_usd"
               value="<?= Str::e($editing['avg_daily_cost_usd'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="ideal_days">Ideal number of days</label>
        <input class="input" type="number" min="1" id="ideal_days" name="ideal_days"
               value="<?= Str::e($editing['ideal_days'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="honeymoon_score">Honeymoon score (0–100)</label>
        <input class="input" type="number" min="0" max="100" id="honeymoon_score" name="honeymoon_score"
               value="<?= (int) ($editing['honeymoon_score'] ?? 0) ?>">
      </div>
      <div class="field">
        <label for="romance_score">Romance score (0–100)</label>
        <input class="input" type="number" min="0" max="100" id="romance_score" name="romance_score"
               value="<?= (int) ($editing['romance_score'] ?? 0) ?>">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="best_months">Best months — comma separated</label>
        <input class="input" id="best_months" name="best_months"
               value="<?= Str::e(implode(', ', Str::json($editing['best_months'] ?? null))) ?>"
               placeholder="May, June, September">
      </div>
      <div class="field">
        <label for="tags">Tags — comma separated</label>
        <input class="input" id="tags" name="tags"
               value="<?= Str::e(implode(', ', Str::json($editing['tags'] ?? null))) ?>">
      </div>
    </div>

    <hr class="divider">
    <h3 style="font-family:var(--font);font-size:1rem">Search engine settings</h3>

    <div class="field-row mt-2">
      <div class="field">
        <label for="meta_title">Meta title</label>
        <input class="input" id="meta_title" name="meta_title" maxlength="250"
               value="<?= Str::e($editing['meta_title'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="keywords">Keywords — comma separated</label>
        <input class="input" id="keywords" name="keywords"
               value="<?= Str::e(implode(', ', Str::json($editing['keywords'] ?? null))) ?>">
      </div>
    </div>

    <div class="field">
      <label for="meta_description">Meta description</label>
      <textarea class="textarea" rows="2" id="meta_description"
                name="meta_description"><?= Str::e($editing['meta_description'] ?? '') ?></textarea>
    </div>

    <div class="row">
      <label class="checkbox">
        <input type="checkbox" name="is_honeymoon" value="1"
               <?= Str::bool($editing['is_honeymoon'] ?? false) ? 'checked' : '' ?>> Honeymoon pick
      </label>
      <label class="checkbox">
        <input type="checkbox" name="is_featured" value="1"
               <?= Str::bool($editing['is_featured'] ?? false) ? 'checked' : '' ?>> Featured
      </label>
      <label class="checkbox">
        <input type="checkbox" name="is_active" value="1"
               <?= Str::bool($editing['is_active'] ?? true) ? 'checked' : '' ?>> Active
      </label>
    </div>

    <button class="btn btn-lg mt-3" type="submit"><?= $editing ? 'Save destination' : 'Add destination' ?></button>
  </div>
</form>

<div class="card mt-3">
  <div class="card-head"><h2><?= count($destinations) ?> shown</h2></div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Destination</th><th>Country</th><th>Type</th><th class="right">Honeymoon</th>
            <th class="right">Cost/day</th><th class="right">Spots</th><th>State</th><th></th></tr>
      </thead>
      <tbody>
        <?php foreach ($destinations as $destination): ?>
          <tr>
            <td>
              <span class="bold"><?= Str::e($destination['name']) ?></span>
              <span class="tiny muted mono" style="display:block">/destinations/<?= Str::e($destination['slug']) ?></span>
            </td>
            <td class="small muted nowrap">
              <?= Str::e($destination['flag_emoji'] ?? '') ?> <?= Str::e($destination['country_name'] ?? '') ?>
            </td>
            <td class="small muted"><?= Str::e($destination['destination_type']) ?></td>
            <td class="right tabular small"><?= (int) $destination['honeymoon_score'] ?></td>
            <td class="right tabular small">
              <?= $destination['avg_daily_cost_usd'] !== null
                  ? '$' . number_format((int) $destination['avg_daily_cost_usd'])
                  : '—' ?>
            </td>
            <td class="right tabular small"><?= (int) ($attractionCounts[$destination['id']] ?? 0) ?></td>
            <td class="nowrap">
              <span class="badge badge-<?= Str::bool($destination['is_active']) ? 'success' : 'outline' ?>">
                <?= Str::bool($destination['is_active']) ? 'live' : 'off' ?>
              </span>
              <?php if (Str::bool($destination['is_honeymoon'])): ?>
                <span class="badge badge-primary">honeymoon</span>
              <?php endif; ?>
            </td>
            <td class="right nowrap">
              <a class="btn btn-sm btn-outline" href="/admin/destinations?edit=<?= Str::e($destination['id']) ?>">Edit</a>
              <form method="post" style="display:inline">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="toggle">
                <input type="hidden" name="id" value="<?= Str::e($destination['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">
                  <?= Str::bool($destination['is_active']) ? 'Hide' : 'Show' ?>
                </button>
              </form>
              <form method="post" style="display:inline"
                    data-confirm="Delete this destination and its attractions?">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= Str::e($destination['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">×</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
