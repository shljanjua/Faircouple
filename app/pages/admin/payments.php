<?php
declare(strict_types=1);

Auth::requireAdmin();

if (Request::isPost()) {
    $provider = Request::input('provider');

    if (!in_array($provider, ['stripe', 'paypal', 'manual'], true)) {
        Flash::error('Unknown provider.');
        Response::redirect('/admin/payments');
    }

    // Blank inputs mean "leave unchanged", so a masked secret is never wiped.
    $existing = Db::one('SELECT credentials FROM payment_gateways WHERE provider = ? LIMIT 1', [$provider]);
    $credentials = Str::json($existing['credentials'] ?? null);

    foreach (Request::all() as $key => $value) {
        if (!str_starts_with($key, 'cred_')) {
            continue;
        }
        $name = substr($key, 5);
        $value = trim((string) $value);
        if ($value !== '') {
            $credentials[$name] = $value;
        }
    }

    Db::run(
        'INSERT INTO payment_gateways (id, provider, display_name, is_enabled, mode, credentials, instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           is_enabled   = VALUES(is_enabled),
           mode         = VALUES(mode),
           credentials  = VALUES(credentials),
           instructions = VALUES(instructions)',
        [
            Str::uuid(),
            $provider,
            Request::input('display_name', ucfirst($provider)),
            Request::bool('is_enabled') ? 1 : 0,
            Request::input('mode', 'test'),
            json_encode($credentials),
            Request::nullable('instructions'),
        ]
    );

    Audit::record('admin.gateway.update', 'payment_gateway', $provider, 'Updated the ' . $provider . ' gateway');
    Flash::success(ucfirst($provider) . ' settings saved.');
    Response::redirect('/admin/payments');
}

$gateways = Db::all('SELECT * FROM payment_gateways ORDER BY sort_order ASC');
$payments = Db::all('SELECT * FROM payments ORDER BY created_at DESC LIMIT 60');
$webhooks = Db::all('SELECT id, provider, event_type, status, error, created_at FROM webhook_events ORDER BY created_at DESC LIMIT 25');

$fields = [
    'stripe' => [
        'publishable_key' => 'Publishable key (pk_...)',
        'secret_key'      => 'Secret key (sk_...)',
        'webhook_secret'  => 'Webhook signing secret (whsec_...)',
    ],
    'paypal' => [
        'client_id'     => 'Client ID',
        'client_secret' => 'Client secret',
        'webhook_id'    => 'Webhook ID',
    ],
    'manual' => [],
];

View::begin('layouts/admin', ['title' => 'Payments', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Payments &amp; gateways</h1>
  <p>Keys are stored write-only — the panel tells you whether one exists, never what it is.</p>
</div>

<div class="alert alert-info mb-2">
  <div>
    <strong>Webhook URLs for this site</strong>
    Stripe: <code><?= Str::e(Config::siteUrl('/webhook-stripe.php')) ?></code><br>
    PayPal: <code><?= Str::e(Config::siteUrl('/webhook-paypal.php')) ?></code>
  </div>
</div>

<div class="stack">
  <?php foreach (['stripe', 'paypal', 'manual'] as $provider): ?>
    <?php
    $gateway = null;
    foreach ($gateways as $row) {
        if ($row['provider'] === $provider) { $gateway = $row; break; }
    }
    $credentials = Str::json($gateway['credentials'] ?? null);
    $enabled = $gateway && Str::bool($gateway['is_enabled']);
    ?>
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="provider" value="<?= $provider ?>">

      <div class="card-head">
        <h2><?= ucfirst($provider) ?></h2>
        <span class="badge badge-<?= $enabled ? 'success' : 'outline' ?>"><?= $enabled ? 'enabled' : 'off' ?></span>
      </div>

      <div class="card-body">
        <div class="field-row">
          <div class="field">
            <label for="name-<?= $provider ?>">Display name</label>
            <input class="input" id="name-<?= $provider ?>" name="display_name"
                   value="<?= Str::e($gateway['display_name'] ?? ucfirst($provider)) ?>">
          </div>
          <div class="field">
            <label for="mode-<?= $provider ?>">Mode</label>
            <select class="select" id="mode-<?= $provider ?>" name="mode">
              <option value="test" <?= ($gateway['mode'] ?? 'test') === 'test' ? 'selected' : '' ?>>Test / sandbox</option>
              <option value="live" <?= ($gateway['mode'] ?? '') === 'live' ? 'selected' : '' ?>>Live</option>
            </select>
          </div>
        </div>

        <?php foreach ($fields[$provider] as $key => $label): ?>
          <?php $isSet = !empty($credentials[$key]); ?>
          <div class="field">
            <label for="<?= $provider ?>-<?= $key ?>">
              <?= Str::e($label) ?>
              <?php if ($isSet): ?><span class="badge badge-success">saved</span><?php endif; ?>
            </label>
            <input class="input mono" type="password" autocomplete="off"
                   id="<?= $provider ?>-<?= $key ?>" name="cred_<?= $key ?>"
                   placeholder="<?= $isSet ? 'Leave blank to keep the saved value' : 'Paste it here' ?>">
          </div>
        <?php endforeach; ?>

        <?php if ($provider === 'manual'): ?>
          <div class="field">
            <label for="instructions">Payment instructions shown at checkout</label>
            <textarea class="textarea" rows="4" id="instructions" name="instructions"><?= Str::e($gateway['instructions'] ?? '') ?></textarea>
          </div>
        <?php endif; ?>

        <label class="checkbox mt-2">
          <input type="checkbox" name="is_enabled" value="1" <?= $enabled ? 'checked' : '' ?>>
          <span>Enable <?= ucfirst($provider) ?> at checkout</span>
        </label>

        <button class="btn mt-3" type="submit">Save <?= ucfirst($provider) ?></button>
      </div>
    </form>
  <?php endforeach; ?>
</div>

<div class="card mt-3">
  <div class="card-head"><h2>Transactions</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Date</th><th>Customer</th><th>Via</th><th>Description</th><th>Status</th><th class="right">Amount</th></tr></thead>
      <tbody>
        <?php foreach ($payments as $payment): ?>
          <tr>
            <td class="small muted nowrap"><?= Str::e(Str::dateTime($payment['created_at'])) ?></td>
            <td class="small"><?= Str::e($payment['billing_email'] ?: '—') ?></td>
            <td class="small muted"><?= Str::e(ucfirst($payment['provider'])) ?></td>
            <td class="small"><?= Str::e(Str::excerpt($payment['description'], 50)) ?></td>
            <td>
              <span class="badge badge-<?= $payment['status'] === 'succeeded' ? 'success' : ($payment['status'] === 'refunded' ? 'warning' : 'danger') ?>">
                <?= Str::e($payment['status']) ?>
              </span>
            </td>
            <td class="right tabular bold"><?= Str::e(Currency::pretty((int) $payment['amount_cents'], $payment['currency'])) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<div class="card mt-3">
  <div class="card-head"><h2>Recent webhook deliveries</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>When</th><th>Provider</th><th>Event</th><th>Status</th><th>Error</th></tr></thead>
      <tbody>
        <?php if ($webhooks === []): ?>
          <tr><td colspan="5" class="small muted">Nothing yet. Once a gateway is live and its webhook is registered, deliveries appear here.</td></tr>
        <?php endif; ?>
        <?php foreach ($webhooks as $event): ?>
          <tr>
            <td class="small muted nowrap"><?= Str::e(Str::dateTime($event['created_at'])) ?></td>
            <td class="small"><?= Str::e($event['provider']) ?></td>
            <td class="small mono"><?= Str::e($event['event_type']) ?></td>
            <td>
              <span class="badge badge-<?= $event['status'] === 'processed' ? 'success' : ($event['status'] === 'failed' ? 'danger' : 'outline') ?>">
                <?= Str::e($event['status']) ?>
              </span>
            </td>
            <td class="tiny muted"><?= Str::e(Str::excerpt($event['error'], 70)) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
