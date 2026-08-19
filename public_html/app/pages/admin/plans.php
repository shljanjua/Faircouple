<?php
declare(strict_types=1);

Auth::requireAdmin();

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'save_plan') {
        $slug = Str::slug(Request::input('slug'));
        $name = Request::input('name');

        if ($slug === '' || $name === '') {
            Flash::error('Slug and name are required.');
            Response::redirect('/admin/plans');
        }

        $limits = json_decode(Request::raw('limits', '{}'), true);
        if (!is_array($limits)) {
            Flash::error('Limits must be valid JSON. Nothing was saved.');
            Response::redirect('/admin/plans');
        }

        $features = array_values(array_filter(array_map('trim', explode("\n", Request::raw('features')))));

        $data = [
            'slug'        => $slug,
            'name'        => mb_substr($name, 0, 110),
            'tagline'     => Request::nullable('tagline'),
            'description' => Request::nullable('description'),
            'tier'        => Request::int('tier'),
            'is_active'   => Request::bool('is_active'),
            'is_featured' => Request::bool('is_featured'),
            'is_free'     => Request::bool('is_free'),
            'trial_days'  => Request::int('trial_days'),
            'sort_order'  => Request::int('sort_order'),
            'badge'       => Request::nullable('badge'),
            'features'    => json_encode($features),
            'limits'      => json_encode(Plans::mergeLimits($limits)),
        ];

        $id = Request::input('plan_id');
        if ($id !== '') {
            Db::update('plans', $id, $data);
        } else {
            Db::insert('plans', $data);
        }

        Audit::record('admin.plan.save', 'plan', $id ?: $slug, 'Saved plan ' . $name);
        Flash::success('Plan saved.');
        Response::redirect('/admin/plans');
    }

    if ($action === 'save_price') {
        $planId = Request::input('plan_id');
        if ($planId === '') {
            Flash::error('Missing plan.');
            Response::redirect('/admin/plans');
        }

        Db::run(
            'INSERT INTO plan_prices
               (id, plan_id, currency, billing_interval, amount_cents, compare_at_cents,
                stripe_price_id, paypal_plan_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               amount_cents     = VALUES(amount_cents),
               compare_at_cents = VALUES(compare_at_cents),
               stripe_price_id  = VALUES(stripe_price_id),
               paypal_plan_id   = VALUES(paypal_plan_id),
               is_active        = VALUES(is_active)',
            [
                Str::uuid(),
                $planId,
                strtoupper(Request::input('currency', 'USD')),
                Request::input('billing_interval', 'month'),
                Request::cents('amount') ?? 0,
                Request::cents('compare_at'),
                Request::nullable('stripe_price_id'),
                Request::nullable('paypal_plan_id'),
                Request::bool('price_active') ? 1 : 0,
            ]
        );

        Flash::success('Price saved.');
        Response::redirect('/admin/plans');
    }

    if ($action === 'delete_price') {
        Db::delete('plan_prices', 'id = ?', [Request::input('id')]);
        Flash::success('Price removed.');
        Response::redirect('/admin/plans');
    }

    if ($action === 'delete_plan') {
        $planId = Request::input('plan_id');
        $active = Db::count('subscriptions', 'plan_id = ? AND status IN ("active","trialing")', [$planId]);

        if ($active > 0) {
            Flash::error("{$active} active subscription(s) use this plan. Deactivate it instead of deleting.");
            Response::redirect('/admin/plans');
        }

        Db::delete('plans', 'id = ?', [$planId]);
        Flash::success('Plan deleted.');
        Response::redirect('/admin/plans');
    }
}

$plans = Db::all('SELECT * FROM plans ORDER BY sort_order ASC, tier ASC');
$prices = Db::all('SELECT * FROM plan_prices ORDER BY currency ASC, billing_interval ASC');

$pricesByPlan = [];
foreach ($prices as $price) {
    $pricesByPlan[$price['plan_id']][] = $price;
}

View::begin('layouts/admin', ['title' => 'Plans & pricing', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Plans &amp; pricing</h1>
  <p>Create packages, set every limit, and publish prices per currency and interval.</p>
</div>

<div class="stack">
  <?php foreach ($plans as $plan): ?>
    <?php
    $features = Str::json($plan['features']);
    $limits = Plans::mergeLimits(Str::json($plan['limits']));
    ?>
    <details class="card" <?= count($plans) === 1 ? 'open' : '' ?>>
      <summary style="padding:1.25rem;cursor:pointer;list-style:none">
        <div class="row-between">
          <span>
            <strong><?= Str::e($plan['name']) ?></strong>
            <span class="mono tiny muted">/<?= Str::e($plan['slug']) ?></span>
            <?php if (Str::bool($plan['is_free'])): ?><span class="badge">free</span><?php endif; ?>
            <?php if (Str::bool($plan['is_featured'])): ?><span class="badge badge-primary">featured</span><?php endif; ?>
            <span class="badge badge-<?= Str::bool($plan['is_active']) ? 'success' : 'outline' ?>">
              <?= Str::bool($plan['is_active']) ? 'live' : 'hidden' ?>
            </span>
          </span>
          <span class="small muted"><?= count($pricesByPlan[$plan['id']] ?? []) ?> prices</span>
        </div>
      </summary>

      <div class="card-body" style="border-top:1px solid hsl(var(--border))">
        <form method="post">
          <?= Csrf::field() ?>
          <input type="hidden" name="action" value="save_plan">
          <input type="hidden" name="plan_id" value="<?= Str::e($plan['id']) ?>">

          <div class="field-row">
            <div class="field">
              <label for="name-<?= Str::e($plan['id']) ?>">Name</label>
              <input class="input" id="name-<?= Str::e($plan['id']) ?>" name="name" value="<?= Str::e($plan['name']) ?>">
            </div>
            <div class="field">
              <label for="slug-<?= Str::e($plan['id']) ?>">Slug</label>
              <input class="input" id="slug-<?= Str::e($plan['id']) ?>" name="slug" value="<?= Str::e($plan['slug']) ?>">
            </div>
            <div class="field">
              <label for="badge-<?= Str::e($plan['id']) ?>">Badge</label>
              <input class="input" id="badge-<?= Str::e($plan['id']) ?>" name="badge" value="<?= Str::e($plan['badge'] ?? '') ?>">
            </div>
          </div>

          <div class="field">
            <label for="tagline-<?= Str::e($plan['id']) ?>">Tagline</label>
            <input class="input" id="tagline-<?= Str::e($plan['id']) ?>" name="tagline" value="<?= Str::e($plan['tagline'] ?? '') ?>">
          </div>

          <div class="field-row">
            <div class="field">
              <label for="tier-<?= Str::e($plan['id']) ?>">Tier</label>
              <input class="input" type="number" id="tier-<?= Str::e($plan['id']) ?>" name="tier" value="<?= (int) $plan['tier'] ?>">
            </div>
            <div class="field">
              <label for="trial-<?= Str::e($plan['id']) ?>">Trial days</label>
              <input class="input" type="number" id="trial-<?= Str::e($plan['id']) ?>" name="trial_days" value="<?= (int) $plan['trial_days'] ?>">
            </div>
            <div class="field">
              <label for="order-<?= Str::e($plan['id']) ?>">Sort order</label>
              <input class="input" type="number" id="order-<?= Str::e($plan['id']) ?>" name="sort_order" value="<?= (int) $plan['sort_order'] ?>">
            </div>
          </div>

          <div class="field">
            <label for="features-<?= Str::e($plan['id']) ?>">Features — one per line</label>
            <textarea class="textarea" rows="7" id="features-<?= Str::e($plan['id']) ?>"
                      name="features"><?= Str::e(implode("\n", $features)) ?></textarea>
          </div>

          <div class="field">
            <label for="limits-<?= Str::e($plan['id']) ?>">Limits (JSON) — use -1 for unlimited</label>
            <textarea class="textarea mono" rows="8" id="limits-<?= Str::e($plan['id']) ?>"
                      name="limits" style="font-size:0.8rem"><?= Str::e(json_encode($limits, JSON_PRETTY_PRINT)) ?></textarea>
          </div>

          <div class="row">
            <label class="checkbox"><input type="checkbox" name="is_active" value="1" <?= Str::bool($plan['is_active']) ? 'checked' : '' ?>> Live</label>
            <label class="checkbox"><input type="checkbox" name="is_featured" value="1" <?= Str::bool($plan['is_featured']) ? 'checked' : '' ?>> Featured</label>
            <label class="checkbox"><input type="checkbox" name="is_free" value="1" <?= Str::bool($plan['is_free']) ? 'checked' : '' ?>> Free plan</label>
          </div>

          <button class="btn mt-3" type="submit">Save plan</button>
        </form>

        <hr class="divider">

        <h3 style="font-family:var(--font);font-size:1rem">Prices</h3>
        <div class="table-wrap mt-2">
          <table>
            <thead><tr><th>Currency</th><th>Interval</th><th class="right">Amount</th><th class="right">Compare at</th><th>Stripe price id</th><th>Live</th><th></th></tr></thead>
            <tbody>
              <?php foreach ($pricesByPlan[$plan['id']] ?? [] as $price): ?>
                <tr>
                  <td class="bold"><?= Str::e($price['currency']) ?></td>
                  <td class="small"><?= Str::e($price['billing_interval']) ?></td>
                  <td class="right tabular"><?= Str::e(Currency::pretty((int) $price['amount_cents'], $price['currency'])) ?></td>
                  <td class="right tabular muted">
                    <?= $price['compare_at_cents'] ? Str::e(Currency::pretty((int) $price['compare_at_cents'], $price['currency'])) : '—' ?>
                  </td>
                  <td class="mono tiny"><?= Str::e($price['stripe_price_id'] ?: '—') ?></td>
                  <td>
                    <span class="badge badge-<?= Str::bool($price['is_active']) ? 'success' : 'outline' ?>">
                      <?= Str::bool($price['is_active']) ? 'yes' : 'no' ?>
                    </span>
                  </td>
                  <td class="right">
                    <form method="post" data-confirm="Remove this price?">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="delete_price">
                      <input type="hidden" name="id" value="<?= Str::e($price['id']) ?>">
                      <button class="btn btn-sm btn-ghost" type="submit">✕</button>
                    </form>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>

        <form method="post" class="mt-3">
          <?= Csrf::field() ?>
          <input type="hidden" name="action" value="save_price">
          <input type="hidden" name="plan_id" value="<?= Str::e($plan['id']) ?>">

          <div class="field-row">
            <div class="field">
              <label for="cur-<?= Str::e($plan['id']) ?>">Currency</label>
              <select class="select" id="cur-<?= Str::e($plan['id']) ?>" name="currency">
                <?php foreach (array_keys(Currency::LIST) as $code): ?>
                  <option value="<?= $code ?>"><?= $code ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="field">
              <label for="int-<?= Str::e($plan['id']) ?>">Interval</label>
              <select class="select" id="int-<?= Str::e($plan['id']) ?>" name="billing_interval">
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
            <div class="field">
              <label for="amt-<?= Str::e($plan['id']) ?>">Amount</label>
              <input class="input" type="number" step="0.01" min="0" id="amt-<?= Str::e($plan['id']) ?>" name="amount">
            </div>
            <div class="field">
              <label for="cmp-<?= Str::e($plan['id']) ?>">Compare at</label>
              <input class="input" type="number" step="0.01" min="0" id="cmp-<?= Str::e($plan['id']) ?>" name="compare_at">
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="spid-<?= Str::e($plan['id']) ?>">Stripe price id (optional)</label>
              <input class="input mono" id="spid-<?= Str::e($plan['id']) ?>" name="stripe_price_id" placeholder="price_...">
            </div>
            <div class="field">
              <label for="ppid-<?= Str::e($plan['id']) ?>">PayPal plan id (optional)</label>
              <input class="input mono" id="ppid-<?= Str::e($plan['id']) ?>" name="paypal_plan_id">
            </div>
          </div>

          <label class="checkbox"><input type="checkbox" name="price_active" value="1" checked> Live</label>
          <button class="btn btn-outline mt-2" type="submit">Add or update this price</button>
        </form>

        <hr class="divider">

        <form method="post" data-confirm="Delete this plan?">
          <?= Csrf::field() ?>
          <input type="hidden" name="action" value="delete_plan">
          <input type="hidden" name="plan_id" value="<?= Str::e($plan['id']) ?>">
          <button class="btn btn-sm btn-danger" type="submit">Delete plan</button>
        </form>
      </div>
    </details>
  <?php endforeach; ?>

  <details class="card">
    <summary style="padding:1.25rem;cursor:pointer;font-weight:600">+ Create a new plan</summary>
    <div class="card-body" style="border-top:1px solid hsl(var(--border))">
      <form method="post">
        <?= Csrf::field() ?>
        <input type="hidden" name="action" value="save_plan">

        <div class="field-row">
          <div class="field">
            <label for="new_name">Name</label>
            <input class="input" id="new_name" name="name" required>
          </div>
          <div class="field">
            <label for="new_slug">Slug</label>
            <input class="input" id="new_slug" name="slug" required placeholder="premium-plus">
          </div>
          <div class="field">
            <label for="new_tier">Tier</label>
            <input class="input" type="number" id="new_tier" name="tier" value="1">
          </div>
        </div>

        <div class="field">
          <label for="new_tagline">Tagline</label>
          <input class="input" id="new_tagline" name="tagline">
        </div>

        <div class="field">
          <label for="new_features">Features — one per line</label>
          <textarea class="textarea" rows="5" id="new_features" name="features"></textarea>
        </div>

        <div class="field">
          <label for="new_limits">Limits (JSON)</label>
          <textarea class="textarea mono" rows="8" id="new_limits" name="limits"
                    style="font-size:0.8rem"><?= Str::e(json_encode(Plans::FREE_LIMITS, JSON_PRETTY_PRINT)) ?></textarea>
        </div>

        <label class="checkbox"><input type="checkbox" name="is_active" value="1" checked> Live</label>
        <button class="btn mt-3" type="submit">Create plan</button>
      </form>
    </div>
  </details>
</div>

<?php View::end(); ?>
