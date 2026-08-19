<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$currency = $context['couple']['currency'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'delete') {
        Db::delete('trips', 'id = ? AND couple_id = ?', [Request::input('id'), $coupleId]);
        Flash::success('Trip deleted.');
        Response::redirect('/dashboard/travel');
    }

    $title = Request::input('title');
    if ($title === '') {
        Flash::error('Give the trip a title.');
        Response::redirect('/dashboard/travel');
    }

    $limitError = Plans::check('trips', 'trips', 'status <> "cancelled"');
    if ($limitError !== null) {
        Flash::error($limitError);
        Response::redirect('/dashboard/travel');
    }

    $destinationId = Request::nullable('destination_id');
    $countryCode = null;
    $coverImage = null;

    if ($destinationId !== null) {
        $destination = Db::one('SELECT country_code, hero_image FROM destinations WHERE id = ? LIMIT 1', [$destinationId]);
        if ($destination) {
            $countryCode = $destination['country_code'];
            $coverImage = $destination['hero_image'];
        }
    }

    $tripId = Db::insert('trips', [
        'couple_id'      => $coupleId,
        'destination_id' => $destinationId,
        'country_code'   => $countryCode,
        'title'          => mb_substr($title, 0, 190),
        'trip_type'      => Request::input('trip_type', 'vacation'),
        'status'         => Request::input('status', 'planning'),
        'start_date'     => Request::date('start_date'),
        'end_date'       => Request::date('end_date'),
        'travelers'      => max(1, Request::int('travelers', 2)),
        'budget_cents'   => Request::cents('budget'),
        'currency'       => Currency::normalise(Request::input('currency', $currency)),
        'cover_image'    => $coverImage,
        'notes'          => Request::nullable('notes'),
        'created_by'     => $user['id'],
    ]);

    Flash::success('Trip created. Generate the itinerary next.');
    Response::redirect('/dashboard/travel/' . $tripId);
}

$trips = Db::all(
    'SELECT t.*, d.name AS destination_name, d.slug AS destination_slug, c.flag_emoji,
            (SELECT COUNT(*) FROM travel_documents td WHERE td.trip_id = t.id) AS document_count,
            (SELECT COALESCE(SUM(e.amount_cents),0) FROM expenses e WHERE e.trip_id = t.id) AS spent_cents
       FROM trips t
       LEFT JOIN destinations d ON d.id = t.destination_id
       LEFT JOIN countries c ON c.code = t.country_code
      WHERE t.couple_id = ?
      ORDER BY t.start_date IS NULL, t.start_date ASC',
    [$coupleId]
);

$destinations = Db::all('SELECT id, name, country_code FROM destinations WHERE is_active = 1 ORDER BY popularity DESC LIMIT 200');

View::begin('layouts/app', ['title' => 'Travel', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Travel</h1>
  <p>Plan the trip, generate the days, split the cost fairly and keep every ticket in one place.</p>
</div>

<div class="grid grid-sidebar">
  <div class="stack">
    <?php if ($trips === []): ?>
      <div class="card"><div class="card-body empty">
        <p class="empty-emoji">✈️</p>
        <p class="bold">No trips planned yet</p>
        <p>Pick a destination on the right, and the generator will lay out your days.</p>
        <a class="btn btn-outline mt-3" href="/destinations" target="_blank">Browse destinations</a>
      </div></div>
    <?php else: ?>
      <?php foreach ($trips as $trip): ?>
        <?php
        $days = ($trip['start_date'] && $trip['end_date'])
            ? (int) floor((strtotime((string) $trip['end_date']) - strtotime((string) $trip['start_date'])) / 86400) + 1
            : null;
        $countdown = $trip['start_date']
            ? (int) floor((strtotime((string) $trip['start_date']) - time()) / 86400)
            : null;
        ?>
        <article class="card">
          <div class="card-body">
            <div class="row-between">
              <div style="flex:1;min-width:0">
                <h2 style="font-family:var(--font);font-size:1.1rem">
                  <a href="/dashboard/travel/<?= Str::e($trip['id']) ?>" style="color:inherit">
                    <?= Str::e($trip['flag_emoji']) ?> <?= Str::e($trip['title']) ?>
                  </a>
                </h2>
                <p class="small muted mt-1">
                  <?php if ($trip['destination_name']): ?><?= Str::e($trip['destination_name']) ?> · <?php endif; ?>
                  <?= Str::e(ucfirst($trip['trip_type'])) ?>
                  · <?= (int) $trip['travelers'] ?> travellers
                  <?php if ($days): ?> · <?= $days ?> days<?php endif; ?>
                </p>
                <p class="small mt-1">
                  <?php if ($trip['start_date']): ?>
                    <?= Str::e(Str::date($trip['start_date'])) ?> – <?= Str::e(Str::date($trip['end_date'])) ?>
                    <?php if ($countdown !== null && $countdown >= 0): ?>
                      <span class="badge badge-primary">in <?= $countdown ?> days</span>
                    <?php endif; ?>
                  <?php else: ?>
                    <span class="muted">No dates yet</span>
                  <?php endif; ?>
                </p>
              </div>

              <div class="right nowrap">
                <span class="badge badge-<?= $trip['status'] === 'booked' ? 'success' : ($trip['status'] === 'completed' ? 'outline' : 'warning') ?>">
                  <?= Str::e($trip['status']) ?>
                </span>
                <?php if ($trip['budget_cents']): ?>
                  <p class="small tabular mt-2">
                    <?= Str::e(Currency::pretty((int) $trip['spent_cents'], $trip['currency'])) ?>
                    <span class="muted">/ <?= Str::e(Currency::pretty((int) $trip['budget_cents'], $trip['currency'])) ?></span>
                  </p>
                <?php endif; ?>
              </div>
            </div>

            <?php if ($trip['budget_cents']): ?>
              <?php $percent = ((int) $trip['spent_cents'] / max(1, (int) $trip['budget_cents'])) * 100; ?>
              <div class="mt-2"><?= View::meter($percent, 100, $percent > 100 ? 'danger' : 'primary') ?></div>
            <?php endif; ?>

            <div class="row-between mt-3">
              <span class="tiny muted"><?= (int) $trip['document_count'] ?> documents in the vault</span>
              <span class="row" style="gap:0.4rem">
                <a class="btn btn-sm btn-outline" href="/dashboard/travel/<?= Str::e($trip['id']) ?>">Open</a>
                <form method="post" data-confirm="Delete this trip and its itinerary?">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= Str::e($trip['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit">Delete</button>
                </form>
              </span>
            </div>
          </div>
        </article>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>

  <aside>
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="create">

      <div class="card-head"><h2>Plan a trip</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="title">Trip name <span class="required">*</span></label>
          <input class="input" id="title" name="title" required maxlength="190" placeholder="Our honeymoon">
        </div>

        <div class="field">
          <label for="destination_id">Destination</label>
          <select class="select" id="destination_id" name="destination_id">
            <option value="">Not decided yet</option>
            <?php foreach ($destinations as $destination): ?>
              <option value="<?= Str::e($destination['id']) ?>">
                <?= Str::e($destination['name']) ?> (<?= Str::e($destination['country_code']) ?>)
              </option>
            <?php endforeach; ?>
          </select>
          <span class="hint">Picking one turns on the itinerary generator.</span>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="start_date">From</label>
            <input class="input" type="date" id="start_date" name="start_date">
          </div>
          <div class="field">
            <label for="end_date">To</label>
            <input class="input" type="date" id="end_date" name="end_date">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="trip_type">Type</label>
            <select class="select" id="trip_type" name="trip_type">
              <?= View::options([
                  'honeymoon' => 'Honeymoon', 'vacation' => 'Holiday', 'weekend' => 'Weekend',
                  'anniversary' => 'Anniversary', 'adventure' => 'Adventure', 'roadtrip' => 'Road trip',
                  'family' => 'Family', 'business' => 'Business',
              ], 'vacation') ?>
            </select>
          </div>
          <div class="field">
            <label for="travelers">Travellers</label>
            <input class="input" type="number" min="1" max="12" id="travelers" name="travelers" value="2">
          </div>
        </div>

        <div class="field">
          <label for="budget">Budget</label>
          <input class="input" type="number" step="0.01" min="0" id="budget" name="budget">
        </div>

        <div class="field">
          <label for="notes">Notes</label>
          <textarea class="textarea" rows="2" id="notes" name="notes"></textarea>
        </div>

        <button class="btn btn-block mt-2" type="submit">Create trip</button>
      </div>
    </form>
  </aside>
</div>

<?php View::end(); ?>
