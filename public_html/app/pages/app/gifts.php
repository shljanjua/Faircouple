<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$currency = $context['couple']['currency'];
$partner  = $context['partner'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'save_gift') {
        $title = Request::input('title');
        if ($title === '') {
            Flash::error('Give the gift a name.');
            Response::redirect('/dashboard/gifts');
        }

        $id = Request::input('gift_id');

        if ($id === '') {
            $limitError = Plans::check('gifts', 'gifts');
            if ($limitError !== null) {
                Flash::error($limitError);
                Response::redirect('/dashboard/gifts');
            }
        }

        $data = [
            'to_user'       => Request::nullable('to_user') ?? ($partner['user_id'] ?? null),
            'title'         => mb_substr($title, 0, 190),
            'description'   => Request::nullable('description'),
            'occasion'      => Request::input('occasion', 'other'),
            'status'        => Request::input('status', 'idea'),
            'amount_cents'  => Request::cents('amount'),
            'currency'      => Currency::normalise(Request::input('currency', $currency)),
            'url'           => Request::nullable('url'),
            'store'         => Request::nullable('store'),
            'occasion_date' => Request::date('occasion_date'),
            'is_surprise'   => Request::bool('is_surprise'),
        ];

        if ($id !== '' && Auth::ownsRow('gifts', $id)) {
            Db::update('gifts', $id, $data);
        } else {
            Db::insert('gifts', $data + ['couple_id' => $coupleId, 'from_user' => $user['id'], 'created_by' => $user['id']]);
        }

        Flash::success('Gift saved.');
        Response::redirect('/dashboard/gifts');
    }

    if ($action === 'delete_gift') {
        Db::delete('gifts', 'id = ? AND couple_id = ?', [Request::input('id'), $coupleId]);
        Flash::success('Deleted.');
        Response::redirect('/dashboard/gifts');
    }

    if ($action === 'advance') {
        $gift = Db::one('SELECT status FROM gifts WHERE id = ? AND couple_id = ? LIMIT 1', [Request::input('id'), $coupleId]);
        if ($gift) {
            $flow = ['idea', 'planned', 'purchased', 'wrapped', 'given'];
            $index = array_search($gift['status'], $flow, true);
            $next = $flow[min(count($flow) - 1, ($index === false ? 0 : $index) + 1)];
            Db::run('UPDATE gifts SET status = ?, given_at = ? WHERE id = ?', [
                $next,
                $next === 'given' ? Str::today() : null,
                Request::input('id'),
            ]);
        }
        Response::redirect('/dashboard/gifts');
    }

    if ($action === 'save_wish') {
        $title = Request::input('title');
        if ($title !== '') {
            Db::insert('wishlist_items', [
                'couple_id'   => $coupleId,
                'user_id'     => $user['id'],
                'title'       => mb_substr($title, 0, 190),
                'description' => Request::nullable('description'),
                'url'         => Request::nullable('url'),
                'price_cents' => Request::cents('price'),
                'currency'    => Currency::normalise($currency),
                'priority'    => Request::input('priority', 'normal'),
            ]);
            Flash::success('Added to your wishlist.');
        }
        Response::redirect('/dashboard/gifts');
    }

    if ($action === 'delete_wish') {
        Db::delete('wishlist_items', 'id = ? AND couple_id = ? AND user_id = ?', [Request::input('id'), $coupleId, $user['id']]);
        Response::redirect('/dashboard/gifts');
    }
}

/* ------------------------------------------------------------------ Reading */

// Surprises meant for me are hidden from me — that is the whole point.
$gifts = Db::all(
    'SELECT g.*, p.display_name, p.full_name
       FROM gifts g LEFT JOIN profiles p ON p.id = g.to_user
      WHERE g.couple_id = ? AND NOT (g.is_surprise = 1 AND g.to_user = ? AND g.status <> "given")
      ORDER BY g.occasion_date IS NULL, g.occasion_date ASC, g.created_at DESC',
    [$coupleId, $user['id']]
);

$myWishlist = Db::all(
    'SELECT * FROM wishlist_items WHERE couple_id = ? AND user_id = ? ORDER BY created_at DESC',
    [$coupleId, $user['id']]
);

$theirWishlist = $partner
    ? Db::all(
        'SELECT * FROM wishlist_items WHERE couple_id = ? AND user_id = ? ORDER BY created_at DESC',
        [$coupleId, $partner['user_id']]
    )
    : [];

$hiddenCount = (int) Db::value(
    'SELECT COUNT(*) FROM gifts WHERE couple_id = ? AND is_surprise = 1 AND to_user = ? AND status <> "given"',
    [$coupleId, $user['id']],
    0
);

$occasions = [
    'birthday' => 'Birthday', 'anniversary' => 'Anniversary', 'christmas' => 'Christmas',
    'valentines' => "Valentine's", 'just_because' => 'Just because', 'apology' => 'Apology',
    'celebration' => 'Celebration', 'other' => 'Other',
];

View::begin('layouts/app', ['title' => 'Gifts', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Gifts &amp; wishlists</h1>
  <p>Ideas, occasions and budgets — with a surprise mode, so nobody has to hint.</p>
</div>

<?php if ($hiddenCount > 0): ?>
  <div class="alert alert-info mb-2">
    <div>
      🎁 There <?= $hiddenCount === 1 ? 'is 1 surprise' : "are {$hiddenCount} surprises" ?> planned for you.
      Hidden on purpose — you will see <?= $hiddenCount === 1 ? 'it' : 'them' ?> once marked as given.
    </div>
  </div>
<?php endif; ?>

<div class="grid grid-sidebar">
  <div class="stack">
    <div class="card">
      <div class="card-head"><h2>Gift plan</h2></div>
      <?php if ($gifts === []): ?>
        <div class="card-body empty">
          <p class="empty-emoji">🎁</p>
          <p class="bold">No gifts planned</p>
          <p>Add the next birthday or anniversary now, while you have an idea.</p>
        </div>
      <?php else: ?>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Gift</th><th>For</th><th>Occasion</th><th>Status</th><th class="right">Budget</th><th></th></tr>
            </thead>
            <tbody>
              <?php foreach ($gifts as $gift): ?>
                <tr>
                  <td>
                    <span class="bold"><?= Str::e($gift['title']) ?></span>
                    <?php if (Str::bool($gift['is_surprise'])): ?><span class="badge">🤫 surprise</span><?php endif; ?>
                    <?php if ($gift['url']): ?>
                      <a class="tiny" href="<?= Str::e($gift['url']) ?>" target="_blank" rel="noopener nofollow"
                         style="display:block">View it →</a>
                    <?php endif; ?>
                  </td>
                  <td class="small"><?= Str::e($gift['display_name'] ?: $gift['full_name'] ?: '—') ?></td>
                  <td class="small muted">
                    <?= Str::e($occasions[$gift['occasion']] ?? ucfirst($gift['occasion'])) ?>
                    <?php if ($gift['occasion_date']): ?>
                      <span class="tiny" style="display:block"><?= Str::e(Str::date($gift['occasion_date'])) ?></span>
                    <?php endif; ?>
                  </td>
                  <td>
                    <?php
                    $tone = match ($gift['status']) {
                        'given', 'received' => 'success',
                        'purchased', 'wrapped' => 'primary',
                        'planned' => 'warning',
                        default => 'outline',
                    };
                    ?>
                    <span class="badge badge-<?= $tone ?>"><?= Str::e($gift['status']) ?></span>
                  </td>
                  <td class="right tabular">
                    <?= $gift['amount_cents'] !== null ? Str::e(Currency::pretty((int) $gift['amount_cents'], $gift['currency'])) : '—' ?>
                  </td>
                  <td class="right nowrap">
                    <?php if ($gift['status'] !== 'given'): ?>
                      <form method="post" style="display:inline">
                        <?= Csrf::field() ?>
                        <input type="hidden" name="action" value="advance">
                        <input type="hidden" name="id" value="<?= Str::e($gift['id']) ?>">
                        <button class="btn btn-sm btn-ghost" type="submit">Next →</button>
                      </form>
                    <?php endif; ?>
                    <form method="post" style="display:inline" data-confirm="Delete this gift?">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="delete_gift">
                      <input type="hidden" name="id" value="<?= Str::e($gift['id']) ?>">
                      <button class="btn btn-sm btn-ghost" type="submit" aria-label="Delete">✕</button>
                    </form>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </div>

    <?php if ($theirWishlist !== []): ?>
      <div class="card">
        <div class="card-head">
          <h2><?= Str::e($partner['display_name'] ?: $partner['full_name'] ?: 'Partner') ?>&rsquo;s wishlist</h2>
        </div>
        <div class="card-body">
          <ul class="list-plain">
            <?php foreach ($theirWishlist as $item): ?>
              <li class="row-between">
                <span>
                  <span class="bold"><?= Str::e($item['title']) ?></span>
                  <?php if ($item['priority'] === 'dream'): ?><span class="badge badge-primary">dream</span><?php endif; ?>
                  <?php if ($item['description']): ?>
                    <span class="tiny muted" style="display:block"><?= Str::e($item['description']) ?></span>
                  <?php endif; ?>
                  <?php if ($item['url']): ?>
                    <a class="tiny" href="<?= Str::e($item['url']) ?>" target="_blank" rel="noopener nofollow">Link →</a>
                  <?php endif; ?>
                </span>
                <span class="small tabular nowrap">
                  <?= $item['price_cents'] !== null ? Str::e(Currency::pretty((int) $item['price_cents'], $item['currency'])) : '' ?>
                </span>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <aside class="stack">
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="save_gift">

      <div class="card-head"><h2>Plan a gift</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="title">What is it? <span class="required">*</span></label>
          <input class="input" id="title" name="title" required maxlength="190">
        </div>

        <div class="field">
          <label for="to_user">For</label>
          <select class="select" id="to_user" name="to_user">
            <?php foreach ($context['members'] as $member): ?>
              <option value="<?= Str::e($member['user_id']) ?>"
                      <?= ($partner && $member['user_id'] === $partner['user_id']) ? 'selected' : '' ?>>
                <?= Str::e($member['user_id'] === $user['id'] ? 'Me' : ($member['display_name'] ?: $member['full_name'] ?: 'Partner')) ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="occasion">Occasion</label>
            <select class="select" id="occasion" name="occasion"><?= View::options($occasions, 'birthday') ?></select>
          </div>
          <div class="field">
            <label for="occasion_date">Date</label>
            <input class="input" type="date" id="occasion_date" name="occasion_date">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="amount">Budget</label>
            <input class="input" type="number" step="0.01" min="0" id="amount" name="amount">
          </div>
          <div class="field">
            <label for="status">Status</label>
            <select class="select" id="status" name="status">
              <?= View::options(['idea' => 'Idea', 'planned' => 'Planned', 'purchased' => 'Purchased',
                                 'wrapped' => 'Wrapped', 'given' => 'Given'], 'idea') ?>
            </select>
          </div>
        </div>

        <div class="field">
          <label for="url">Link</label>
          <input class="input" type="url" id="url" name="url" placeholder="https://">
        </div>

        <label class="checkbox mt-2">
          <input type="checkbox" name="is_surprise" value="1" checked>
          <span class="small muted">Surprise — hide this from them until it is given.</span>
        </label>

        <button class="btn btn-block mt-3" type="submit">Save gift</button>
      </div>
    </form>

    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="save_wish">

      <div class="card-head"><h2>Your wishlist</h2></div>
      <div class="card-body">
        <p class="small muted">Tell them what you actually want. Hinting is not a system.</p>

        <div class="field mt-2">
          <label for="wish_title">Item</label>
          <input class="input" id="wish_title" name="title" maxlength="190" required>
        </div>
        <div class="field">
          <label for="wish_price">Roughly</label>
          <input class="input" type="number" step="0.01" min="0" id="wish_price" name="price">
        </div>
        <div class="field">
          <label for="wish_url">Link</label>
          <input class="input" type="url" id="wish_url" name="url" placeholder="https://">
        </div>
        <div class="field">
          <label for="priority">How much do you want it?</label>
          <select class="select" id="priority" name="priority">
            <?= View::options(['low' => 'Would be nice', 'normal' => 'Want it', 'high' => 'Really want it', 'dream' => 'Dream item'], 'normal') ?>
          </select>
        </div>

        <button class="btn btn-outline btn-block mt-2" type="submit">Add to my wishlist</button>

        <?php if ($myWishlist !== []): ?>
          <ul class="list-plain small mt-3">
            <?php foreach ($myWishlist as $item): ?>
              <li class="row-between">
                <span><?= Str::e($item['title']) ?></span>
                <form method="post">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="delete_wish">
                  <input type="hidden" name="id" value="<?= Str::e($item['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit" aria-label="Remove">✕</button>
                </form>
              </li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>
      </div>
    </form>
  </aside>
</div>

<?php View::end(); ?>
