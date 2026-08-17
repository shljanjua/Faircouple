<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$partner  = $context['partner'];

$period = Request::input('period') !== '' ? Str::weekStart(Request::input('period')) : Str::weekStart();

$categories = Db::all('SELECT * FROM fairness_categories WHERE is_active = 1 ORDER BY sort_order ASC');

/* ------------------------------------------------------------------- Saving */

if (Request::isPost()) {
    $saved = 0;

    foreach ($categories as $category) {
        $selfScore    = Request::input('self_' . $category['id']);
        $partnerScore = Request::input('partner_' . $category['id']);

        if ($selfScore === '' && $partnerScore === '') {
            continue;
        }

        $self    = $selfScore === '' ? null : max(0, min(10, (int) $selfScore));
        $theirs  = $partnerScore === '' ? null : max(0, min(10, (int) $partnerScore));

        Db::run(
            'INSERT INTO fairness_entries
               (id, couple_id, user_id, about_user_id, category_id, period, self_score, partner_score,
                effort_self, effort_partner, respect_score, loyalty_score, satisfaction, note, is_private)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               about_user_id  = VALUES(about_user_id),
               self_score     = VALUES(self_score),
               partner_score  = VALUES(partner_score),
               effort_self    = VALUES(effort_self),
               effort_partner = VALUES(effort_partner),
               respect_score  = VALUES(respect_score),
               loyalty_score  = VALUES(loyalty_score),
               satisfaction   = VALUES(satisfaction),
               note           = VALUES(note),
               is_private     = VALUES(is_private)',
            [
                Str::uuid(),
                $coupleId,
                $user['id'],
                $partner['user_id'] ?? null,
                $category['id'],
                $period,
                $self,
                $theirs,
                $self === null ? null : $self * 10,
                $theirs === null ? null : $theirs * 10,
                Request::input('respect_' . $category['id']) === '' ? null : (int) Request::input('respect_' . $category['id']),
                Request::input('loyalty_' . $category['id']) === '' ? null : (int) Request::input('loyalty_' . $category['id']),
                Request::input('satisfaction_' . $category['id']) === '' ? null : (int) Request::input('satisfaction_' . $category['id']),
                Request::nullable('note_' . $category['id']),
                Request::bool('private_' . $category['id']),
            ]
        );

        $saved++;
    }

    if ($saved === 0) {
        Flash::error('Nothing to save yet — move at least one slider.');
    } else {
        Flash::success('Saved. Your side of this week is recorded.');

        if ($partner) {
            Audit::notify(
                $partner['user_id'],
                ($user['display_name'] ?: $user['full_name'] ?: 'Your partner') . ' updated this week',
                'Open the fairness report to add your own side.',
                '/dashboard/fairness',
                'fairness',
                '⚖️',
                $coupleId
            );
        }
    }

    Response::redirect('/dashboard/fairness?period=' . urlencode($period));
}

/* ------------------------------------------------------------------ Reading */

$entries = Db::all('SELECT * FROM fairness_entries WHERE couple_id = ? AND period = ?', [$coupleId, $period]);

$mine = [];
foreach ($entries as $entry) {
    if ($entry['user_id'] === $user['id']) {
        $mine[$entry['category_id']] = $entry;
    }
}

$report = Fairness::report(
    $period,
    $categories,
    $entries,
    ['user_id' => $user['id'], 'name' => $user['display_name'] ?: ($user['full_name'] ?: 'You')],
    $partner ? ['user_id' => $partner['user_id'], 'name' => $partner['display_name'] ?: ($partner['full_name'] ?: 'Partner')] : null
);

if ($report['completeness'] > 0) {
    Fairness::snapshot($coupleId, $report);
}

$historyMonths = Auth::entitlements()['limits']['history_months'] ?? 1;
$weeksBack = ((int) $historyMonths === -1) ? 26 : max(4, (int) $historyMonths * 4);

$trendEntries = Db::all(
    'SELECT user_id, period, self_score, effort_self FROM fairness_entries
      WHERE couple_id = ? AND period >= DATE_SUB(?, INTERVAL ? WEEK)
      ORDER BY period ASC',
    [$coupleId, $period, $weeksBack]
);

$trend = Fairness::trend($trendEntries, $user['id'], $partner['user_id'] ?? null);
$risk = Fairness::RISK_META[$report['risk_level']];

View::begin('layouts/app', ['title' => 'Fairness report', 'no_index' => true]);
?>

<div class="page-head">
  <div class="row-between">
    <div>
      <h1>Fairness report</h1>
      <p>Week of <?= Str::e(Str::date($period)) ?>. You each answer for yourself — the report compares the two.</p>
    </div>

    <form method="get" class="row">
      <label class="sr-only" for="period">Week</label>
      <input class="input" type="date" id="period" name="period" value="<?= Str::e($period) ?>" style="width:auto">
      <button class="btn btn-sm btn-outline" type="submit">Go</button>
    </form>
  </div>
</div>

<div class="grid grid-4">
  <div class="card stat">
    <p class="stat-label">Balance index</p>
    <p class="stat-value tabular"><?= number_format($report['balance_index'], 0) ?></p>
    <?= View::meter($report['balance_index'], 100, $report['balance_index'] >= 80 ? 'success' : ($report['balance_index'] >= 60 ? 'warning' : 'danger')) ?>
  </div>
  <div class="card stat">
    <p class="stat-label">Overall</p>
    <p class="stat-value tabular"><?= number_format($report['overall_score'], 0) ?></p>
    <p class="stat-hint">weighted across all ten areas</p>
  </div>
  <div class="card stat">
    <p class="stat-label">Risk level</p>
    <p class="stat-value tone-<?= Str::e($risk['tone']) ?>" style="font-size:1.5rem"><?= Str::e($risk['label']) ?></p>
    <p class="stat-hint"><?= (int) $report['completeness'] ?>% complete</p>
  </div>
  <div class="card stat">
    <p class="stat-label">Respect / loyalty gap</p>
    <p class="stat-value tabular" style="font-size:1.5rem">
      <?= number_format($report['respect_delta'], 1) ?> / <?= number_format($report['loyalty_delta'], 1) ?>
    </p>
    <p class="stat-hint">lower is better</p>
  </div>
</div>

<div class="card mt-3">
  <div class="card-body">
    <h2 style="font-size:1.05rem">Verdict</h2>
    <p class="mt-2"><?= Str::e($report['verdict']) ?></p>
  </div>
</div>

<?php if ($report['insights'] !== []): ?>
  <div class="stack-sm mt-3">
    <?php foreach ($report['insights'] as $insight): ?>
      <?php
      $tone = match ($insight['tone']) {
          'positive' => 'success',
          'warning'  => 'warning',
          'critical' => 'danger',
          default    => 'info',
      };
      ?>
      <div class="alert alert-<?= $tone ?>">
        <div><strong><?= Str::e($insight['title']) ?></strong><?= Str::e($insight['detail']) ?></div>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<?php if (count($trend) > 1): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>Effort over time</h2></div>
    <div class="card-body">
      <div class="chart">
        <?php foreach ($trend as $point): ?>
          <div class="chart-col" title="<?= Str::e($point['label']) ?>: you <?= $point['effort_a'] ?>, partner <?= $point['effort_b'] ?>">
            <span class="chart-bar" style="height:<?= max(2, (int) round($point['effort_a'] * 0.9)) ?>%"></span>
            <span class="chart-bar is-b" style="height:<?= max(2, (int) round($point['effort_b'] * 0.9)) ?>%"></span>
          </div>
        <?php endforeach; ?>
      </div>
      <div class="row" style="gap:0.4rem;flex-wrap:nowrap;overflow-x:auto">
        <?php foreach ($trend as $point): ?>
          <span class="chart-label" style="flex:1"><?= Str::e($point['label']) ?></span>
        <?php endforeach; ?>
      </div>
      <p class="tiny muted mt-2">
        Solid bar = your effort. Faded bar = your partner&rsquo;s.
        <?php if ((int) $historyMonths !== -1): ?>
          Showing <?= (int) $historyMonths ?> month<?= (int) $historyMonths === 1 ? '' : 's' ?> —
          <a href="/pricing">upgrade for the full history</a>.
        <?php endif; ?>
      </p>
    </div>
  </div>
<?php endif; ?>

<form method="post" class="mt-3">
  <?= Csrf::field() ?>
  <input type="hidden" name="period" value="<?= Str::e($period) ?>">

  <div class="card">
    <div class="card-head">
      <h2>Your entries for this week</h2>
      <span class="small muted">0 = not at all · 10 = completely</span>
    </div>
    <div class="card-body stack-lg">
      <?php foreach ($categories as $category): ?>
        <?php
        $entry = $mine[$category['id']] ?? null;
        $breakdown = null;
        foreach ($report['categories'] as $row) {
            if ($row['category_id'] === $category['id']) { $breakdown = $row; break; }
        }
        ?>
        <fieldset id="<?= Str::e($category['slug']) ?>">
          <legend>
            <span style="font-size:1.2rem"><?= Str::e($category['emoji']) ?></span>
            <?= Str::e($category['name']) ?>
            <?php if (Str::bool($category['is_dealbreaker'])): ?>
              <span class="badge badge-danger">Non-negotiable</span>
            <?php endif; ?>
          </legend>
          <p class="tiny muted" style="margin-top:-0.25rem"><?= Str::e($category['fair_rule']) ?></p>

          <div class="field-row mt-2">
            <div class="field">
              <label for="self_<?= Str::e($category['id']) ?>">
                How much did <strong>you</strong> put in?
                <output id="out-self-<?= Str::e($category['id']) ?>" class="tabular bold"><?= $entry['self_score'] ?? 5 ?></output>
              </label>
              <input type="range" min="0" max="10" step="1"
                     id="self_<?= Str::e($category['id']) ?>" name="self_<?= Str::e($category['id']) ?>"
                     value="<?= (int) ($entry['self_score'] ?? 5) ?>"
                     data-output="out-self-<?= Str::e($category['id']) ?>">
            </div>

            <div class="field">
              <label for="partner_<?= Str::e($category['id']) ?>">
                How much did <strong>they</strong> put in?
                <output id="out-partner-<?= Str::e($category['id']) ?>" class="tabular bold"><?= $entry['partner_score'] ?? 5 ?></output>
              </label>
              <input type="range" min="0" max="10" step="1"
                     id="partner_<?= Str::e($category['id']) ?>" name="partner_<?= Str::e($category['id']) ?>"
                     value="<?= (int) ($entry['partner_score'] ?? 5) ?>"
                     data-output="out-partner-<?= Str::e($category['id']) ?>">
            </div>
          </div>

          <?php if (in_array($category['slug'], ['respect-boundaries', 'trust-loyalty'], true)): ?>
            <div class="field-row">
              <div class="field">
                <label for="respect_<?= Str::e($category['id']) ?>">
                  Respect you felt
                  <output id="out-respect-<?= Str::e($category['id']) ?>" class="tabular bold"><?= $entry['respect_score'] ?? 5 ?></output>
                </label>
                <input type="range" min="0" max="10" id="respect_<?= Str::e($category['id']) ?>"
                       name="respect_<?= Str::e($category['id']) ?>" value="<?= (int) ($entry['respect_score'] ?? 5) ?>"
                       data-output="out-respect-<?= Str::e($category['id']) ?>">
              </div>
              <div class="field">
                <label for="loyalty_<?= Str::e($category['id']) ?>">
                  Loyalty you felt
                  <output id="out-loyalty-<?= Str::e($category['id']) ?>" class="tabular bold"><?= $entry['loyalty_score'] ?? 5 ?></output>
                </label>
                <input type="range" min="0" max="10" id="loyalty_<?= Str::e($category['id']) ?>"
                       name="loyalty_<?= Str::e($category['id']) ?>" value="<?= (int) ($entry['loyalty_score'] ?? 5) ?>"
                       data-output="out-loyalty-<?= Str::e($category['id']) ?>">
              </div>
            </div>
          <?php endif; ?>

          <div class="field">
            <label for="note_<?= Str::e($category['id']) ?>">Your note (optional)</label>
            <textarea class="textarea" rows="2" id="note_<?= Str::e($category['id']) ?>"
                      name="note_<?= Str::e($category['id']) ?>"
                      placeholder="One specific thing that happened this week…"><?= Str::e($entry['note'] ?? '') ?></textarea>
          </div>

          <label class="checkbox">
            <input type="checkbox" name="private_<?= Str::e($category['id']) ?>" value="1"
                   <?= Str::bool($entry['is_private'] ?? false) ? 'checked' : '' ?>>
            <span class="small muted">Keep this note private — the score still counts, but only you see the words.</span>
          </label>

          <?php if ($breakdown && $breakdown['b']['effort'] !== null && $partner): ?>
            <div class="alert alert-info mt-2">
              <div>
                <strong><?= Str::e($partner['display_name'] ?: $partner['full_name'] ?: 'Your partner') ?> answered</strong>
                They rated their own effort <?= number_format($breakdown['b']['effort'] / 10, 0) ?>/10
                and yours <?= $breakdown['b']['partner'] === null ? '—' : (int) $breakdown['b']['partner'] . '/10' ?>.
                <?php if ($breakdown['note_b'] && !Str::bool($breakdown['note_b'])): ?>
                  <br>&ldquo;<?= Str::e($breakdown['note_b']) ?>&rdquo;
                <?php endif; ?>
              </div>
            </div>
          <?php endif; ?>
        </fieldset>
      <?php endforeach; ?>

      <button class="btn btn-lg" type="submit">Save my week</button>
    </div>
  </div>
</form>

<?php View::end(); ?>
