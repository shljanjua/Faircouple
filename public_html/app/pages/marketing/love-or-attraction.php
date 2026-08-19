<?php
declare(strict_types=1);

$questions = Assessment::questions();
$result = null;

if (Request::isPost()) {
    $answers = [];
    foreach ($questions as $question) {
        $value = (int) Request::input('q_' . $question['id'], '0');
        if ($value >= 1 && $value <= 5) {
            $answers[$question['id']] = $value;
        }
    }

    $result = Assessment::score($answers);

    // Signed-in members get their result stored so it shows on the dashboard.
    if (Auth::check() && $result['key'] !== 'early') {
        $user = Auth::user();
        Db::insert('assessments', [
            'couple_id'        => Auth::coupleId(),
            'user_id'          => $user['id'],
            'kind'             => 'love_vs_attraction',
            'answers'          => json_encode($answers),
            'love_score'       => $result['love'],
            'attraction_score' => $result['attraction'],
            'result_key'       => $result['key'],
            'verdict'          => $result['verdict'],
            'summary'          => $result['summary'],
            'details'          => json_encode(['guidance' => $result['guidance'], 'difference' => $result['difference']]),
        ]);
    }
}

Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'Love or attraction', 'url' => '/love-or-attraction']]);

View::begin('layouts/public', [
    'title'       => 'Love or Attraction Test — Free Assessment for Couples',
    'description' => 'Take the free Love vs Attraction assessment. Answer independently from your partner and see whether your relationship is built on consistency or on intensity.',
]);
?>

<section class="section-tight">
  <div class="container container-narrow">
    <p class="eyebrow">Free assessment</p>
    <h1>Is it love, or is it attraction?</h1>
    <p class="lead muted mt-2">
      Attraction is measured in peaks — intensity, novelty, chemistry.
      Love is measured in averages — consistency, effort, repair, direction.
      Twenty questions, two minutes, no account needed.
    </p>

    <?php if ($result !== null): ?>
      <?php
      $verdictTone = match ($result['key']) {
          'love', 'love_with_spark' => 'success',
          'infatuation'             => 'danger',
          'attraction_led'          => 'warning',
          default                   => 'info',
      };
      ?>

      <div class="card mt-4" id="result">
        <div class="card-body">
          <span class="badge badge-<?= $verdictTone === 'info' ? 'primary' : $verdictTone ?>">Your result</span>
          <h2 class="mt-2"><?= Str::e($result['verdict']) ?></h2>
          <p class="mt-2"><?= Str::e($result['summary']) ?></p>

          <div class="grid grid-2 mt-4">
            <div>
              <div class="row-between small bold">
                <span>💗 Love — consistency</span><span class="tabular"><?= (int) $result['love'] ?>/100</span>
              </div>
              <?= View::meter((float) $result['love'], 100, 'success') ?>
            </div>
            <div>
              <div class="row-between small bold">
                <span>🔥 Attraction — intensity</span><span class="tabular"><?= (int) $result['attraction'] ?>/100</span>
              </div>
              <?= View::meter((float) $result['attraction'], 100, 'warning') ?>
            </div>
          </div>

          <?php if ($result['guidance'] !== []): ?>
            <h3 class="mt-4" style="font-family:var(--font);font-size:1rem">What to do next</h3>
            <ul class="list-plain mt-2">
              <?php foreach ($result['guidance'] as $line): ?>
                <li class="row" style="align-items:flex-start;gap:0.6rem">
                  <span class="tone-primary">→</span><span class="small"><?= Str::e($line) ?></span>
                </li>
              <?php endforeach; ?>
            </ul>
          <?php endif; ?>

          <div class="alert alert-info mt-4">
            <div>
              <strong>The number that matters most is the gap between you two.</strong>
              Ask your partner to take this separately, without discussing it first, then compare.
            </div>
          </div>

          <div class="row mt-3">
            <a class="btn" href="/signup">Track this properly — free</a>
            <a class="btn btn-outline" href="/love-or-attraction">Take it again</a>
          </div>
        </div>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if ($result === null): ?>
<section class="section-tight">
  <div class="container container-narrow">
    <form method="post">
      <?= Csrf::field() ?>

      <div class="alert alert-info">
        <div>
          Answer honestly about how things <em>usually</em> are, not how they were at their best.
          There are no right answers, and nothing is stored unless you are signed in.
        </div>
      </div>

      <div class="stack mt-3">
        <?php foreach ($questions as $index => $question): ?>
          <fieldset class="card">
            <div class="card-body">
              <legend style="font-weight:600">
                <?= (int) ($index + 1) ?>. <?= Str::e($question['text']) ?>
              </legend>
              <?php if ($question['helper']): ?>
                <p class="tiny muted" style="margin-top:-0.25rem"><?= Str::e($question['helper']) ?></p>
              <?php endif; ?>

              <div class="row mt-2" style="gap:0.75rem">
                <?php foreach (Assessment::LIKERT as $value => $label): ?>
                  <label class="radio" style="flex:1 1 6rem">
                    <input type="radio" name="q_<?= Str::e($question['id']) ?>" value="<?= (int) $value ?>">
                    <span class="small"><?= Str::e($label) ?></span>
                  </label>
                <?php endforeach; ?>
              </div>
            </div>
          </fieldset>
        <?php endforeach; ?>
      </div>

      <div class="card card-accent mt-4">
        <div class="card-body center">
          <button class="btn btn-lg" type="submit">Show my result</button>
          <p class="tiny muted mt-2">Answer at least 12 questions for a meaningful score.</p>
        </div>
      </div>
    </form>
  </div>
</section>
<?php endif; ?>

<?php View::end(); ?>
