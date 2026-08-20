<?php
declare(strict_types=1);

$plans    = Plans::active();
$currency = Currency::preferred();
$interval = (string) ($_GET['interval'] ?? 'year');
$interval = in_array($interval, ['month', 'year'], true) ? $interval : 'year';
$faqs     = Db::all('SELECT question, answer FROM faqs WHERE is_active = 1 AND page_path = "/pricing" ORDER BY sort_order ASC');

foreach ($plans as $plan) {
    Seo::product($plan, $plan['prices']);
}
Seo::faq($faqs);
Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'Pricing', 'url' => '/pricing']]);

$limitRows = [
    'couples'             => 'Relationship spaces',
    'emotion_logs'        => 'Emotion entries / month',
    'messages'            => 'Messages / month',
    'checklists'          => 'Checklists',
    'budgets'             => 'Budgets',
    'trips'               => 'Trips',
    'itineraries'         => 'Itineraries',
    'gifts'               => 'Gift ideas',
    'documents'           => 'Vault documents',
    'storage_mb'          => 'Storage (MB)',
    'history_months'      => 'History (months)',
    'itinerary_generator' => 'Itinerary generator',
    'advanced_reports'    => 'Advanced fairness reports',
    'custom_categories'   => 'Custom fairness areas',
    'remove_ads'          => 'Ad-free',
    'priority_support'    => 'Priority support',
];

View::begin('layouts/public', [
    'title'       => 'Pricing — Plans in USD, GBP, EUR, CAD & AUD',
    'description' => 'Simple pricing for couples. One subscription covers both partners. Free forever plan, 14-day trial on paid plans, cancel any time.',
]);
?>

<section class="hero" style="padding-block:clamp(2.5rem,2rem+3vw,4rem)">
  <div class="container center">
    <p class="eyebrow">Pricing</p>
    <h1 style="margin-inline:auto">One subscription. Both partners.</h1>
    <p class="lead" style="margin-inline:auto">
      When one of you subscribes, you both get the full plan. Free forever option, 14-day trial on the paid
      plans, cancel any time from your dashboard.
    </p>

    <?php if (isset($_GET['checkout']) && $_GET['checkout'] === 'cancelled'): ?>
      <div class="alert alert-warning mt-3" style="max-width:34rem;margin-inline:auto">
        <div>Checkout cancelled — nothing was charged. Pick a plan whenever you are ready.</div>
      </div>
    <?php endif; ?>

    <form method="get" class="row mt-3" style="justify-content:center">
      <div class="tabs" style="margin:0">
        <a href="/pricing?interval=month&amp;currency=<?= Str::e($currency) ?>"
           class="<?= $interval === 'month' ? 'is-active' : '' ?>">Monthly</a>
        <a href="/pricing?interval=year&amp;currency=<?= Str::e($currency) ?>"
           class="<?= $interval === 'year' ? 'is-active' : '' ?>">Yearly · save ~17%</a>
      </div>

      <label class="sr-only" for="currency">Currency</label>
      <select class="select" id="currency" name="currency" style="width:auto"
              onchange="this.form.submit()">
        <?php foreach (Currency::LIST as $code => $meta): ?>
          <option value="<?= Str::e($code) ?>" <?= $code === $currency ? 'selected' : '' ?>>
            <?= Str::e($meta['flag'] . ' ' . $code) ?>
          </option>
        <?php endforeach; ?>
      </select>
      <input type="hidden" name="interval" value="<?= Str::e($interval) ?>">
      <noscript><button class="btn btn-sm" type="submit">Update</button></noscript>
    </form>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <?php if ($plans === []): ?>
      <div class="card"><div class="card-body empty">
        <p class="empty-emoji">📦</p>
        <p class="bold">No plans are published yet</p>
        <p>An administrator can create them in Admin → Plans &amp; pricing.</p>
      </div></div>
    <?php else: ?>
      <div class="grid grid-4">
        <?php foreach ($plans as $plan):
            $isFree = Str::bool($plan['is_free']);
            $price = $isFree ? null : (Plans::price($plan, $currency, $interval) ?? Plans::price($plan, $currency, 'lifetime'));
            $compare = $price['compare_at_cents'] ?? null;
        ?>
          <div class="card price-card <?= Str::bool($plan['is_featured']) ? 'is-featured' : '' ?>">
            <div class="row-between">
              <h2 style="font-family:var(--font);font-size:1.1rem"><?= Str::e($plan['name']) ?></h2>
              <?php if ($plan['badge']): ?><span class="badge badge-primary"><?= Str::e($plan['badge']) ?></span><?php endif; ?>
            </div>

            <p class="price-amount">
              <?php if ($isFree): ?>
                Free
              <?php elseif ($price): ?>
                <?= Str::e(Currency::pretty((int) $price['amount_cents'], $currency)) ?>
              <?php else: ?>
                <span class="small muted">Not available in <?= Str::e($currency) ?></span>
              <?php endif; ?>
            </p>

            <p class="small muted">
              <?php if ($isFree): ?>
                Forever. No card.
              <?php elseif ($price): ?>
                per <?= $price['billing_interval'] === 'lifetime' ? 'one-off payment' : Str::e($price['billing_interval']) ?>,
                for both partners
                <?php if ($compare): ?>
                  <br><s class="muted"><?= Str::e(Currency::pretty((int) $compare, $currency)) ?></s>
                <?php endif; ?>
              <?php endif; ?>
            </p>

            <p class="small mt-2 bold"><?= Str::e($plan['tagline']) ?></p>
            <?php if (!empty($plan['description'])): ?>
              <p class="tiny muted mt-1"><?= Str::e($plan['description']) ?></p>
            <?php endif; ?>

            <p class="price-list-head"><?= $isFree ? "What you get, free" : "What's included" ?></p>
            <ul class="price-list">
              <?php foreach ($plan['features'] as $feature): ?>
                <li><?= Str::e($feature) ?></li>
              <?php endforeach; ?>
            </ul>

            <?php if ((int) $plan['trial_days'] > 0): ?>
              <p class="tiny muted mt-2"><?= (int) $plan['trial_days'] ?>-day free trial</p>
            <?php endif; ?>

            <?php if ($isFree): ?>
              <a class="btn btn-outline btn-block mt-3" href="/signup">Start free</a>
            <?php elseif ($price): ?>
              <a class="btn <?= Str::bool($plan['is_featured']) ? '' : 'btn-outline' ?> btn-block mt-3"
                 href="<?= Auth::check()
                     ? '/checkout?plan=' . Str::e($plan['slug']) . '&currency=' . Str::e($currency) . '&interval=' . Str::e($price['billing_interval'])
                     : '/signup?plan=' . Str::e($plan['slug']) . '&currency=' . Str::e($currency) . '&interval=' . Str::e($price['billing_interval']) ?>">
                Choose <?= Str::e($plan['name']) ?>
              </a>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if ($plans !== []): ?>
<section class="section">
  <div class="container">
    <h2>Compare every limit</h2>
    <div class="card mt-3">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>What</th>
              <?php foreach ($plans as $plan): ?><th><?= Str::e($plan['name']) ?></th><?php endforeach; ?>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($limitRows as $key => $label): ?>
              <tr>
                <td class="bold"><?= Str::e($label) ?></td>
                <?php foreach ($plans as $plan): ?>
                  <td class="tabular"><?= Str::e(Plans::describe($plan['limits'][$key] ?? 0)) ?></td>
                <?php endforeach; ?>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>

    <p class="small muted mt-2">
      Limits apply to the whole relationship space, not per person. “Unlimited” means exactly that.
    </p>
  </div>
</section>
<?php endif; ?>

<section class="section" style="background:hsl(var(--secondary) / 0.4)">
  <div class="container">
    <div class="grid grid-3">
      <?php
      $assurances = [
          ['💳', 'Card details never touch us', 'Stripe and PayPal handle payment data end to end. We only ever store the outcome.'],
          ['🔄', 'Cancel from your dashboard', 'One button. You keep full access until the end of the period you have paid for.'],
          ['🌍', 'Priced in your currency', 'USD, GBP, EUR, CAD and AUD, chosen by your country at signup and changeable any time.'],
      ];
      foreach ($assurances as [$emoji, $title, $body]): ?>
        <div class="card feature">
          <span class="feature-icon"><?= $emoji ?></span>
          <h3><?= Str::e($title) ?></h3>
          <p><?= Str::e($body) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($faqs !== []): ?>
<section class="section">
  <div class="container container-narrow">
    <h2>Billing questions</h2>
    <div class="mt-3">
      <?php foreach ($faqs as $faq): ?>
        <details class="accordion">
          <summary><?= Str::e($faq['question']) ?></summary>
          <div class="accordion-body"><?= Str::e($faq['answer']) ?></div>
        </details>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php View::end(); ?>
