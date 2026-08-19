<?php
declare(strict_types=1);

Auth::requireAdmin();

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'delete') {
        Db::delete('coupons', 'id = ?', [Request::input('id')]);
        Audit::record('admin.coupon.delete', 'coupon', Request::input('id'), 'Deleted a coupon');
        Flash::success('Coupon deleted.');
        Response::redirect('/admin/coupons');
    }

    if ($action === 'toggle') {
        Db::run('UPDATE coupons SET is_active = 1 - is_active WHERE id = ?', [Request::input('id')]);
        Flash::success('Coupon updated.');
        Response::redirect('/admin/coupons');
    }

    $code = strtoupper(preg_replace('/[^A-Za-z0-9_-]/', '', Request::input('code')) ?? '');

    if ($code === '') {
        Flash::error('A coupon needs a code — letters, numbers, dashes and underscores only.');
        Response::redirect('/admin/coupons');
    }

    $type = Request::input('discount_type', 'percent') === 'fixed' ? 'fixed' : 'percent';
    $percent = null;
    $amount = null;

    if ($type === 'percent') {
        $percent = round(Str::clamp(Request::float('percent_off'), 1, 100), 2);
    } else {
        $amount = Request::cents('amount_off');
        if ($amount === null || $amount <= 0) {
            Flash::error('Enter the fixed discount amount.');
            Response::redirect('/admin/coupons');
        }
    }

    $duration = Request::input('duration', 'once');
    if (!in_array($duration, ['once', 'repeating', 'forever'], true)) {
        $duration = 'once';
    }

    $data = [
        'code'             => substr($code, 0, 60),
        'description'      => Request::nullable('description'),
        'discount_type'    => $type,
        'percent_off'      => $percent,
        'amount_off_cents' => $amount,
        'currency'         => $type === 'fixed' ? Currency::normalise(Request::input('currency', 'USD')) : null,
        'duration'         => $duration,
        'duration_months'  => $duration === 'repeating' ? max(1, Request::int('duration_months', 3)) : null,
        'max_redemptions'  => Request::int('max_redemptions') ?: null,
        'starts_at'        => Request::date('starts_at') ? Request::date('starts_at') . ' 00:00:00' : null,
        'expires_at'       => Request::date('expires_at') ? Request::date('expires_at') . ' 23:59:59' : null,
        'is_active'        => Request::bool('is_active'),
    ];

    $id = Request::input('coupon_id');
    if ($id !== '') {
        $saved = Db::update('coupons', $id, $data);
    } else {
        $existing = Db::one('SELECT id FROM coupons WHERE code = ? LIMIT 1', [$data['code']]);
        if ($existing) {
            Flash::error('That code already exists — edit the existing coupon instead.');
            Response::redirect('/admin/coupons?edit=' . urlencode($existing['id']));
        }
        $saved = Db::insert('coupons', $data) !== null;
    }

    if (!$saved) {
        Flash::error('Could not save that coupon: ' . (Db::lastError() ?? 'unknown database error'));
        Response::redirect('/admin/coupons');
    }

    Audit::record('admin.coupon.save', 'coupon', $data['code'], 'Saved coupon ' . $data['code']);
    Flash::success('Coupon saved.');
    Response::redirect('/admin/coupons');
}

$coupons = Db::all('SELECT * FROM coupons ORDER BY is_active DESC, created_at DESC');

$editing = null;
if (($_GET['edit'] ?? '') !== '') {
    $editing = Db::one('SELECT * FROM coupons WHERE id = ? LIMIT 1', [$_GET['edit']]);
}

$currencies = Settings::list('supported_currencies', ['USD', 'GBP', 'EUR', 'CAD', 'AUD']);

View::begin('layouts/admin', ['title' => 'Coupons', 'no_index' => true]);
?>

<div class="page-head">
  <div class="row-between">
    <div>
      <h1>Coupons</h1>
      <p>Discount codes customers can enter at checkout. Percentage or fixed amount, with optional limits.</p>
    </div>
    <?php if ($editing): ?>
      <a class="btn btn-outline" href="/admin/coupons">+ New coupon</a>
    <?php endif; ?>
  </div>
</div>

<form method="post" class="card">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="save">
  <input type="hidden" name="coupon_id" value="<?= Str::e($editing['id'] ?? '') ?>">

  <div class="card-head">
    <h2><?= $editing ? 'Edit ' . Str::e($editing['code']) : 'Create a coupon' ?></h2>
  </div>

  <div class="card-body">
    <div class="field-row">
      <div class="field">
        <label for="code">Code <span class="required">*</span></label>
        <input class="input mono" id="code" name="code" required maxlength="60" style="text-transform:uppercase"
               value="<?= Str::e($editing['code'] ?? '') ?>" placeholder="LOVE20">
      </div>
      <div class="field">
        <label for="description">Internal description</label>
        <input class="input" id="description" name="description" maxlength="255"
               value="<?= Str::e($editing['description'] ?? '') ?>" placeholder="Launch offer">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="discount_type">Discount type</label>
        <select class="select" id="discount_type" name="discount_type">
          <?= View::options(['percent' => 'Percentage off', 'fixed' => 'Fixed amount off'],
                            $editing['discount_type'] ?? 'percent') ?>
        </select>
      </div>
      <div class="field">
        <label for="percent_off">Percent off</label>
        <input class="input" type="number" min="1" max="100" step="0.01" id="percent_off" name="percent_off"
               value="<?= Str::e($editing['percent_off'] ?? '20') ?>">
      </div>
      <div class="field">
        <label for="amount_off">Fixed amount off</label>
        <input class="input" type="number" min="0" step="0.01" id="amount_off" name="amount_off"
               value="<?= $editing && $editing['amount_off_cents'] !== null
                   ? number_format((int) $editing['amount_off_cents'] / 100, 2, '.', '')
                   : '' ?>">
      </div>
      <div class="field">
        <label for="currency">Currency (fixed only)</label>
        <select class="select" id="currency" name="currency">
          <?php foreach ($currencies as $currency): ?>
            <option value="<?= Str::e($currency) ?>" <?= ($editing['currency'] ?? 'USD') === $currency ? 'selected' : '' ?>>
              <?= Str::e($currency) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="duration">Applies for</label>
        <select class="select" id="duration" name="duration">
          <?= View::options([
              'once'      => 'One billing period',
              'repeating' => 'A number of months',
              'forever'   => 'Every renewal, forever',
          ], $editing['duration'] ?? 'once') ?>
        </select>
      </div>
      <div class="field">
        <label for="duration_months">Months (repeating only)</label>
        <input class="input" type="number" min="1" id="duration_months" name="duration_months"
               value="<?= (int) ($editing['duration_months'] ?? 3) ?>">
      </div>
      <div class="field">
        <label for="max_redemptions">Max redemptions</label>
        <input class="input" type="number" min="0" id="max_redemptions" name="max_redemptions"
               value="<?= Str::e($editing['max_redemptions'] ?? '') ?>" placeholder="Unlimited">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="starts_at">Starts</label>
        <input class="input" type="date" id="starts_at" name="starts_at"
               value="<?= Str::e(substr((string) ($editing['starts_at'] ?? ''), 0, 10)) ?>">
      </div>
      <div class="field">
        <label for="expires_at">Expires</label>
        <input class="input" type="date" id="expires_at" name="expires_at"
               value="<?= Str::e(substr((string) ($editing['expires_at'] ?? ''), 0, 10)) ?>">
      </div>
    </div>

    <label class="checkbox mt-2">
      <input type="checkbox" name="is_active" value="1" <?= Str::bool($editing['is_active'] ?? true) ? 'checked' : '' ?>>
      <span>Active — customers can use it right now</span>
    </label>

    <button class="btn btn-lg mt-3" type="submit"><?= $editing ? 'Save coupon' : 'Create coupon' ?></button>
  </div>
</form>

<div class="card mt-3">
  <div class="card-head"><h2>All coupons (<?= count($coupons) ?>)</h2></div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Code</th><th>Discount</th><th>Applies for</th><th>Used</th><th>Window</th><th>State</th><th></th></tr>
      </thead>
      <tbody>
        <?php if ($coupons === []): ?>
          <tr><td colspan="7" class="small muted">No coupons yet.</td></tr>
        <?php endif; ?>
        <?php foreach ($coupons as $coupon): ?>
          <?php
          $expired = $coupon['expires_at'] !== null && strtotime((string) $coupon['expires_at']) < time();
          $usedUp = $coupon['max_redemptions'] !== null
              && (int) $coupon['redeemed_count'] >= (int) $coupon['max_redemptions'];
          ?>
          <tr>
            <td>
              <span class="bold mono"><?= Str::e($coupon['code']) ?></span>
              <span class="tiny muted" style="display:block"><?= Str::e($coupon['description'] ?? '') ?></span>
            </td>
            <td class="small bold">
              <?= $coupon['discount_type'] === 'percent'
                  ? Str::e(rtrim(rtrim((string) $coupon['percent_off'], '0'), '.')) . '% off'
                  : Str::e(Currency::pretty((int) $coupon['amount_off_cents'], $coupon['currency'])) . ' off' ?>
            </td>
            <td class="small muted">
              <?= Str::e($coupon['duration'] === 'repeating'
                  ? $coupon['duration_months'] . ' months'
                  : ($coupon['duration'] === 'forever' ? 'Forever' : 'Once')) ?>
            </td>
            <td class="small tabular">
              <?= (int) $coupon['redeemed_count'] ?><?= $coupon['max_redemptions'] !== null
                  ? ' / ' . (int) $coupon['max_redemptions'] : '' ?>
            </td>
            <td class="tiny muted nowrap">
              <?= Str::e($coupon['starts_at'] ? Str::date($coupon['starts_at']) : 'Now') ?>
              →
              <?= Str::e($coupon['expires_at'] ? Str::date($coupon['expires_at']) : 'No end') ?>
            </td>
            <td>
              <?php if (!Str::bool($coupon['is_active'])): ?>
                <span class="badge">off</span>
              <?php elseif ($expired): ?>
                <span class="badge badge-warning">expired</span>
              <?php elseif ($usedUp): ?>
                <span class="badge badge-warning">used up</span>
              <?php else: ?>
                <span class="badge badge-success">live</span>
              <?php endif; ?>
            </td>
            <td class="right nowrap">
              <a class="btn btn-sm btn-outline" href="/admin/coupons?edit=<?= Str::e($coupon['id']) ?>">Edit</a>
              <form method="post" style="display:inline">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="toggle">
                <input type="hidden" name="id" value="<?= Str::e($coupon['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">
                  <?= Str::bool($coupon['is_active']) ? 'Disable' : 'Enable' ?>
                </button>
              </form>
              <form method="post" style="display:inline" data-confirm="Delete this coupon?">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= Str::e($coupon['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">Delete</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
