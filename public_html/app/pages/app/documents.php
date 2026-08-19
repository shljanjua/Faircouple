<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$currency = $context['couple']['currency'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'delete') {
        $doc = Db::one('SELECT * FROM travel_documents WHERE id = ? AND couple_id = ? LIMIT 1', [Request::input('id'), $coupleId]);
        if ($doc) {
            Db::delete('travel_documents', 'id = ? AND couple_id = ?', [$doc['id'], $coupleId]);
            Storage::delete('documents', $doc['file_path']);
            Flash::success('Removed from the vault.');
        }
        Response::redirect('/dashboard/documents');
    }

    // Saving a document.
    $title = Request::input('title');
    if ($title === '') {
        Flash::error('Give the document a title.');
        Response::redirect('/dashboard/documents');
    }

    $limitError = Plans::check('documents', 'travel_documents');
    if ($limitError !== null) {
        Flash::error($limitError);
        Response::redirect('/dashboard/documents');
    }

    $stored = null;
    if (!empty($_FILES['file']['name'])) {
        $quotaError = Plans::storageProblem($coupleId, (int) ($_FILES['file']['size'] ?? 0));
        if ($quotaError !== null) {
            Flash::error($quotaError);
            Response::redirect('/dashboard/documents');
        }

        $stored = Storage::store($_FILES['file'], 'documents', $coupleId, $user['id'], 'doc');
        if (!$stored['ok']) {
            Flash::error($stored['error']);
            Response::redirect('/dashboard/documents');
        }
    }

    Db::insert('travel_documents', [
        'couple_id'         => $coupleId,
        'user_id'           => $user['id'],
        'trip_id'           => Request::nullable('trip_id'),
        'doc_type'          => Request::input('doc_type', 'other'),
        'title'             => mb_substr($title, 0, 190),
        'provider'          => Request::nullable('provider'),
        'confirmation_code' => Request::nullable('confirmation_code'),
        'booking_reference' => Request::nullable('booking_reference'),
        'passenger_names'   => Request::nullable('passenger_names'),
        'origin'            => Request::nullable('origin'),
        'destination'       => Request::nullable('destination'),
        'depart_at'         => Request::dateTime('depart_at'),
        'arrive_at'         => Request::dateTime('arrive_at'),
        'check_in'          => Request::date('check_in'),
        'check_out'         => Request::date('check_out'),
        'seat'              => Request::nullable('seat'),
        'terminal'          => Request::nullable('terminal'),
        'gate'              => Request::nullable('gate'),
        'amount_cents'      => Request::cents('amount'),
        'currency'          => Currency::normalise(Request::input('currency', $currency)),
        'expires_at'        => Request::date('expires_at'),
        'file_path'         => $stored['path'] ?? null,
        'file_name'         => $stored['name'] ?? null,
        'file_mime'         => $stored['mime'] ?? null,
        'file_size'         => $stored['size'] ?? null,
        'notes'             => Request::nullable('notes'),
        'is_shared'         => !Request::bool('private_doc'),
    ]);

    Flash::success('Saved to the vault. Both of you can reach it from any device.');
    Response::redirect('/dashboard/documents');
}

$filter = trim((string) ($_GET['type'] ?? ''));

$where = 'couple_id = ? AND (is_shared = 1 OR user_id = ?)';
$queryParams = [$coupleId, $user['id']];

if ($filter !== '') {
    $where .= ' AND doc_type = ?';
    $queryParams[] = $filter;
}

$documents = Db::all(
    "SELECT * FROM travel_documents WHERE {$where}
      ORDER BY depart_at IS NULL, depart_at ASC, created_at DESC",
    $queryParams
);

$trips = Db::all('SELECT id, title FROM trips WHERE couple_id = ? AND status <> "cancelled" ORDER BY start_date DESC', [$coupleId]);

$upcoming = Db::all(
    'SELECT * FROM travel_documents
      WHERE couple_id = ? AND depart_at > UTC_TIMESTAMP()
      ORDER BY depart_at ASC LIMIT 3',
    [$coupleId]
);

$types = [
    'flight' => '✈️ Flight', 'hotel' => '🏨 Hotel', 'train' => '🚆 Train', 'bus' => '🚌 Bus',
    'car_rental' => '🚗 Car hire', 'cruise' => '🚢 Cruise', 'attraction' => '🎟️ Attraction',
    'restaurant' => '🍽️ Restaurant', 'insurance' => '🛡️ Insurance', 'visa' => '📋 Visa',
    'passport' => '🛂 Passport', 'vaccination' => '💉 Vaccination', 'other' => '📄 Other',
];

View::begin('layouts/app', ['title' => 'Ticket vault', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Ticket vault</h1>
  <p>
    Flights, hotels, attraction passes, insurance and visas. Both of you can reach them from any device —
    and nobody else can, because every download re-checks your session.
  </p>
</div>

<?php if ($upcoming !== []): ?>
  <div class="card card-accent mb-2">
    <div class="card-body">
      <h2 style="font-size:1rem">Coming up</h2>
      <ul class="list-plain mt-2">
        <?php foreach ($upcoming as $item): ?>
          <li class="row-between small">
            <span>
              <strong><?= Str::e($item['title']) ?></strong>
              <?php if ($item['origin'] && $item['destination']): ?>
                <span class="muted"><?= Str::e($item['origin']) ?> → <?= Str::e($item['destination']) ?></span>
              <?php endif; ?>
            </span>
            <span class="muted nowrap"><?= Str::e(Str::dateTime($item['depart_at'])) ?></span>
          </li>
        <?php endforeach; ?>
      </ul>
    </div>
  </div>
<?php endif; ?>

<div class="grid grid-sidebar">
  <div class="stack">
    <div class="tabs">
      <a href="/dashboard/documents" class="<?= $filter === '' ? 'is-active' : '' ?>">All</a>
      <?php foreach (['flight', 'hotel', 'attraction', 'insurance', 'visa', 'passport'] as $type): ?>
        <a href="/dashboard/documents?type=<?= $type ?>" class="<?= $filter === $type ? 'is-active' : '' ?>">
          <?= Str::e($types[$type]) ?>
        </a>
      <?php endforeach; ?>
    </div>

    <?php if ($documents === []): ?>
      <div class="card"><div class="card-body empty">
        <p class="empty-emoji">🎫</p>
        <p class="bold">The vault is empty</p>
        <p>Add your next booking — flight, hotel, anything. Both of you will have it when it matters.</p>
      </div></div>
    <?php else: ?>
      <div class="stack">
        <?php foreach ($documents as $doc): ?>
          <div class="card">
            <div class="card-body">
              <div class="row-between">
                <div style="flex:1;min-width:0">
                  <p class="bold">
                    <?= Str::e($types[$doc['doc_type']] ?? '📄') ?>
                    <?= Str::e($doc['title']) ?>
                    <?php if (!Str::bool($doc['is_shared'])): ?><span class="badge">🔒 private</span><?php endif; ?>
                  </p>

                  <p class="small muted mt-1">
                    <?php if ($doc['provider']): ?><?= Str::e($doc['provider']) ?><?php endif; ?>
                    <?php if ($doc['confirmation_code']): ?>
                      · Ref <span class="mono"><?= Str::e($doc['confirmation_code']) ?></span>
                    <?php endif; ?>
                    <?php if ($doc['passenger_names']): ?> · <?= Str::e($doc['passenger_names']) ?><?php endif; ?>
                  </p>

                  <?php if ($doc['origin'] || $doc['destination'] || $doc['depart_at']): ?>
                    <p class="small mt-1">
                      <?php if ($doc['origin']): ?><strong><?= Str::e($doc['origin']) ?></strong><?php endif; ?>
                      <?php if ($doc['destination']): ?> → <strong><?= Str::e($doc['destination']) ?></strong><?php endif; ?>
                      <?php if ($doc['depart_at']): ?>
                        <span class="muted">· <?= Str::e(Str::dateTime($doc['depart_at'])) ?></span>
                      <?php endif; ?>
                      <?php if ($doc['seat']): ?> <span class="badge">Seat <?= Str::e($doc['seat']) ?></span><?php endif; ?>
                      <?php if ($doc['gate']): ?> <span class="badge">Gate <?= Str::e($doc['gate']) ?></span><?php endif; ?>
                      <?php if ($doc['terminal']): ?> <span class="badge">T<?= Str::e($doc['terminal']) ?></span><?php endif; ?>
                    </p>
                  <?php endif; ?>

                  <?php if ($doc['check_in'] || $doc['check_out']): ?>
                    <p class="small muted mt-1">
                      Check-in <?= Str::e(Str::date($doc['check_in'])) ?>
                      · check-out <?= Str::e(Str::date($doc['check_out'])) ?>
                    </p>
                  <?php endif; ?>

                  <?php if ($doc['notes']): ?>
                    <p class="small muted mt-1"><?= Str::e($doc['notes']) ?></p>
                  <?php endif; ?>
                </div>

                <div class="right nowrap">
                  <?php if ($doc['amount_cents'] !== null): ?>
                    <p class="bold tabular"><?= Str::e(Currency::pretty((int) $doc['amount_cents'], $doc['currency'])) ?></p>
                  <?php endif; ?>

                  <div class="row-end mt-2">
                    <?php if ($doc['file_path']): ?>
                      <a class="btn btn-sm btn-outline" target="_blank" rel="noopener"
                         href="<?= Str::e(Storage::url('documents', $doc['file_path'])) ?>">Open</a>
                      <a class="btn btn-sm btn-ghost"
                         href="<?= Str::e(Storage::url('documents', $doc['file_path'])) ?>&amp;download=1">Save</a>
                    <?php endif; ?>

                    <form method="post" data-confirm="Remove this from the vault?">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="delete">
                      <input type="hidden" name="id" value="<?= Str::e($doc['id']) ?>">
                      <button class="btn btn-sm btn-ghost" type="submit" aria-label="Delete">✕</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>

  <aside>
    <form method="post" enctype="multipart/form-data" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="save">

      <div class="card-head"><h2>Add a booking</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="doc_type">Type</label>
          <select class="select" id="doc_type" name="doc_type"><?= View::options($types, 'flight') ?></select>
        </div>

        <div class="field">
          <label for="title">Title <span class="required">*</span></label>
          <input class="input" id="title" name="title" required maxlength="190" placeholder="BA 2551 to Malaga">
        </div>

        <div class="field">
          <label for="file">The ticket or confirmation</label>
          <input class="input" type="file" id="file" name="file" accept=".pdf,image/*,.doc,.docx"
                 style="height:auto;padding:0.6rem">
          <span class="hint">PDF or a photo. Up to 25 MB.</span>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="provider">Airline / hotel</label>
            <input class="input" id="provider" name="provider" maxlength="120">
          </div>
          <div class="field">
            <label for="confirmation_code">Booking reference</label>
            <input class="input" id="confirmation_code" name="confirmation_code" maxlength="120">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="origin">From</label>
            <input class="input" id="origin" name="origin" maxlength="120">
          </div>
          <div class="field">
            <label for="destination">To</label>
            <input class="input" id="destination" name="destination" maxlength="120">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="depart_at">Departs</label>
            <input class="input" type="datetime-local" id="depart_at" name="depart_at">
          </div>
          <div class="field">
            <label for="arrive_at">Arrives</label>
            <input class="input" type="datetime-local" id="arrive_at" name="arrive_at">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="check_in">Check-in</label>
            <input class="input" type="date" id="check_in" name="check_in">
          </div>
          <div class="field">
            <label for="check_out">Check-out</label>
            <input class="input" type="date" id="check_out" name="check_out">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="seat">Seat</label>
            <input class="input" id="seat" name="seat" maxlength="60">
          </div>
          <div class="field">
            <label for="amount">Cost</label>
            <input class="input" type="number" step="0.01" min="0" id="amount" name="amount">
          </div>
        </div>

        <?php if ($trips !== []): ?>
          <div class="field">
            <label for="trip_id">Trip</label>
            <select class="select" id="trip_id" name="trip_id">
              <option value="">Not linked</option>
              <?php foreach ($trips as $trip): ?>
                <option value="<?= Str::e($trip['id']) ?>"><?= Str::e($trip['title']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        <?php endif; ?>

        <div class="field">
          <label for="notes">Notes</label>
          <textarea class="textarea" rows="2" id="notes" name="notes"></textarea>
        </div>

        <label class="checkbox mt-2">
          <input type="checkbox" name="private_doc" value="1">
          <span class="small muted">Private — only you can see this one (passports, personal insurance).</span>
        </label>

        <button class="btn btn-block mt-3" type="submit">Save to the vault</button>
      </div>
    </form>
  </aside>
</div>

<?php View::end(); ?>
