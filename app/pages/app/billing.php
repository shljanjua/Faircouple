<?php
declare(strict_types=1);

$user = Auth::require();
$entitlements = Auth::entitlements();
$coupleId = Auth::coupleId();

if (Request::isPost()) {
    $action = Request::input('action');
    $subscriptionId = Request::input('id');

    $subscription = Db::one('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [$subscriptionId]);

    if (!$subscription || ($subscription['user_id'] !== $user['id'] && !Auth::isAdmin())) {
        Flash::error('You can only change your own subscription.');
        Response::redirect('/dashboard/billing');
    }

    if ($action === 'cancel') {
        if ($subscription['provider'] === 'stripe' && $subscription['provider_subscription_id']) {
            Payments::stripePost('subscriptions/' . $subscription['provider_subscription_id'], ['cancel_at_period_end' => 'true']);
        }
        if ($subscription['provider'] === 'paypal' && str_starts_with((string) $subscription['provider_subscription_id'], 'I-')) {
            Payments::paypalCancelSubscription((string) $subscription['provider_subscription_id']);
        }

        Db::run(
            'UPDATE subscriptions SET cancel_at_period_end = 1, canceled_at = UTC_TIMESTAMP() WHERE id = ?',
            [$subscriptionId]
        );

        Audit::record('subscription.cancel', 'subscription', $subscriptionId, 'Cancelled at period end');
        Flash::success('Cancelled. You keep full access until the end of the period you have paid for.');
        Response::redirect('/dashboard/billing');
    }

    if ($action === 'resume') {
        if ($subscription['provider'] === 'stripe' && $subscription['provider_subscription_id']) {
            Payments::stripePost('subscriptions/' . $subscription['provider_subscription_id'], ['cancel_at_period_end' => 'false']);
        }

        Db::run(
            'UPDATE subscriptions SET cancel_at_period_end = 0, canceled_at = NULL WHERE id = ?',
            [$subscriptionId]
        );

        Flash::success('Subscription resumed.');
        Response::redirect('/dashboard/billing');
    }
}

$subscriptions = Db::all(
    'SELECT s.*, p.name AS plan_name, p.slug AS plan_slug
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC',
    [$user['id']]
);

$payments = Db::all(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
    [$user['id']]
);

// A partner's paid plan covers this account too — say so explicitly.
$partnerCovers = $entitlements['is_paid']
    && ($entitlements['subscription']['user_id'] ?? null) !== $user['id'];

$usage = [];
if ($coupleId) {
    $usage = [
        ['Emotion entries this month', Db::count('emotion_logs', 'couple_id = ? AND logged_at >= ?', [$coupleId, date('Y-m-01 00:00:00')]), 'emotion_logs'],
        ['Messages this month', Db::count('messages', 'couple_id = ? AND created_at >= ?', [$coupleId, date('Y-m-01 00:00:00')]), 'messages'],
        ['Checklists', Db::count('checklists', 'couple_id = ? AND archived_at IS NULL', [$coupleId]), 'checklists'],
        ['Trips', Db::count('trips', 'couple_id = ? AND status <> "cancelled"', [$coupleId]), 'trips'],
        ['Vault documents', Db::count('travel_documents', 'couple_id = ?', [$coupleId]), 'documents'],
    ];
}

$checkout = Request::input('checkout');

View::begin('layouts/app', ['title' => 'Plan & billing', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Plan &amp; billing</h1>
  <p>One subscription covers both partners. Cancel any time — you keep access to the end of the period.</p>
</div>

<?php if ($checkout === 'success'): ?>
  <div class="alert alert-success mb-2">
    <div>
      <strong>Payment received.</strong>
      Your plan is active. If it still says Free below, give the payment provider a few seconds and reload.
    </div>
  </div>
<?php elseif ($checkout === 'failed'): ?>
  <div class="alert alert-danger mb-2">
    <div>
      <strong>That payment did not go through.</strong>
      <?= Str::e(Request::input('message', 'Nothing was charged. Please try again.')) ?>
    </div>
  </div>
<?php endif; ?>

<div class="grid grid-sidebar">
  <div class="stack">
    <div class="card">
      <div class="card-head">
        <h2>Current plan</h2>
        <span class="badge badge-<?= $entitlements['is_paid'] ? 'success' : 'outline' ?>">
          <?= Str::e($entitlements['plan']['name']) ?>
        </span>
      </div>
      <div class="card-body">
        <?php if ($partnerCovers): ?>
          <div class="alert alert-info">
            <div>
              Your partner subscribed, and their plan covers you both. There is nothing for you to pay.
            </div>
          </div>
        <?php elseif (!$entitlements['is_paid']): ?>
          <p class="small muted">
            You are on the free plan. Upgrading unlocks unlimited emotions and messages, the full
            fairness reports, the itinerary generator and 5&nbsp;GB of vault storage — for both of you.
          </p>
          <a class="btn mt-3" href="/pricing">See the plans</a>
        <?php endif; ?>

        <?php foreach ($subscriptions as $subscription): ?>
          <div class="card card-flat mt-3">
            <div class="card-body">
              <div class="row-between">
                <div>
                  <p class="bold"><?= Str::e($subscription['plan_name'] ?: 'Plan') ?></p>
                  <p class="small muted">
                    <?= Str::e(ucfirst($subscription['provider'])) ?> ·
                    <?= Str::e(Currency::pretty((int) $subscription['amount_cents'], $subscription['currency'])) ?>
                    / <?= Str::e($subscription['billing_interval']) ?>
                  </p>
                </div>
                <span class="badge badge-<?= in_array($subscription['status'], ['active', 'trialing'], true) ? 'success' : 'danger' ?>">
                  <?= Str::e($subscription['status']) ?>
                </span>
              </div>

              <p class="small mt-2">
                <?php if ($subscription['current_period_end']): ?>
                  <?= Str::bool($subscription['cancel_at_period_end']) ? 'Access ends' : 'Renews' ?>
                  <?= Str::e(Str::date($subscription['current_period_end'])) ?>
                <?php endif; ?>
                <?php if ($subscription['trial_ends_at'] && strtotime((string) $subscription['trial_ends_at']) > time()): ?>
                  · trial until <?= Str::e(Str::date($subscription['trial_ends_at'])) ?>
                <?php endif; ?>
              </p>

              <?php if (in_array($subscription['status'], ['active', 'trialing'], true)): ?>
                <div class="row mt-3">
                  <?php if (Str::bool($subscription['cancel_at_period_end'])): ?>
                    <form method="post">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="resume">
                      <input type="hidden" name="id" value="<?= Str::e($subscription['id']) ?>">
                      <button class="btn btn-sm" type="submit">Resume subscription</button>
                    </form>
                  <?php else: ?>
                    <form method="post" data-confirm="Cancel at the end of this period?">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="cancel">
                      <input type="hidden" name="id" value="<?= Str::e($subscription['id']) ?>">
                      <button class="btn btn-sm btn-outline" type="submit">Cancel subscription</button>
                    </form>
                  <?php endif; ?>
                  <a class="btn btn-sm btn-ghost" href="/pricing">Change plan</a>
                </div>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>

    <?php if ($payments !== []): ?>
      <div class="card">
        <div class="card-head"><h2>Payment history</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Method</th><th>Status</th><th class="right">Amount</th><th></th></tr></thead>
            <tbody>
              <?php foreach ($payments as $payment): ?>
                <tr>
                  <td class="small nowrap"><?= Str::e(Str::date($payment['created_at'])) ?></td>
                  <td class="small"><?= Str::e($payment['description'] ?: '—') ?></td>
                  <td class="small muted"><?= Str::e(ucfirst($payment['provider'])) ?></td>
                  <td>
                    <span class="badge badge-<?= $payment['status'] === 'succeeded' ? 'success' : 'danger' ?>">
                      <?= Str::e($payment['status']) ?>
                    </span>
                  </td>
                  <td class="right tabular"><?= Str::e(Currency::pretty((int) $payment['amount_cents'], $payment['currency'])) ?></td>
                  <td class="right">
                    <?php if ($payment['invoice_url']): ?>
                      <a class="small" href="<?= Str::e($payment['invoice_url']) ?>" target="_blank" rel="noopener">Invoice</a>
                    <?php elseif ($payment['receipt_url']): ?>
                      <a class="small" href="<?= Str::e($payment['receipt_url']) ?>" target="_blank" rel="noopener">Receipt</a>
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
    <?php if ($usage !== []): ?>
      <div class="card">
        <div class="card-head"><h2>Your usage</h2></div>
        <div class="card-body">
          <?php foreach ($usage as [$label, $count, $key]): ?>
            <?php $limit = $entitlements['limits'][$key] ?? 0; ?>
            <div class="mt-2">
              <div class="row-between small">
                <span><?= Str::e($label) ?></span>
                <span class="tabular">
                  <?= (int) $count ?><?= (int) $limit === -1 ? '' : ' / ' . (int) $limit ?>
                </span>
              </div>
              <?php if ((int) $limit > 0): ?>
                <?php $percent = min(100, ($count / $limit) * 100); ?>
                <?= View::meter($percent, 100, $percent > 85 ? 'danger' : ($percent > 60 ? 'warning' : 'primary')) ?>
              <?php endif; ?>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    <?php endif; ?>

    <div class="card">
      <div class="card-body">
        <h2 style="font-size:1rem">Billing questions</h2>
        <ul class="list-plain small mt-2">
          <li><a href="/pricing">Compare the plans</a></li>
          <li><a href="/faq">Billing FAQ</a></li>
          <li><a href="/contact">Ask for a refund</a></li>
        </ul>
        <p class="tiny muted mt-3">
          Card details never touch this server — Stripe and PayPal hold them.
        </p>
      </div>
    </div>
  </aside>
</div>

<?php View::end(); ?>
