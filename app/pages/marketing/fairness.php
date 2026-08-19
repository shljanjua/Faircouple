<?php
declare(strict_types=1);

$categories = Db::all('SELECT * FROM fairness_categories WHERE is_active = 1 ORDER BY sort_order ASC');
$criteria   = Db::all('SELECT * FROM fairness_criteria WHERE is_active = 1 ORDER BY sort_order ASC');

$byCategory = [];
foreach ($criteria as $criterion) {
    $byCategory[$criterion['category_id']][] = $criterion;
}

Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'The fairness framework', 'url' => '/fairness']]);
Seo::howTo(
    'How to measure fairness in a relationship',
    'The ten-area framework FairCouples uses, and how two partners apply it each week.',
    [
        ['name' => 'Both partners create an account', 'text' => 'Each person needs their own login. Nobody answers on behalf of two.'],
        ['name' => 'Score yourself and your partner', 'text' => 'On each of the ten areas, rate your own effort and theirs, separately and privately.'],
        ['name' => 'Read the balance index', 'text' => 'The report compares both sides and returns a 0–100 balance index plus the perception gaps.'],
        ['name' => 'Agree one change each', 'text' => 'Pick the largest gap, apply the fair rule for that area, and re-measure next week.'],
    ]
);

View::begin('layouts/public', [
    'title'       => 'The Fairness Framework — 10 Areas Every Relationship Is Measured On',
    'description' => 'The complete fairness framework used by FairCouples: ten areas, thirty behaviours and the fair rule that keeps each one honest.',
]);
?>

<section class="hero" style="padding-block:clamp(2.5rem,2rem+3vw,4rem)">
  <div class="container">
    <p class="eyebrow">The framework</p>
    <h1>Ten areas. Thirty behaviours. One fair rule each.</h1>
    <p class="lead">
      This is the whole thing, in the open. Every relationship type falls under it — partners, spouses,
      a mother and son, siblings, close friends. What changes is the label on each person, never the standard.
    </p>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <div class="grid grid-2">
      <div class="card">
        <div class="card-body">
          <h2 style="font-size:1.2rem">⚖️ The fairness formula</h2>
          <p class="center mt-3" style="font-family:var(--font-display);font-size:1.1rem;line-height:2.1">
            Effort<sub>one</sub> ≈ Effort<sub>other</sub><br>
            Respect = Respect<br>
            Loyalty = Loyalty
          </p>
          <p class="small muted mt-2">
            Not identical — symmetrical. Two people can contribute completely differently and still be fair,
            as long as neither is consistently carrying the other.
          </p>
        </div>
      </div>

      <div class="card card-danger">
        <div class="card-body">
          <h2 style="font-size:1.2rem">🚨 The reality check</h2>
          <p class="mt-2">
            Some days one gives 70% and the other gives 30%. That is normal — and it should swap.
          </p>
          <p class="mt-2 bold">
            If the same person is always the one giving more, that is not love. It is a pattern,
            and patterns turn into resentment.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <h2>The ten areas</h2>

    <div class="stack-lg mt-4">
      <?php foreach ($categories as $index => $category): ?>
        <article class="card" id="<?= Str::e($category['slug']) ?>">
          <div class="card-body">
            <div class="row" style="align-items:flex-start;gap:1rem">
              <span style="font-size:2rem;line-height:1"><?= Str::e($category['emoji']) ?></span>

              <div style="flex:1;min-width:0">
                <h3 style="font-size:1.25rem">
                  <?= (int) ($index + 1) ?>. <?= Str::e($category['name']) ?>
                  <?php if (Str::bool($category['is_dealbreaker'])): ?>
                    <span class="badge badge-danger">Non-negotiable</span>
                  <?php endif; ?>
                </h3>
                <p class="muted small mt-1"><?= Str::e($category['description']) ?></p>

                <?php $rows = $byCategory[$category['id']] ?? []; ?>
                <?php if ($rows !== []): ?>
                  <ul class="list-plain mt-3">
                    <?php foreach ($rows as $criterion): ?>
                      <li class="row" style="align-items:flex-start;gap:0.6rem;margin-top:0.4rem">
                        <span class="tone-success" aria-hidden="true">✓</span>
                        <span class="small">
                          <?= Str::e($criterion['text']) ?>
                          <?php if ($criterion['help_text']): ?>
                            <span class="tiny muted" style="display:block"><?= Str::e($criterion['help_text']) ?></span>
                          <?php endif; ?>
                        </span>
                      </li>
                    <?php endforeach; ?>
                  </ul>
                <?php endif; ?>

                <p class="alert alert-info mt-3" style="display:block">
                  <strong>Fair rule</strong>
                  <?= Str::e($category['fair_rule']) ?>
                </p>
              </div>
            </div>
          </div>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section" style="background:hsl(var(--secondary) / 0.4)">
  <div class="container">
    <h2>🔄 The healthy relationship cycle</h2>
    <p class="muted mt-2" style="max-width:60ch">
      Most relationships move through these six stages in order. Skipping one does not remove it —
      it just means you meet it later, with more at stake.
    </p>

    <div class="grid grid-3 mt-4">
      <?php
      $cycle = [
          ['✨', 'Attraction', 'The initial pull — chemistry, curiosity and interest. It asks nothing of you yet.'],
          ['💬', 'Communication', 'Learning how to talk, listen and be understood. Where most couples find their first real friction.'],
          ['🔐', 'Trust building', 'Consistency over time turns interest into safety. This is built slowly and only by both people.'],
          ['⚡', 'Conflict testing', 'The first real disagreements reveal how you repair — or whether you repair at all.'],
          ['💞', 'Deeper bonding', 'Shared history, shared plans, genuine intimacy. Effort starts to feel like a habit.'],
          ['🏡', 'Long-term stability', 'Sustained fairness, effort and direction. The stage that needs maintenance, not intensity.'],
      ];
      foreach ($cycle as $index => [$emoji, $name, $detail]): ?>
        <div class="card feature">
          <span class="feature-icon"><?= $emoji ?></span>
          <h3><?= (int) ($index + 1) ?>. <?= Str::e($name) ?></h3>
          <p><?= Str::e($detail) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="container container-narrow">
    <h2>A practical example</h2>
    <p class="muted mt-2">Same week, two sides. This is what the report actually compares.</p>

    <div class="card mt-3">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Area</th><th>Partner A did</th><th>Partner B did</th><th>Fair?</th></tr>
          </thead>
          <tbody>
            <?php
            $example = [
                ['Communication', 'Called every evening', 'Replied late, often distracted', 'Not yet'],
                ['Financial', 'Paid for dinner twice', 'Paid for the weekend trip', 'Yes'],
                ['Emotional support', 'Listened through a hard week', 'Changed the subject', 'Not yet'],
                ['Time', 'Cancelled plans to be there', 'Was there both weekends', 'Yes'],
                ['Respect', 'Fine with the football night', 'Checked their phone', 'No'],
            ];
            foreach ($example as [$area, $a, $b, $fair]): ?>
              <tr>
                <td class="bold"><?= Str::e($area) ?></td>
                <td class="small"><?= Str::e($a) ?></td>
                <td class="small"><?= Str::e($b) ?></td>
                <td>
                  <?php $tone = $fair === 'Yes' ? 'success' : ($fair === 'No' ? 'danger' : 'warning'); ?>
                  <span class="badge badge-<?= $tone ?>"><?= Str::e($fair) ?></span>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card card-accent mt-4">
      <div class="card-body">
        <h2 style="font-size:1.15rem">Final insight</h2>
        <p class="mt-2">
          A relationship is not fair because both people feel it is. It is fair when
          <strong>structure, effort, respect and consistency</strong> are symmetrical —
          and the only way to know that is for both of you to write down your own side and compare.
        </p>
        <a class="btn mt-3" href="/signup">Start measuring this week</a>
      </div>
    </div>
  </div>
</section>

<?php View::end(); ?>
