<?php
declare(strict_types=1);

$user = Auth::require();

$planSlug = Request::input('plan');
$currency = Currency::normalise(Request::input('currency', $user['currency']));
$interval = Request::input('interval', 'year');

if ($planSlug === '') {
    Response::redirect('/pricing');
}

$plan = Db::one('SELECT * FROM plans WHERE slug = ? AND is_active = 1 LIMIT 1', [$planSlug]);

if (!$plan || Str::bool($plan['is_free'])) {
    Response::redirect('/pricing');
}

$plan['features'] = Str::json($plan['features']);
$plan['prices'] = Db::all('SELECT * FROM plan_prices WHERE plan_id = ? AND is_active = 1', [$plan['id']]);

$price = Plans::price($plan, $currency, $interval);
if (!$price) {
    // Fall back to any published price in this currency.
    foreach ($plan['prices'] as $row) {
        if ($row['currency'] === $currency) { $price = $row; break; }
    }
}

if (!$price) {
    Flash::error('That plan is not published in ' . $currency . ' yet. Pick another currency.');
    Response::redirect('/pricing');
}

if (Request::isPost()) {
    $provider = Request::input('provider', 'stripe');

    if ($provider === 'stripe') {
        $result = Payments::stripeCheckout($plan, $price, $user, Auth::coupleId());
    } else {
        $result = Payments::paypalOrder($plan, $price, $user);
    }

    if (!$result['ok']) {
        Flash::error($result['error']);
        Response::redirect('/checkout?plan=' . urlencode($planSlug) . '&currency=' . urlencode($currency) . '&interval=' . urlencode($interval));
    }

    Audit::record('checkout.start', 'plan', $planSlug, ucfirst($provider) . " checkout for {$planSlug} ({$currency}/{$interval})");

    Response::redirect($result['url']);
}

$stripeOn = Payments::enabled('stripe');
$paypalOn = Payments::enabled('paypal');
$manual   = Payments::gateway('manual');

View::begin('layouts/bare', ['title' => 'Checkout', 'no_index' => true]);
?>

<p class="small"><a href="/pricing">← Back to the plans</a></p>

<h1 class="mt-2">Checkout</h1>
<p class="muted mt-1">One payment covers both partners.</p>

<div class="card mt-3">
  <div class="card-head">
    <h2><?= Str::e($plan['name']) ?></h2>
    <span class="badge badge-primary"><?= Str::e($price['billing_interval']) ?></span>
  </div>
  <div class="card-body">
    <div class="row-between">
      <span class="muted">Total today</span>
      <span class="price-amount" style="font-size:1.8rem;margin:0">
        <?= Str::e(Currency::pretty((int) $price['amount_cents'], $currency)) ?>
      </span>
    </div>

    <?php if ((int) $plan['trial_days'] > 0): ?>
      <p class="small tone-success mt-1">
        <?= (int) $plan['trial_days'] ?>-day free trial first — you are not charged until it ends.
      </p>
    <?php endif; ?>

    <ul class="price-list mt-3">
      <?php foreach (array_slice($plan['features'], 0, 8) as $feature): ?>
        <li><?= Str::e($feature) ?></li>
      <?php endforeach; ?>
    </ul>

    <p class="small muted mt-3">
      Billed to <strong><?= Str::e($user['email']) ?></strong> ·
      <a href="/pricing?currency=<?= Str::e($currency) ?>&amp;interval=<?= Str::e($interval) ?>">change plan or currency</a>
    </p>
  </div>
</div>

<?php if (!$stripeOn && !$paypalOn): ?>
  <div class="alert alert-warning mt-3">
    <div>
      <strong>No payment method is switched on yet.</strong>
      An administrator needs to enable Stripe or PayPal in Admin → Payments.
      <?php if ($manual && $manual['enabled'] && $manual['instructions']): ?>
        <br><br><?= nl2br(Str::e($manual['instructions'])) ?>
      <?php endif; ?>
    </div>
  </div>
<?php else: ?>
  <div class="stack mt-3">
    <?php if ($stripeOn): ?>
      <form method="post">
        <?= Csrf::field() ?>
        <input type="hidden" name="plan" value="<?= Str::e($planSlug) ?>">
        <input type="hidden" name="currency" value="<?= Str::e($currency) ?>">
        <input type="hidden" name="interval" value="<?= Str::e($interval) ?>">
        <input type="hidden" name="provider" value="stripe">
        <button class="btn btn-lg btn-block" type="submit">
          Pay by card, Apple Pay or Google Pay
        </button>
      </form>
    <?php endif; ?>

    <?php if ($paypalOn): ?>
      <form method="post">
        <?= Csrf::field() ?>
        <input type="hidden" name="plan" value="<?= Str::e($planSlug) ?>">
        <input type="hidden" name="currency" value="<?= Str::e($currency) ?>">
        <input type="hidden" name="interval" value="<?= Str::e($interval) ?>">
        <input type="hidden" name="provider" value="paypal">
        <button class="btn btn-lg btn-outline btn-block" type="submit">Pay with PayPal</button>
      </form>
    <?php endif; ?>
  </div>

  <p class="tiny muted center mt-3">
    You will be taken to <?= $stripeOn ? 'Stripe' : 'PayPal' ?> to pay.
    Card details never touch this server. Cancel any time from your dashboard.
  </p>
<?php endif; ?>

<?php View::end(); ?>
