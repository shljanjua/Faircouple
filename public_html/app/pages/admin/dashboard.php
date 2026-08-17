<?php
declare(strict_types=1);

Auth::requireAdmin();

$monthStart = date('Y-m-01 00:00:00');

$counts = [
    'users'        => Db::count('profiles', 'deleted_at IS NULL'),
    'new_users'    => Db::count('profiles', 'created_at >= ?', [$monthStart]),
    'couples'      => Db::count('couples'),
    'active_subs'  => Db::count('subscriptions', 'status IN ("active","trialing")'),
    'contacts'     => Db::count('contact_messages', 'status = "new"'),
    'subscribers'  => Db::count('newsletter_subscribers', 'status = "subscribed"'),
    'failed_email' => Db::count('email_logs', 'status = "failed"'),
];

$monthRevenue = (int) Db::value(
    'SELECT COALESCE(SUM(amount_cents),0) FROM payments WHERE status = "succeeded" AND created_at >= ?',
    [$monthStart],
    0
);

$activeSubscriptions = Db::all(
    'SELECT amount_cents, billing_interval FROM subscriptions WHERE status IN ("active","trialing")'
);

$mrr = 0;
foreach ($activeSubscriptions as $subscription) {
    $amount = (int) $subscription['amount_cents'];
    $mrr += match ($subscription['billing_interval']) {
        'year'     => (int) round($amount / 12),
        'lifetime' => 0,
        default    => $amount,
    };
}

$recentUsers = Db::all(
    'SELECT id, email, full_name, country_code, currency, created_at, role
       FROM profiles WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 8'
);

$recentPayments = Db::all(
    'SELECT id, amount_cents, currency, status, provider, created_at, billing_email
       FROM payments ORDER BY created_at DESC LIMIT 8'
);

$warnings = [];
if (!Payments::anyEnabled()) {
    $warnings[] = ['No payment gateway is switched on — nobody can subscribe yet.', '/admin/payments'];
}
if (Settings::text('smtp_host') === '') {
    $warnings[] = ['SMTP is not configured — confirmation and receipt emails will not send.', '/admin/emails'];
}
if (Settings::text('analytics_ga4_id') === '') {
    $warnings[] = ['Google Analytics 4 is not connected.', '/admin/settings'];
}
if (Settings::bool('maintenance_mode')) {
    $warnings[] = ['Maintenance mode is ON — the public site is hidden from visitors.', '/admin/settings'];
}
if (Config::key() === '' || str_starts_with(Config::key(), 'CHANGE-THIS')) {
    $warnings[] = ['The security key in app/config.php is still the shipped placeholder.', '/admin/settings'];
}

$integrations = [
    ['Stripe', Payments::enabled('stripe'), '/admin/payments'],
    ['PayPal', Payments::enabled('paypal'), '/admin/payments'],
    ['SMTP email', Settings::text('smtp_host') !== '', '/admin/emails'],
    ['Google Analytics', Settings::text('analytics_ga4_id') !== '', '/admin/settings'],
    ['Google Tag Manager', Settings::text('analytics_gtm_id') !== '', '/admin/settings'],
    ['Meta Pixel', Settings::text('analytics_meta_pixel_id') !== '', '/admin/settings'],
    ['Google Ads', Settings::text('analytics_google_ads_id') !== '', '/admin/settings'],
    ['AdSense', Settings::text('analytics_adsense_client') !== '', '/admin/settings'],
    ['Search Console', Settings::text('seo_google_verification') !== '', '/admin/seo'],
];

View::begin('layouts/admin', ['title' => 'Admin dashboard', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Dashboard</h1>
  <p>Everything about <?= Str::e(Settings::text('site_name', 'FairCouples')) ?>, controlled from here.</p>
</div>

<?php if ($warnings !== []): ?>
  <div class="alert alert-warning mb-2">
    <div>
      <strong>Setup checklist</strong>
      <ul class="list-plain mt-1">
        <?php foreach ($warnings as [$message, $link]): ?>
          <li>⚠️ <?= Str::e($message) ?> <a href="<?= $link ?>">Fix it →</a></li>
        <?php endforeach; ?>
      </ul>
    </div>
  </div>
<?php endif; ?>

<div class="grid grid-4">
  <div class="card stat">
    <p class="stat-label">Total users</p>
    <p class="stat-value tabular"><?= number_format($counts['users']) ?></p>
    <p class="stat-hint"><?= number_format($counts['new_users']) ?> joined this month</p>
  </div>
  <div class="card stat">
    <p class="stat-label">Relationship spaces</p>
    <p class="stat-value tabular"><?= number_format($counts['couples']) ?></p>
  </div>
  <div class="card stat">
    <p class="stat-label">Active subscriptions</p>
    <p class="stat-value tabular"><?= number_format($counts['active_subs']) ?></p>
    <p class="stat-hint">MRR ≈ <?= Str::e(Currency::money($mrr, 'USD', false)) ?></p>
  </div>
  <div class="card stat">
    <p class="stat-label">Revenue this month</p>
    <p class="stat-value tabular"><?= Str::e(Currency::money($monthRevenue, 'USD', false)) ?></p>
  </div>
</div>

<div class="grid grid-3 mt-3">
  <a class="card" href="/admin/contacts" style="color:inherit">
    <div class="card-body row-between">
      <span>📬 New contact messages</span>
      <span class="bold tabular"><?= number_format($counts['contacts']) ?></span>
    </div>
  </a>
  <a class="card" href="/admin/contacts" style="color:inherit">
    <div class="card-body row-between">
      <span>📰 Newsletter subscribers</span>
      <span class="bold tabular"><?= number_format($counts['subscribers']) ?></span>
    </div>
  </a>
  <a class="card" href="/admin/emails" style="color:inherit">
    <div class="card-body row-between">
      <span>⚠️ Failed emails</span>
      <span class="bold tabular"><?= number_format($counts['failed_email']) ?></span>
    </div>
  </a>
</div>

<div class="grid grid-2 mt-3">
  <div class="card">
    <div class="card-head">
      <h2>Newest users</h2>
      <a class="small" href="/admin/users">View all →</a>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>User</th><th>Country</th><th>Joined</th></tr></thead>
        <tbody>
          <?php foreach ($recentUsers as $row): ?>
            <tr>
              <td>
                <span class="bold"><?= Str::e($row['full_name'] ?: '—') ?></span>
                <span class="tiny muted" style="display:block"><?= Str::e($row['email']) ?></span>
              </td>
              <td class="small muted"><?= Str::e($row['country_code'] ?: '—') ?> · <?= Str::e($row['currency']) ?></td>
              <td class="small muted nowrap"><?= Str::e(Str::timeAgo($row['created_at'])) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Latest payments</h2>
      <a class="small" href="/admin/payments">View all →</a>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Customer</th><th>Via</th><th>Status</th><th class="right">Amount</th></tr></thead>
        <tbody>
          <?php foreach ($recentPayments as $payment): ?>
            <tr>
              <td class="small">
                <?= Str::e($payment['billing_email'] ?: '—') ?>
                <span class="tiny muted" style="display:block"><?= Str::e(Str::date($payment['created_at'])) ?></span>
              </td>
              <td class="small muted"><?= Str::e(ucfirst($payment['provider'])) ?></td>
              <td>
                <span class="badge badge-<?= $payment['status'] === 'succeeded' ? 'success' : 'danger' ?>">
                  <?= Str::e($payment['status']) ?>
                </span>
              </td>
              <td class="right tabular bold">
                <?= Str::e(Currency::pretty((int) $payment['amount_cents'], $payment['currency'])) ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="card mt-3">
  <div class="card-head"><h2>Integration status</h2></div>
  <div class="card-body">
    <div class="grid grid-3">
      <?php foreach ($integrations as [$label, $connected, $link]): ?>
        <a class="row-between card card-flat" href="<?= $link ?>"
           style="color:inherit;padding:0.7rem 0.9rem;text-decoration:none">
          <span class="small"><?= Str::e($label) ?></span>
          <span class="badge badge-<?= $connected ? 'success' : 'outline' ?>">
            <?= $connected ? 'connected' : 'not set' ?>
          </span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<?php View::end(); ?>
