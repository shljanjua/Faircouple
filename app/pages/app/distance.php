<?php
declare(strict_types=1);

/**
 * Long-distance mode — both partners' local time, how far apart the clocks
 * are, and a countdown to the next time you're together. Plus a one-tap
 * "thinking of you" across the miles.
 */

$user      = Auth::require();
$context   = Auth::requireCouple();
$coupleId  = $context['couple']['id'];
$partner   = $context['partner'];
$partnerId = $partner['user_id'] ?? null;

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'settings') {
        Db::run(
            'INSERT INTO long_distance (id, couple_id, is_enabled, next_visit_on, next_visit_location, next_visit_note)
             VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               is_enabled = VALUES(is_enabled),
               next_visit_on = VALUES(next_visit_on),
               next_visit_location = VALUES(next_visit_location),
               next_visit_note = VALUES(next_visit_note)',
            [
                Str::uuid(), $coupleId,
                Request::bool('is_enabled') ? 1 : 0,
                Request::date('next_visit_on'),
                Request::nullable('next_visit_location'),
                Request::nullable('next_visit_note'),
            ]
        );

        if ($partnerId && Request::date('next_visit_on')) {
            Audit::notify($partnerId, 'Countdown updated 🌎',
                'Your next visit is set for ' . Str::date(Request::date('next_visit_on')) . '.',
                '/dashboard/distance', 'love', '✈️', $coupleId);
        }

        Flash::success('Saved. 🌎');
        Response::redirect('/dashboard/distance');
    }

    if ($action === 'timezone') {
        $tz = LongDistance::safeZone(Request::input('timezone'));
        Db::update('profiles', $user['id'], ['timezone' => $tz]);
        Flash::success('Your timezone is set.');
        Response::redirect('/dashboard/distance');
    }

    if ($action === 'ping') {
        if (!$partnerId) {
            Flash::error('Invite your partner first.');
            Response::redirect('/dashboard/distance');
        }
        Db::insert('love_notes', [
            'couple_id'    => $coupleId,
            'sender_id'    => $user['id'],
            'recipient_id' => $partnerId,
            'note_type'    => 'thinking',
            'message'      => Request::nullable('message'),
        ]);
        Audit::notify($partnerId, 'Thinking about you 💭', Request::nullable('message'),
            '/dashboard/love', 'love', '💭', $coupleId);
        Flash::success('Sent across the miles. 💭');
        Response::redirect('/dashboard/distance');
    }
}

$settings = Db::one('SELECT * FROM long_distance WHERE couple_id = ? LIMIT 1', [$coupleId]);

// Each partner's timezone, straight from their profile.
$zones = [];
foreach (Db::all('SELECT id, timezone, display_name, full_name FROM profiles WHERE id IN (?, ?)',
    [$user['id'], $partnerId ?: $user['id']]) as $row) {
    $zones[$row['id']] = $row;
}
$myZone      = $zones[$user['id']]['timezone'] ?? 'UTC';
$partnerZone = $partnerId ? ($zones[$partnerId]['timezone'] ?? 'UTC') : null;

$myClock      = LongDistance::clock($myZone);
$partnerClock = $partnerId ? LongDistance::clock($partnerZone) : null;
$hoursApart   = $partnerId ? LongDistance::hoursApart($myZone, $partnerZone) : 0;

$daysUntil = LongDistance::daysUntil($settings['next_visit_on'] ?? null);

$meName = $context['me']['display_name'] ?: 'You';
$partnerName = $partner['display_name'] ?? ($partner['full_name'] ?? 'Your partner');

View::begin('layouts/app', ['title' => 'Long-distance', 'no_index' => true]);
?>

<div class="page-head">
  <h1>🌎 Miles apart. Still close.</h1>
  <p>Your two clocks, and a countdown to the next time you're in the same place.</p>
</div>

<!-- Two clocks ------------------------------------------------------------- -->
<div class="grid grid-2 gap-lg">
  <div class="card ld-clock-card">
    <p class="ld-clock-name"><?= Str::e($meName) ?> — you</p>
    <p class="ld-clock-time" data-clock data-tz="<?= Str::e($myClock['zone']) ?>"><?= Str::e($myClock['time']) ?></p>
    <p class="ld-clock-meta"><?= Str::e($myClock['date']) ?> · <?= Str::e($myClock['offset']) ?></p>
  </div>
  <div class="card ld-clock-card ld-clock-partner">
    <?php if ($partnerId): ?>
      <p class="ld-clock-name"><?= Str::e($partnerName) ?></p>
      <p class="ld-clock-time" data-clock data-tz="<?= Str::e($partnerClock['zone']) ?>"><?= Str::e($partnerClock['time']) ?></p>
      <p class="ld-clock-meta"><?= Str::e($partnerClock['date']) ?> · <?= Str::e($partnerClock['offset']) ?></p>
    <?php else: ?>
      <p class="ld-clock-name">Your partner</p>
      <p class="small muted mt-2">Invite them from <a href="/dashboard/partner">Partner &amp; space</a>
        and their local time will appear here.</p>
    <?php endif; ?>
  </div>
</div>

<?php if ($partnerId && $hoursApart > 0): ?>
  <p class="text-center muted small mt-2">You're <strong><?= $hoursApart ?> hour<?= $hoursApart === 1 ? '' : 's' ?></strong> apart right now.</p>
<?php elseif ($partnerId): ?>
  <p class="text-center muted small mt-2">You're in the same timezone right now. 💛</p>
<?php endif; ?>

<!-- Countdown -------------------------------------------------------------- -->
<div class="card ld-countdown mt-3">
  <div class="card-body text-center">
    <?php if ($daysUntil !== null && $daysUntil > 0): ?>
      <p class="ld-count-num"><?= $daysUntil ?></p>
      <p class="ld-count-label">day<?= $daysUntil === 1 ? '' : 's' ?> until you're together
        <?php if ($settings['next_visit_location']): ?>in <?= Str::e($settings['next_visit_location']) ?><?php endif; ?></p>
      <?php if ($settings['next_visit_note']): ?>
        <p class="small muted mt-1">“<?= Str::e($settings['next_visit_note']) ?>”</p>
      <?php endif; ?>
    <?php elseif ($daysUntil === 0): ?>
      <p class="ld-count-num">Today ❤️</p>
      <p class="ld-count-label">You're together today
        <?php if ($settings['next_visit_location']): ?>in <?= Str::e($settings['next_visit_location']) ?><?php endif; ?>!</p>
    <?php else: ?>
      <p class="ld-count-num">✈️</p>
      <p class="ld-count-label">Set the date of your next visit to start the countdown.</p>
    <?php endif; ?>
  </div>
</div>

<div class="grid grid-2 gap-lg mt-3">
  <!-- Next visit ---------------------------------------------------------- -->
  <form method="post" class="card love-card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="settings">
    <div class="card-head"><h2>Next time together</h2></div>
    <div class="card-body">
      <div class="field-row">
        <div class="field">
          <label for="next_visit_on">The date</label>
          <input class="input" type="date" id="next_visit_on" name="next_visit_on"
                 value="<?= Str::e(substr((string) ($settings['next_visit_on'] ?? ''), 0, 10)) ?>">
        </div>
        <div class="field">
          <label for="next_visit_location">Where</label>
          <input class="input" id="next_visit_location" name="next_visit_location" maxlength="160"
                 value="<?= Str::e($settings['next_visit_location'] ?? '') ?>" placeholder="Your place / a city">
        </div>
      </div>
      <div class="field">
        <label for="next_visit_note">A note to look forward to</label>
        <input class="input" id="next_visit_note" name="next_visit_note" maxlength="280"
               value="<?= Str::e($settings['next_visit_note'] ?? '') ?>" placeholder="Two whole weeks, just us.">
      </div>
      <label class="checkbox mt-2">
        <input type="checkbox" name="is_enabled" value="1" <?= !$settings || Str::bool($settings['is_enabled']) ? 'checked' : '' ?>>
        <span>We're long-distance right now</span>
      </label>
      <button class="btn btn-block mt-3" type="submit">Save countdown</button>
    </div>
  </form>

  <!-- My timezone + ping -------------------------------------------------- -->
  <div class="card love-card">
    <div class="card-head"><h2>Your timezone</h2></div>
    <div class="card-body">
      <form method="post">
        <?= Csrf::field() ?>
        <input type="hidden" name="action" value="timezone">
        <div class="field">
          <label for="timezone">Where in the world are you?</label>
          <select class="select" id="timezone" name="timezone">
            <?php foreach (LongDistance::TIMEZONES as $label => $tzId): ?>
              <option value="<?= Str::e($tzId) ?>" <?= $myZone === $tzId ? 'selected' : '' ?>>
                <?= Str::e($label) ?>
              </option>
            <?php endforeach; ?>
          </select>
          <span class="hint">This sets the clock your partner sees for you.</span>
        </div>
        <button class="btn btn-outline" type="submit">Save timezone</button>
      </form>

      <hr class="divider">

      <form method="post">
        <?= Csrf::field() ?>
        <input type="hidden" name="action" value="ping">
        <p class="side-heading">Reach across the miles</p>
        <div class="field mt-2">
          <input class="input" name="message" maxlength="280" placeholder="Just thinking about you… (optional)">
        </div>
        <button class="btn btn-block" type="submit" <?= $partnerId ? '' : 'disabled' ?>>💭 Thinking of you</button>
      </form>
    </div>
  </div>
</div>

<div class="card mt-3">
  <div class="card-body row-between">
    <p class="small">Feeling the distance? Try the <strong>7-Day Long-Distance Closeness</strong> challenge.</p>
    <a class="btn btn-sm btn-outline" href="/dashboard/challenges">See challenges</a>
  </div>
</div>

<script>
  // Tick each clock every second in its own timezone, purely client-side.
  (function () {
    var els = document.querySelectorAll('[data-clock]');
    if (!els.length || typeof Intl === 'undefined') return;
    function tick() {
      els.forEach(function (el) {
        try {
          el.textContent = new Intl.DateTimeFormat('en-US', {
            timeZone: el.getAttribute('data-tz'),
            hour: 'numeric', minute: '2-digit', hour12: true
          }).format(new Date());
        } catch (e) { /* leave server-rendered time */ }
      });
    }
    tick();
    setInterval(tick, 1000);
  })();
</script>

<?php View::end(); ?>
