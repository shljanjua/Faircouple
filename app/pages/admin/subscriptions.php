<?php
declare(strict_types=1);

Auth::requireAdmin();

if (Request::isPost()) {
    $id = Request::input('id');
    $status = Request::input('status', 'active');
    $periodEnd = Request::date('current_period_end');

    $data = ['status' => $status, 'notes' => Request::nullable('notes')];
    if ($periodEnd !== null) {
        $data['current_period_end'] = $periodEnd . ' 23:59:59';
    }

    Db::update('subscriptions', $id, $data);

    Audit::record('admin.subscription.update', 'subscription', $id, 'Set status to ' . $status);
    Flash::success('Subscription updated.');
    Response::redirect('/admin/subscriptions');
}

$statusFilter = trim((string) ($_GET['status'] ?? ''));

$select = 'SELECT s.*, p.name AS plan_name, pr.email AS member_email, pr.full_name AS member_name
             FROM subscriptions s
             LEFT JOIN plans p ON p.id = s.plan_id
             LEFT JOIN profiles pr ON pr.id = s.user_id';

$subscriptions = $statusFilter !== ''
    ? Db::all($select . ' WHERE s.status = ? ORDER BY s.created_at DESC LIMIT 200', [$statusFilter])
    : Db::all($select . ' ORDER BY s.created_at DESC LIMIT 200');

$all = Db::all('SELECT status, amount_cents, billing_interval FROM subscriptions');

$active = 0;
$trialing = 0;
$churned = 0;
$mrr = 0;

foreach ($all as $row) {
    if (in_array($row['status'], ['active', 'trialing'], true)) {
        $active++;
        $amount = (int) $row['amount_cents'];
        $mrr += match ($row['billing_interval']) {
            'year'     => (int) round($amount / 12),
            'lifetime' => 0,
            default    => $amount,
        };
    }
    if ($row['status'] === 'trialing') {
        $trialing++;
    }
    if (in_array($row['status'], ['canceled', 'expired'], true)) {
        $churned++;
    }
}

$statuses = ['active', 'trialing', 'past_due', 'canceled', 'expired', 'incomplete', 'paused', 'unpaid'];

View::begin('layouts/admin', ['title' => 'Subscriptions', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Subscriptions</h1>
  <p>Every subscription across Stripe, PayPal and manual grants.</p>
</div>

<div class="grid grid-4">
  <div class="card stat"><p class="stat-label">Active</p><p class="stat-value tabular"><?= number_format($active) ?></p></div>
  <div class="card stat"><p class="stat-label">Trialing</p><p class="stat-value tabular"><?= number_format($trialing) ?></p></div>
  <div class="card stat"><p class="stat-label">Cancelled / expired</p><p class="stat-value tabular"><?= number_format($churned) ?></p></div>
  <div class="card stat"><p class="stat-label">Estimated MRR</p><p class="stat-value tabular"><?= Str::e(Currency::money($mrr, 'USD', false)) ?></p></div>
</div>

<div class="tabs mt-3">
  <a href="/admin/subscriptions" class="<?= $statusFilter === '' ? 'is-active' : '' ?>">All</a>
  <?php foreach ($statuses as $status): ?>
    <a href="/admin/subscriptions?status=<?= $status ?>" class="<?= $statusFilter === $status ? 'is-active' : '' ?>">
      <?= Str::e(str_replace('_', ' ', $status)) ?>
    </a>
  <?php endforeach; ?>
</div>

<div class="card">
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Customer</th><th>Plan</th><th>Via</th><th>Status</th><th>Renews</th><th class="right">Amount</th><th>Edit</th></tr>
      </thead>
      <tbody>
        <?php foreach ($subscriptions as $subscription): ?>
          <tr>
            <td>
              <span class="bold"><?= Str::e($subscription['member_name'] ?: '—') ?></span>
              <span class="tiny muted" style="display:block"><?= Str::e($subscription['member_email']) ?></span>
            </td>
            <td class="small"><?= Str::e($subscription['plan_name'] ?: '—') ?></td>
            <td class="small muted"><?= Str::e(ucfirst($subscription['provider'])) ?></td>
            <td>
              <?php
              $tone = in_array($subscription['status'], ['active', 'trialing'], true)
                  ? 'success'
                  : ($subscription['status'] === 'past_due' ? 'warning' : 'danger');
              ?>
              <span class="badge badge-<?= $tone ?>"><?= Str::e($subscription['status']) ?></span>
              <?php if (Str::bool($subscription['cancel_at_period_end'])): ?>
                <span class="badge badge-warning">ending</span>
              <?php endif; ?>
            </td>
            <td class="small muted nowrap"><?= Str::e(Str::date($subscription['current_period_end'])) ?></td>
            <td class="right tabular">
              <?= Str::e(Currency::pretty((int) $subscription['amount_cents'], $subscription['currency'])) ?>
              <span class="tiny muted" style="display:block">/<?= Str::e($subscription['billing_interval']) ?></span>
            </td>
            <td>
              <details>
                <summary class="small" style="cursor:pointer;color:hsl(var(--primary))">Edit</summary>
                <form method="post" class="card card-flat mt-2" style="width:min(18rem,80vw)">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="id" value="<?= Str::e($subscription['id']) ?>">
                  <div class="card-body">
                    <div class="field">
                      <label for="st-<?= Str::e($subscription['id']) ?>">Status</label>
                      <select class="select" id="st-<?= Str::e($subscription['id']) ?>" name="status">
                        <?php foreach ($statuses as $status): ?>
                          <option value="<?= $status ?>" <?= $subscription['status'] === $status ? 'selected' : '' ?>>
                            <?= Str::e(str_replace('_', ' ', $status)) ?>
                          </option>
                        <?php endforeach; ?>
                      </select>
                    </div>
                    <div class="field">
                      <label for="pe-<?= Str::e($subscription['id']) ?>">Period end</label>
                      <input class="input" type="date" id="pe-<?= Str::e($subscription['id']) ?>"
                             name="current_period_end"
                             value="<?= Str::e(substr((string) $subscription['current_period_end'], 0, 10)) ?>">
                    </div>
                    <div class="field">
                      <label for="nt-<?= Str::e($subscription['id']) ?>">Note</label>
                      <input class="input" id="nt-<?= Str::e($subscription['id']) ?>" name="notes"
                             value="<?= Str::e($subscription['notes'] ?? '') ?>">
                    </div>
                    <button class="btn btn-sm btn-block" type="submit">Update</button>
                  </div>
                </form>
              </details>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
