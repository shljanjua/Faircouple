<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

$trip = Db::one(
    'SELECT t.*, d.id AS dest_id, d.name AS dest_name, d.slug AS dest_slug, d.city AS dest_city,
            d.hero_image, d.ideal_days, d.avg_daily_cost_usd, d.highlights,
            c.name AS country_name, c.flag_emoji
       FROM trips t
       LEFT JOIN destinations d ON d.id = t.destination_id
       LEFT JOIN countries c ON c.code = t.country_code
      WHERE t.id = ? AND t.couple_id = ? LIMIT 1',
    [$params['id'], $coupleId]
);

if (!$trip) {
    Response::notFound('That trip does not exist in your space.');
}

$entitlements = Auth::entitlements();
$canGenerate = Plans::allows($entitlements['limits'], 'itinerary_generator');

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'update') {
        Db::update('trips', $trip['id'], [
            'title'        => mb_substr(Request::input('title', $trip['title']), 0, 190),
            'status'       => Request::input('status', $trip['status']),
            'start_date'   => Request::date('start_date'),
            'end_date'     => Request::date('end_date'),
            'travelers'    => max(1, Request::int('travelers', (int) $trip['travelers'])),
            'budget_cents' => Request::cents('budget'),
            'notes'        => Request::nullable('notes'),
        ]);
        Flash::success('Trip updated.');
        Response::redirect('/dashboard/travel/' . $trip['id']);
    }

    if ($action === 'generate') {
        if (!$canGenerate) {
            Flash::error(Plans::upgradeMessage('itinerary_generator'));
            Response::redirect('/dashboard/travel/' . $trip['id']);
        }

        if (!$trip['dest_id']) {
            Flash::error('Pick a destination for this trip first.');
            Response::redirect('/dashboard/travel/' . $trip['id']);
        }

        $attractions = Db::all('SELECT * FROM attractions WHERE destination_id = ? ORDER BY sort_order ASC', [$trip['dest_id']]);

        $daysFromDates = ($trip['start_date'] && $trip['end_date'])
            ? (int) floor((strtotime((string) $trip['end_date']) - strtotime((string) $trip['start_date'])) / 86400) + 1
            : null;

        $requested = Request::int('days', 0);
        $days = max(1, min(21, $requested > 0 ? $requested : ($daysFromDates ?? (int) ($trip['ideal_days'] ?: 5))));

        $interests = array_values(array_filter((array) ($_POST['interests'] ?? [])));

        $plan = Itinerary::generate([
            'destination'   => [
                'name'               => $trip['dest_name'],
                'city'               => $trip['dest_city'],
                'avg_daily_cost_usd' => $trip['avg_daily_cost_usd'],
                'highlights'         => $trip['highlights'],
            ],
            'attractions'   => $attractions,
            'start_date'    => $trip['start_date'] ? substr((string) $trip['start_date'], 0, 10) : null,
            'days'          => $days,
            'pace'          => Request::input('pace', 'balanced'),
            'interests'     => $interests,
            'include_meals' => Request::bool('include_meals'),
            'romantic'      => Request::bool('romantic'),
        ]);

        Itinerary::save(
            $trip['id'],
            $coupleId,
            $trip,
            ['name' => $trip['dest_name']],
            $plan,
            Request::input('pace', 'balanced'),
            $interests
        );

        Flash::success('Generated a ' . $days . '-day itinerary.');
        Response::redirect('/dashboard/travel/' . $trip['id']);
    }

    if ($action === 'toggle_item') {
        Db::run(
            'UPDATE itinerary_items i
               JOIN itinerary_days d ON d.id = i.day_id
               JOIN itineraries it ON it.id = d.itinerary_id
                SET i.is_done = 1 - i.is_done
              WHERE i.id = ? AND it.couple_id = ?',
            [Request::input('id'), $coupleId]
        );
        Response::redirect('/dashboard/travel/' . $trip['id']);
    }

    if ($action === 'add_item') {
        $dayId = Request::input('day_id');
        $owns = Db::one(
            'SELECT d.id FROM itinerary_days d JOIN itineraries it ON it.id = d.itinerary_id
              WHERE d.id = ? AND it.couple_id = ? LIMIT 1',
            [$dayId, $coupleId]
        );

        if ($owns && Request::input('title') !== '') {
            Db::insert('itinerary_items', [
                'day_id'     => $dayId,
                'title'      => mb_substr(Request::input('title'), 0, 190),
                'item_type'  => Request::input('item_type', 'activity'),
                'start_time' => Request::nullable('start_time'),
                'location'   => Request::nullable('location'),
                'cost_cents' => Request::cents('cost'),
                'currency'   => $trip['currency'],
                'sort_order' => 99,
            ]);
        }

        Response::redirect('/dashboard/travel/' . $trip['id']);
    }

    if ($action === 'delete_item') {
        Db::run(
            'DELETE i FROM itinerary_items i
               JOIN itinerary_days d ON d.id = i.day_id
               JOIN itineraries it ON it.id = d.itinerary_id
              WHERE i.id = ? AND it.couple_id = ?',
            [Request::input('id'), $coupleId]
        );
        Response::redirect('/dashboard/travel/' . $trip['id']);
    }
}

/* ------------------------------------------------------------------ Reading */

$itinerary = Db::one('SELECT * FROM itineraries WHERE trip_id = ? ORDER BY created_at DESC LIMIT 1', [$trip['id']]);

$days = [];
if ($itinerary) {
    $dayRows = Db::all('SELECT * FROM itinerary_days WHERE itinerary_id = ? ORDER BY day_number ASC', [$itinerary['id']]);

    if ($dayRows !== []) {
        $dayIds = array_column($dayRows, 'id');
        $itemRows = Db::all(
            'SELECT * FROM itinerary_items WHERE day_id IN (' . Db::placeholders($dayIds) . ')
              ORDER BY start_time ASC, sort_order ASC',
            $dayIds
        );

        foreach ($dayRows as $day) {
            $day['items'] = array_values(array_filter($itemRows, static fn ($item) => $item['day_id'] === $day['id']));
            $days[] = $day;
        }
    }
}

$documents = Db::all('SELECT * FROM travel_documents WHERE trip_id = ? ORDER BY depart_at ASC', [$trip['id']]);
$expenses = Db::all('SELECT * FROM expenses WHERE trip_id = ? ORDER BY spent_on DESC', [$trip['id']]);
$checklists = Db::all('SELECT * FROM checklists WHERE trip_id = ? ORDER BY created_at ASC', [$trip['id']]);
$spent = array_sum(array_map(static fn ($e) => (int) $e['amount_cents'], $expenses));

View::begin('layouts/app', ['title' => $trip['title'], 'no_index' => true]);
?>

<p class="small"><a href="/dashboard/travel">← All trips</a></p>

<div class="page-head mt-2">
  <div class="row-between">
    <div>
      <h1><?= Str::e($trip['flag_emoji']) ?> <?= Str::e($trip['title']) ?></h1>
      <p>
        <?php if ($trip['dest_name']): ?>
          <a href="/destinations/<?= Str::e($trip['dest_slug']) ?>" target="_blank"><?= Str::e($trip['dest_name']) ?></a> ·
        <?php endif; ?>
        <?= Str::e(ucfirst($trip['trip_type'])) ?> ·
        <?= $trip['start_date'] ? Str::e(Str::date($trip['start_date']) . ' – ' . Str::date($trip['end_date'])) : 'No dates yet' ?>
      </p>
    </div>
    <span class="badge badge-<?= $trip['status'] === 'booked' ? 'success' : 'warning' ?>"><?= Str::e($trip['status']) ?></span>
  </div>
</div>

<div class="grid grid-4">
  <div class="card stat">
    <p class="stat-label">Budget</p>
    <p class="stat-value tabular" style="font-size:1.4rem">
      <?= $trip['budget_cents'] ? Str::e(Currency::pretty((int) $trip['budget_cents'], $trip['currency'])) : '—' ?>
    </p>
  </div>
  <div class="card stat">
    <p class="stat-label">Spent</p>
    <p class="stat-value tabular" style="font-size:1.4rem"><?= Str::e(Currency::pretty($spent, $trip['currency'])) ?></p>
  </div>
  <div class="card stat">
    <p class="stat-label">Documents</p>
    <p class="stat-value" style="font-size:1.4rem"><?= count($documents) ?></p>
  </div>
  <div class="card stat">
    <p class="stat-label">Days planned</p>
    <p class="stat-value" style="font-size:1.4rem"><?= count($days) ?></p>
  </div>
</div>

<div class="grid grid-sidebar mt-3">
  <div class="stack">
    <div class="card">
      <div class="card-head">
        <h2>Itinerary</h2>
        <?php if ($itinerary): ?>
          <span class="small muted">
            <?= Str::e(ucfirst($itinerary['pace'])) ?> pace ·
            about <?= Str::e(Currency::pretty((int) $itinerary['total_cost_cents'], $itinerary['currency'])) ?>
          </span>
        <?php endif; ?>
      </div>

      <div class="card-body">
        <?php if ($days === []): ?>
          <div class="empty">
            <p class="empty-emoji">🗺️</p>
            <p class="bold">No itinerary yet</p>
            <p>
              <?php if (!$trip['dest_id']): ?>
                Add a destination to this trip and the generator can build your days.
              <?php else: ?>
                Use the generator on the right — it builds real days from real attractions.
              <?php endif; ?>
            </p>
          </div>
        <?php else: ?>
          <div class="stack-lg">
            <?php foreach ($days as $day): ?>
              <section>
                <div class="row-between">
                  <h3 style="font-family:var(--font);font-size:1rem">
                    Day <?= (int) $day['day_number'] ?> — <?= Str::e($day['title']) ?>
                  </h3>
                  <span class="tiny muted"><?= Str::e(Str::date($day['day_date'])) ?></span>
                </div>
                <p class="small muted"><?= Str::e($day['summary']) ?></p>

                <ul class="list-plain mt-2">
                  <?php foreach ($day['items'] as $item): ?>
                    <li class="row-between" style="gap:0.5rem;padding-block:0.25rem">
                      <form method="post" class="row" style="gap:0.6rem;flex:1;min-width:0">
                        <?= Csrf::field() ?>
                        <input type="hidden" name="action" value="toggle_item">
                        <input type="hidden" name="id" value="<?= Str::e($item['id']) ?>">
                        <button class="btn btn-ghost btn-icon" type="submit" aria-label="Toggle">
                          <?= Str::bool($item['is_done']) ? '☑' : '☐' ?>
                        </button>
                        <span class="small" style="flex:1;min-width:0">
                          <span class="mono tiny muted"><?= Str::e(substr((string) $item['start_time'], 0, 5)) ?></span>
                          <strong style="<?= Str::bool($item['is_done']) ? 'text-decoration:line-through;opacity:.6' : '' ?>">
                            <?= Str::e($item['title']) ?>
                          </strong>
                          <span class="badge"><?= Str::e($item['item_type']) ?></span>
                          <?php if ($item['description']): ?>
                            <span class="tiny muted" style="display:block"><?= Str::e($item['description']) ?></span>
                          <?php endif; ?>
                        </span>
                      </form>

                      <span class="row nowrap" style="gap:0.3rem">
                        <?php if ($item['cost_cents']): ?>
                          <span class="small tabular muted">
                            <?= Str::e(Currency::pretty((int) $item['cost_cents'], $item['currency'] ?: $trip['currency'])) ?>
                          </span>
                        <?php endif; ?>
                        <form method="post">
                          <?= Csrf::field() ?>
                          <input type="hidden" name="action" value="delete_item">
                          <input type="hidden" name="id" value="<?= Str::e($item['id']) ?>">
                          <button class="btn btn-sm btn-ghost" type="submit" aria-label="Remove">✕</button>
                        </form>
                      </span>
                    </li>
                  <?php endforeach; ?>
                </ul>

                <form method="post" class="row mt-2" style="gap:0.4rem;flex-wrap:nowrap">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="add_item">
                  <input type="hidden" name="day_id" value="<?= Str::e($day['id']) ?>">
                  <label class="sr-only" for="time-<?= Str::e($day['id']) ?>">Time</label>
                  <input class="input" type="time" id="time-<?= Str::e($day['id']) ?>" name="start_time" style="width:auto">
                  <label class="sr-only" for="item-<?= Str::e($day['id']) ?>">Add a stop</label>
                  <input class="input" id="item-<?= Str::e($day['id']) ?>" name="title" placeholder="Add a stop…" style="flex:1">
                  <button class="btn btn-icon" type="submit" aria-label="Add">+</button>
                </form>
              </section>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>
    </div>

    <?php if ($documents !== []): ?>
      <div class="card">
        <div class="card-head">
          <h2>Tickets for this trip</h2>
          <a class="small" href="/dashboard/documents">Add one →</a>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Document</th><th>When</th><th class="right"></th></tr></thead>
            <tbody>
              <?php foreach ($documents as $doc): ?>
                <tr>
                  <td>
                    <span class="bold"><?= Str::e($doc['title']) ?></span>
                    <span class="tiny muted" style="display:block"><?= Str::e(ucfirst($doc['doc_type'])) ?></span>
                  </td>
                  <td class="small muted nowrap"><?= Str::e(Str::dateTime($doc['depart_at'])) ?></td>
                  <td class="right">
                    <?php if ($doc['file_path']): ?>
                      <a class="btn btn-sm btn-outline" target="_blank" rel="noopener"
                         href="<?= Str::e(Storage::url('documents', $doc['file_path'])) ?>">Open</a>
                    <?php endif; ?>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <aside class="stack">
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="generate">

      <div class="card-head"><h2>Itinerary generator</h2></div>
      <div class="card-body">
        <?php if (!$canGenerate): ?>
          <div class="alert alert-warning">
            <div><?= Str::e(Plans::upgradeMessage('itinerary_generator')) ?></div>
          </div>
          <a class="btn btn-block mt-2" href="/pricing">See the plans</a>
        <?php elseif (!$trip['dest_id']): ?>
          <p class="small muted">Add a destination to this trip first — the generator builds days from real attractions.</p>
        <?php else: ?>
          <div class="field">
            <label for="days">How many days</label>
            <input class="input" type="number" min="1" max="21" id="days" name="days"
                   value="<?= (int) ($trip['ideal_days'] ?: 5) ?>">
          </div>

          <div class="field">
            <label for="pace">Pace</label>
            <select class="select" id="pace" name="pace">
              <option value="relaxed">Relaxed — two things a day</option>
              <option value="balanced" selected>Balanced — three things a day</option>
              <option value="packed">Packed — five things a day</option>
            </select>
          </div>

          <fieldset class="field">
            <legend class="label">Interests</legend>
            <div class="row" style="gap:0.4rem">
              <?php foreach (Itinerary::INTERESTS as $interest): ?>
                <label class="badge" style="cursor:pointer;padding:0.35rem 0.6rem">
                  <input type="checkbox" name="interests[]" value="<?= Str::e($interest['value']) ?>"
                         style="margin-right:0.25rem;accent-color:hsl(var(--primary))"
                         <?= in_array($interest['value'], ['romance', 'food'], true) ? 'checked' : '' ?>>
                  <?= Str::e($interest['emoji'] . ' ' . $interest['label']) ?>
                </label>
              <?php endforeach; ?>
            </div>
          </fieldset>

          <label class="checkbox"><input type="checkbox" name="include_meals" value="1" checked>
            <span class="small">Include meals</span></label>
          <label class="checkbox"><input type="checkbox" name="romantic" value="1" checked>
            <span class="small">Favour romantic spots</span></label>

          <button class="btn btn-block mt-3" type="submit">
            <?= $days === [] ? 'Generate the itinerary' : 'Regenerate' ?>
          </button>
          <?php if ($days !== []): ?>
            <p class="tiny muted mt-2">Regenerating replaces the generated days. Stops you added by hand are removed too.</p>
          <?php endif; ?>
        <?php endif; ?>
      </div>
    </form>

    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="update">

      <div class="card-head"><h2>Trip details</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="title">Title</label>
          <input class="input" id="title" name="title" value="<?= Str::e($trip['title']) ?>" maxlength="190">
        </div>
        <div class="field">
          <label for="status">Status</label>
          <select class="select" id="status" name="status">
            <?= View::options([
                'idea' => 'Idea', 'planning' => 'Planning', 'booked' => 'Booked',
                'ongoing' => 'Ongoing', 'completed' => 'Completed', 'cancelled' => 'Cancelled',
            ], $trip['status']) ?>
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="start_date">From</label>
            <input class="input" type="date" id="start_date" name="start_date"
                   value="<?= Str::e(substr((string) $trip['start_date'], 0, 10)) ?>">
          </div>
          <div class="field">
            <label for="end_date">To</label>
            <input class="input" type="date" id="end_date" name="end_date"
                   value="<?= Str::e(substr((string) $trip['end_date'], 0, 10)) ?>">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="travelers">Travellers</label>
            <input class="input" type="number" min="1" max="12" id="travelers" name="travelers"
                   value="<?= (int) $trip['travelers'] ?>">
          </div>
          <div class="field">
            <label for="budget">Budget</label>
            <input class="input" type="number" step="0.01" min="0" id="budget" name="budget"
                   value="<?= $trip['budget_cents'] ? number_format(((int) $trip['budget_cents']) / 100, 2, '.', '') : '' ?>">
          </div>
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea class="textarea" rows="3" id="notes" name="notes"><?= Str::e($trip['notes'] ?? '') ?></textarea>
        </div>

        <button class="btn btn-outline btn-block mt-2" type="submit">Save changes</button>
      </div>
    </form>

    <?php if ($checklists !== []): ?>
      <div class="card">
        <div class="card-body">
          <h2 style="font-size:1rem">Checklists for this trip</h2>
          <ul class="list-plain small mt-2">
            <?php foreach ($checklists as $checklist): ?>
              <li><a href="/dashboard/checklists#list-<?= Str::e($checklist['id']) ?>">
                <?= Str::e($checklist['emoji']) ?> <?= Str::e($checklist['title']) ?>
              </a></li>
            <?php endforeach; ?>
          </ul>
        </div>
      </div>
    <?php endif; ?>
  </aside>
</div>

<?php View::end(); ?>
