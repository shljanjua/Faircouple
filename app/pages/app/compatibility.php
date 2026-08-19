<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$partner  = $context['partner'];

$dimensions = Assessment::dimensions();

if (Request::isPost()) {
    $answers = [];
    foreach ($dimensions as $dimension) {
        $value = Request::int('d_' . $dimension['key'], 0);
        if ($value >= 1 && $value <= 10) {
            $answers[$dimension['key']] = $value;
        }
    }

    if ($answers === []) {
        Flash::error('Move at least one slider first.');
        Response::redirect('/dashboard/compatibility');
    }

    Db::insert('assessments', [
        'couple_id' => $coupleId,
        'user_id'   => $user['id'],
        'kind'      => 'compatibility',
        'answers'   => json_encode($answers),
    ]);

    // Recompute the shared score against the partner's latest answers.
    $partnerAnswers = null;
    if ($partner) {
        $row = Db::one(
            'SELECT answers FROM assessments
              WHERE couple_id = ? AND user_id = ? AND kind = "compatibility"
              ORDER BY taken_at DESC LIMIT 1',
            [$coupleId, $partner['user_id']]
        );
        $partnerAnswers = $row ? Str::json($row['answers']) : null;
    }

    $scored = Assessment::compatibility($answers, $partnerAnswers);
    $byKey = [];
    foreach ($scored['dimensions'] as $dimension) {
        $byKey[$dimension['key']] = $dimension['score'];
    }

    Db::run(
        'INSERT INTO compatibility_scores
           (id, couple_id, period, overall, emotional, communication, trust, financial,
            intimacy, lifestyle, future_goals, conflict, verdict, details)
         VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           overall = VALUES(overall), emotional = VALUES(emotional), communication = VALUES(communication),
           trust = VALUES(trust), financial = VALUES(financial), intimacy = VALUES(intimacy),
           lifestyle = VALUES(lifestyle), future_goals = VALUES(future_goals), conflict = VALUES(conflict),
           verdict = VALUES(verdict), details = VALUES(details)',
        [
            Str::uuid(), $coupleId, $scored['overall'],
            $byKey['emotional'] ?? null, $byKey['communication'] ?? null, $byKey['trust'] ?? null,
            $byKey['financial'] ?? null, $byKey['intimacy'] ?? null, $byKey['lifestyle'] ?? null,
            $byKey['future_goals'] ?? null, $byKey['conflict'] ?? null,
            $scored['biggest_gap']
                ? 'Biggest perception gap: ' . $scored['biggest_gap']['label'] . '.'
                : 'Waiting for your partner to answer.',
            json_encode($scored['dimensions']),
        ]
    );

    Flash::success('Saved. The radar updates as soon as your partner answers too.');
    Response::redirect('/dashboard/compatibility');
}

/* ------------------------------------------------------------------ Reading */

$myRow = Db::one(
    'SELECT answers FROM assessments WHERE couple_id = ? AND user_id = ? AND kind = "compatibility"
      ORDER BY taken_at DESC LIMIT 1',
    [$coupleId, $user['id']]
);
$myAnswers = $myRow ? Str::json($myRow['answers']) : [];

$partnerAnswers = null;
if ($partner) {
    $row = Db::one(
        'SELECT answers FROM assessments WHERE couple_id = ? AND user_id = ? AND kind = "compatibility"
          ORDER BY taken_at DESC LIMIT 1',
        [$coupleId, $partner['user_id']]
    );
    $partnerAnswers = $row ? Str::json($row['answers']) : null;
}

$scored = Assessment::compatibility($myAnswers, $partnerAnswers);

$loveResult = Db::one(
    'SELECT * FROM assessments WHERE user_id = ? AND kind = "love_vs_attraction"
      ORDER BY taken_at DESC LIMIT 1',
    [$user['id']]
);

$partnerLove = $partner
    ? Db::one(
        'SELECT * FROM assessments WHERE user_id = ? AND kind = "love_vs_attraction"
          ORDER BY taken_at DESC LIMIT 1',
        [$partner['user_id']]
    )
    : null;

View::begin('layouts/app', ['title' => 'Compatibility', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Compatibility</h1>
  <p>Eight dimensions, answered separately. The gap between your two answers is the useful number.</p>
</div>

<div class="grid grid-sidebar">
  <div class="stack">
    <div class="card">
      <div class="card-head">
        <h2>Your radar</h2>
        <span class="badge badge-primary">Overall <?= (int) $scored['overall'] ?>/100</span>
      </div>
      <div class="card-body">
        <?php if ($myAnswers === []): ?>
          <div class="empty">
            <p class="empty-emoji">🎯</p>
            <p class="bold">Answer the eight questions below</p>
            <p>It takes about a minute, and it is worth doing every couple of months.</p>
          </div>
        <?php else: ?>
          <ul class="radar-list">
            <?php foreach ($scored['dimensions'] as $dimension): ?>
              <li>
                <span class="small">
                  <?= Str::e($dimension['emoji']) ?> <?= Str::e($dimension['label']) ?>
                </span>
                <?= View::meter(
                    (float) $dimension['score'],
                    100,
                    $dimension['score'] >= 70 ? 'success' : ($dimension['score'] >= 45 ? 'warning' : 'danger')
                ) ?>
                <span class="tabular right small bold"><?= (int) $dimension['score'] ?></span>
              </li>
            <?php endforeach; ?>
          </ul>

          <?php if ($partnerAnswers === null): ?>
            <div class="alert alert-info mt-3">
              <div>
                This is your side only. Once
                <?= Str::e($partner['display_name'] ?? $partner['full_name'] ?? 'your partner') ?>
                answers, every bar becomes the average of you both — and the gaps appear.
              </div>
            </div>
          <?php elseif ($scored['biggest_gap']): ?>
            <div class="alert alert-warning mt-3">
              <div>
                <strong>Biggest perception gap: <?= Str::e($scored['biggest_gap']['label']) ?></strong>
                You rated it <?= (int) $scored['biggest_gap']['mine'] ?>/10, they rated it
                <?= (int) $scored['biggest_gap']['theirs'] ?>/10. Start the conversation there.
              </div>
            </div>
          <?php endif; ?>
        <?php endif; ?>
      </div>
    </div>

    <form method="post" class="card">
      <?= Csrf::field() ?>
      <div class="card-head">
        <h2><?= $myAnswers === [] ? 'Answer the eight questions' : 'Update your answers' ?></h2>
        <span class="small muted">1 = not at all · 10 = completely</span>
      </div>
      <div class="card-body">
        <?php foreach ($dimensions as $dimension): ?>
          <?php $current = (int) ($myAnswers[$dimension['key']] ?? 5); ?>
          <div class="field">
            <label for="d_<?= Str::e($dimension['key']) ?>">
              <?= Str::e($dimension['emoji']) ?> <?= Str::e($dimension['question']) ?>
              <output id="out-<?= Str::e($dimension['key']) ?>" class="tabular bold"><?= $current ?></output>
            </label>
            <input type="range" min="1" max="10" id="d_<?= Str::e($dimension['key']) ?>"
                   name="d_<?= Str::e($dimension['key']) ?>" value="<?= $current ?>"
                   data-output="out-<?= Str::e($dimension['key']) ?>">
          </div>
        <?php endforeach; ?>

        <button class="btn mt-2" type="submit">Save my answers</button>
      </div>
    </form>
  </div>

  <aside class="stack">
    <div class="card">
      <div class="card-head"><h2>Love vs Attraction</h2></div>
      <div class="card-body">
        <?php if (!$loveResult): ?>
          <p class="small muted">You have not taken it yet. Twenty questions, two minutes.</p>
          <a class="btn btn-sm btn-block mt-2" href="/love-or-attraction">Take the test</a>
        <?php else: ?>
          <p class="bold"><?= Str::e($loveResult['verdict']) ?></p>
          <div class="mt-2">
            <div class="row-between small"><span>💗 Love</span><span class="tabular"><?= (int) $loveResult['love_score'] ?></span></div>
            <?= View::meter((float) $loveResult['love_score'], 100, 'success') ?>
          </div>
          <div class="mt-2">
            <div class="row-between small"><span>🔥 Attraction</span><span class="tabular"><?= (int) $loveResult['attraction_score'] ?></span></div>
            <?= View::meter((float) $loveResult['attraction_score'], 100, 'warning') ?>
          </div>
          <p class="tiny muted mt-2">Taken <?= Str::e(Str::timeAgo($loveResult['taken_at'])) ?></p>
          <a class="btn btn-sm btn-outline btn-block mt-2" href="/love-or-attraction">Take it again</a>
        <?php endif; ?>

        <?php if ($partnerLove): ?>
          <hr class="divider">
          <p class="small bold"><?= Str::e($partner['display_name'] ?? 'Your partner') ?></p>
          <p class="small mt-1"><?= Str::e($partnerLove['verdict']) ?></p>
          <p class="tiny muted mt-1">
            Love <?= (int) $partnerLove['love_score'] ?> · Attraction <?= (int) $partnerLove['attraction_score'] ?>
          </p>
          <?php
          $loveGap = abs((int) $loveResult['love_score'] - (int) $partnerLove['love_score']);
          ?>
          <?php if ($loveResult && $loveGap >= 20): ?>
            <div class="alert alert-warning mt-2">
              <div>Your love scores differ by <?= $loveGap ?> points. That is a big gap — worth a proper conversation.</div>
            </div>
          <?php endif; ?>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <h2 style="font-size:1rem">How to use this</h2>
        <p class="small muted mt-2">
          Answer without discussing it first. Compare afterwards. The dimension where you disagree most
          is almost always the one neither of you has raised out loud.
        </p>
      </div>
    </div>
  </aside>
</div>

<?php View::end(); ?>
