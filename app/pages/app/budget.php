<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$currency = $context['couple']['currency'];
$members  = $context['members'];

/** Splits an amount between members according to the rule chosen. */
function fc_shares(int $amountCents, string $splitType, array $members, string $payerId): array
{
    if ($splitType === 'none') {
        return array_map(
            static fn ($m) => ['user_id' => $m['user_id'], 'share_cents' => $m['user_id'] === $payerId ? $amountCents : 0],
            $members
        );
    }

    if ($splitType === 'income' || $splitType === 'percent') {
        $total = 0.0;
        foreach ($members as $member) {
            $total += (float) ($member['income_share'] ?? 50);
        }
        $total = $total > 0 ? $total : 100.0;

        $allocated = 0;
        $shares = [];
        $last = count($members) - 1;

        foreach (array_values($members) as $index => $member) {
            $share = $index === $last
                ? $amountCents - $allocated
                : (int) round($amountCents * ((float) ($member['income_share'] ?? 50)) / $total);
            $allocated += $share;
            $shares[] = ['user_id' => $member['user_id'], 'share_cents' => $share];
        }
        return $shares;
    }

    // Equal, with the remainder going to the first member.
    $count = max(1, count($members));
    $per = intdiv($amountCents, $count);
    $shares = [];
    foreach (array_values($members) as $index => $member) {
        $shares[] = [
            'user_id'     => $member['user_id'],
            'share_cents' => $index === 0 ? $amountCents - ($per * ($count - 1)) : $per,
        ];
    }
    return $shares;
}

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'save_budget') {
        $name = Request::input('name');
        if ($name === '') {
            Flash::error('Name your budget.');
            Response::redirect('/dashboard/budget');
        }

        $id = Request::input('budget_id');

        if ($id === '') {
            $limitError = Plans::check('budgets', 'budgets', 'archived_at IS NULL');
            if ($limitError !== null) {
                Flash::error($limitError);
                Response::redirect('/dashboard/budget');
            }
        }

        $data = [
            'name'         => mb_substr($name, 0, 150),
            'budget_type'  => Request::input('budget_type', 'household'),
            'currency'     => Currency::normalise(Request::input('currency', $currency)),
            'total_cents'  => Request::cents('total') ?? 0,
            'period_start' => Request::date('period_start'),
            'period_end'   => Request::date('period_end'),
            'split_type'   => Request::input('split_type', 'equal'),
            'trip_id'      => Request::nullable('trip_id'),
            'notes'        => Request::nullable('notes'),
        ];

        if ($id !== '' && Auth::ownsRow('budgets', $id)) {
            Db::update('budgets', $id, $data);
        } else {
            Db::insert('budgets', $data + ['couple_id' => $coupleId, 'created_by' => $user['id']]);
        }

        Flash::success('Budget saved.');
        Response::redirect('/dashboard/budget');
    }

    if ($action === 'delete_budget') {
        Db::delete('budgets', 'id = ? AND couple_id = ?', [Request::input('id'), $coupleId]);
        Flash::success('Budget deleted.');
        Response::redirect('/dashboard/budget');
    }

    if ($action === 'save_expense') {
        $amount = Request::cents('amount');
        $title = Request::input('title');

        if (!$amount || $amount <= 0 || $title === '') {
            Flash::error('Describe the expense and enter an amount above zero.');
            Response::redirect('/dashboard/budget');
        }

        $splitType = Request::input('split_type', 'equal');
        $payerId = Request::input('paid_by', $user['id']);

        // The payer has to be a live member of this space.
        $validPayer = false;
        foreach ($members as $member) {
            if ($member['user_id'] === $payerId) { $validPayer = true; break; }
        }
        if (!$validPayer) {
            $payerId = $user['id'];
        }

        $expenseId = Db::insert('expenses', [
            'couple_id'    => $coupleId,
            'budget_id'    => Request::nullable('budget_id'),
            'trip_id'      => Request::nullable('trip_id'),
            'paid_by'      => $payerId,
            'title'        => mb_substr($title, 0, 190),
            'description'  => Request::nullable('description'),
            'category'     => Request::input('category', 'other'),
            'amount_cents' => $amount,
            'currency'     => Currency::normalise(Request::input('currency', $currency)),
            'spent_on'     => Request::date('spent_on') ?? Str::today(),
            'split_type'   => $splitType,
            'created_by'   => $user['id'],
        ]);

        if ($expenseId !== null) {
            foreach (fc_shares($amount, $splitType, $members, $payerId) as $share) {
                Db::insert('expense_shares', [
                    'expense_id'  => $expenseId,
                    'user_id'     => $share['user_id'],
                    'share_cents' => $share['share_cents'],
                ]);
            }
        }

        Flash::success('Expense saved and split.');
        Response::redirect('/dashboard/budget');
    }

    if ($action === 'delete_expense') {
        Db::delete('expenses', 'id = ? AND couple_id = ?', [Request::input('id'), $coupleId]);
        Response::redirect('/dashboard/budget');
    }

    if ($action === 'save_income') {
        $existing = Db::one('SELECT id FROM incomes WHERE couple_id = ? AND user_id = ? LIMIT 1', [$coupleId, $user['id']]);

        $data = [
            'label'        => Request::input('label', 'Primary income') ?: 'Primary income',
            'amount_cents' => Request::cents('amount') ?? 0,
            'currency'     => Currency::normalise(Request::input('currency', $currency)),
            'frequency'    => Request::input('frequency', 'month'),
            'is_private'   => Request::bool('is_private'),
        ];

        if ($existing) {
            Db::update('incomes', $existing['id'], $data);
        } else {
            Db::insert('incomes', $data + ['couple_id' => $coupleId, 'user_id' => $user['id']]);
        }

        // Recalculate the proportional split for the whole space.
        $incomes = Db::all('SELECT user_id, amount_cents, frequency FROM incomes WHERE couple_id = ?', [$coupleId]);

        $monthly = static fn (array $row): float => match ($row['frequency']) {
            'year' => ((float) $row['amount_cents']) / 12,
            'week' => ((float) $row['amount_cents']) * 52 / 12,
            default => (float) $row['amount_cents'],
        };

        $total = 0.0;
        foreach ($incomes as $row) {
            $total += $monthly($row);
        }

        if ($total > 0) {
            foreach ($incomes as $row) {
                Db::run(
                    'UPDATE couple_members SET income_share = ? WHERE couple_id = ? AND user_id = ?',
                    [round(($monthly($row) / $total) * 100, 2), $coupleId, $row['user_id']]
                );
            }
        }

        Flash::success('Income saved. The proportional split has been recalculated.');
        Response::redirect('/dashboard/budget');
    }

    if ($action === 'settle') {
        $toUser = Request::input('to_user');
        if ($toUser === '') {
            Flash::error('Choose who is being paid.');
            Response::redirect('/dashboard/budget');
        }

        Db::insert('settlements', [
            'couple_id'    => $coupleId,
            'from_user'    => $user['id'],
            'to_user'      => $toUser,
            'amount_cents' => Request::cents('amount') ?? 0,
            'currency'     => Currency::normalise($currency),
            'method'       => Request::nullable('method'),
            'note'         => Request::nullable('note'),
            'settled_on'   => Str::today(),
        ]);

        Db::run('UPDATE expenses SET is_settled = 1 WHERE couple_id = ? AND is_settled = 0', [$coupleId]);
        Db::run(
            'UPDATE expense_shares s JOIN expenses e ON e.id = s.expense_id
                SET s.is_settled = 1, s.settled_at = UTC_TIMESTAMP()
              WHERE e.couple_id = ? AND s.is_settled = 0',
            [$coupleId]
        );

        Flash::success('Settled up. The balance is back to zero.');
        Response::redirect('/dashboard/budget');
    }
}

/* ------------------------------------------------------------------ Reading */

$budgets = Db::all('SELECT * FROM budgets WHERE couple_id = ? AND archived_at IS NULL ORDER BY created_at DESC', [$coupleId]);

$expenses = Db::all(
    'SELECT e.*, p.display_name, p.full_name, b.name AS budget_name
       FROM expenses e
       LEFT JOIN profiles p ON p.id = e.paid_by
       LEFT JOIN budgets b ON b.id = e.budget_id
      WHERE e.couple_id = ?
      ORDER BY e.spent_on DESC, e.created_at DESC
      LIMIT 100',
    [$coupleId]
);

$myIncome = Db::one('SELECT * FROM incomes WHERE couple_id = ? AND user_id = ? LIMIT 1', [$coupleId, $user['id']]);
$trips = Db::all('SELECT id, title FROM trips WHERE couple_id = ? AND status <> "cancelled" ORDER BY start_date DESC', [$coupleId]);

// Who owes whom, across unsettled expenses.
$balances = [];
foreach ($members as $member) {
    $paid = (int) Db::value(
        'SELECT COALESCE(SUM(amount_cents),0) FROM expenses WHERE couple_id = ? AND paid_by = ? AND is_settled = 0',
        [$coupleId, $member['user_id']],
        0
    );
    $owed = (int) Db::value(
        'SELECT COALESCE(SUM(s.share_cents),0) FROM expense_shares s
           JOIN expenses e ON e.id = s.expense_id
          WHERE e.couple_id = ? AND s.user_id = ? AND e.is_settled = 0',
        [$coupleId, $member['user_id']],
        0
    );

    $balances[] = [
        'member' => $member,
        'paid'   => $paid,
        'owed'   => $owed,
        'net'    => $paid - $owed,
    ];
}

$monthTotal = (int) Db::value(
    'SELECT COALESCE(SUM(amount_cents),0) FROM expenses WHERE couple_id = ? AND spent_on >= ?',
    [$coupleId, date('Y-m-01')],
    0
);

$byCategory = Db::all(
    'SELECT category, SUM(amount_cents) AS total FROM expenses
      WHERE couple_id = ? AND spent_on >= ?
      GROUP BY category ORDER BY total DESC LIMIT 8',
    [$coupleId, date('Y-m-01')]
);

View::begin('layouts/app', ['title' => 'Money & budget', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Money &amp; budget</h1>
  <p>Split equally, or by income. Fair does not always mean identical — and either way, it should be written down.</p>
</div>

<div class="grid grid-3">
  <div class="card stat">
    <p class="stat-label">Spent this month</p>
    <p class="stat-value tabular"><?= Str::e(Currency::pretty($monthTotal, $currency)) ?></p>
  </div>

  <?php foreach ($balances as $balance): ?>
    <div class="card stat">
      <p class="stat-label">
        <?= Str::e($balance['member']['user_id'] === $user['id'] ? 'You' : ($balance['member']['display_name'] ?: 'Partner')) ?>
      </p>
      <p class="stat-value tabular <?= $balance['net'] >= 0 ? 'tone-success' : 'tone-warning' ?>">
        <?= $balance['net'] >= 0 ? '+' : '−' ?><?= Str::e(Currency::pretty(abs($balance['net']), $currency)) ?>
      </p>
      <p class="stat-hint">
        paid <?= Str::e(Currency::pretty($balance['paid'], $currency)) ?> ·
        owes <?= Str::e(Currency::pretty($balance['owed'], $currency)) ?>
        <?php if ($balance['member']['income_share'] !== null): ?>
          · <?= number_format((float) $balance['member']['income_share'], 0) ?>% share
        <?php endif; ?>
      </p>
    </div>
  <?php endforeach; ?>
</div>

<div class="grid grid-sidebar mt-3">
  <div class="stack">
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="save_expense">

      <div class="card-head"><h2>Add an expense</h2></div>
      <div class="card-body">
        <div class="field-row">
          <div class="field">
            <label for="title">What was it? <span class="required">*</span></label>
            <input class="input" id="title" name="title" required maxlength="190" placeholder="Dinner at Osteria">
          </div>
          <div class="field">
            <label for="amount">Amount <span class="required">*</span></label>
            <input class="input" type="number" step="0.01" min="0.01" id="amount" name="amount" required>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="paid_by">Who paid?</label>
            <select class="select" id="paid_by" name="paid_by">
              <?php foreach ($members as $member): ?>
                <option value="<?= Str::e($member['user_id']) ?>" <?= $member['user_id'] === $user['id'] ? 'selected' : '' ?>>
                  <?= Str::e($member['user_id'] === $user['id'] ? 'You' : ($member['display_name'] ?: $member['full_name'] ?: 'Partner')) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="field">
            <label for="split_type">How to split it</label>
            <select class="select" id="split_type" name="split_type">
              <option value="equal">Equally</option>
              <option value="income">By income share</option>
              <option value="none">Not shared — payer only</option>
            </select>
          </div>

          <div class="field">
            <label for="category">Category</label>
            <select class="select" id="category" name="category">
              <?php foreach (['food' => 'Food & drink', 'home' => 'Home', 'travel' => 'Travel', 'transport' => 'Transport',
                              'gifts' => 'Gifts', 'health' => 'Health', 'fun' => 'Going out', 'bills' => 'Bills',
                              'other' => 'Other'] as $value => $label): ?>
                <option value="<?= $value ?>"><?= $label ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="spent_on">Date</label>
            <input class="input" type="date" id="spent_on" name="spent_on" value="<?= Str::e(Str::today()) ?>">
          </div>
          <?php if ($budgets !== []): ?>
            <div class="field">
              <label for="budget_id">Budget</label>
              <select class="select" id="budget_id" name="budget_id">
                <option value="">None</option>
                <?php foreach ($budgets as $budget): ?>
                  <option value="<?= Str::e($budget['id']) ?>"><?= Str::e($budget['name']) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
          <?php endif; ?>
          <?php if ($trips !== []): ?>
            <div class="field">
              <label for="expense_trip">Trip</label>
              <select class="select" id="expense_trip" name="trip_id">
                <option value="">None</option>
                <?php foreach ($trips as $trip): ?>
                  <option value="<?= Str::e($trip['id']) ?>"><?= Str::e($trip['title']) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
          <?php endif; ?>
        </div>

        <button class="btn mt-2" type="submit">Add expense</button>
      </div>
    </form>

    <div class="card">
      <div class="card-head"><h2>Recent expenses</h2></div>
      <?php if ($expenses === []): ?>
        <div class="card-body empty">
          <p class="empty-emoji">🧾</p>
          <p class="bold">Nothing logged yet</p>
          <p>Add the next thing either of you pays for and the balance starts working.</p>
        </div>
      <?php else: ?>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>What</th><th>Who paid</th><th>Split</th><th>Date</th><th class="right">Amount</th><th></th></tr>
            </thead>
            <tbody>
              <?php foreach ($expenses as $expense): ?>
                <tr>
                  <td>
                    <span class="bold"><?= Str::e($expense['title']) ?></span>
                    <span class="tiny muted" style="display:block">
                      <?= Str::e(ucfirst($expense['category'])) ?>
                      <?php if ($expense['budget_name']): ?> · <?= Str::e($expense['budget_name']) ?><?php endif; ?>
                      <?php if (Str::bool($expense['is_settled'])): ?> · settled<?php endif; ?>
                    </span>
                  </td>
                  <td class="small"><?= Str::e($expense['paid_by'] === $user['id'] ? 'You' : ($expense['display_name'] ?: 'Partner')) ?></td>
                  <td class="small muted"><?= Str::e(ucfirst($expense['split_type'])) ?></td>
                  <td class="small muted nowrap"><?= Str::e(Str::date($expense['spent_on'])) ?></td>
                  <td class="right tabular bold"><?= Str::e(Currency::pretty((int) $expense['amount_cents'], $expense['currency'])) ?></td>
                  <td class="right">
                    <form method="post" data-confirm="Delete this expense?">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="delete_expense">
                      <input type="hidden" name="id" value="<?= Str::e($expense['id']) ?>">
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

    <?php if ($budgets !== []): ?>
      <div class="card">
        <div class="card-head"><h2>Budgets</h2></div>
        <div class="card-body stack">
          <?php foreach ($budgets as $budget): ?>
            <?php
            $spent = (int) Db::value(
                'SELECT COALESCE(SUM(amount_cents),0) FROM expenses WHERE budget_id = ?',
                [$budget['id']],
                0
            );
            $percent = (int) $budget['total_cents'] > 0 ? ($spent / (int) $budget['total_cents']) * 100 : 0;
            ?>
            <div>
              <div class="row-between">
                <span class="bold"><?= Str::e($budget['name']) ?>
                  <span class="badge"><?= Str::e($budget['budget_type']) ?></span>
                </span>
                <span class="small tabular">
                  <?= Str::e(Currency::pretty($spent, $budget['currency'])) ?>
                  / <?= Str::e(Currency::pretty((int) $budget['total_cents'], $budget['currency'])) ?>
                </span>
              </div>
              <?= View::meter($percent, 100, $percent > 100 ? 'danger' : ($percent > 80 ? 'warning' : 'success')) ?>
              <div class="row-between tiny muted mt-1">
                <span>
                  <?= Str::e(ucfirst($budget['split_type'])) ?> split
                  <?php if ($budget['period_end']): ?> · until <?= Str::e(Str::date($budget['period_end'])) ?><?php endif; ?>
                </span>
                <form method="post" data-confirm="Delete this budget?">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="delete_budget">
                  <input type="hidden" name="id" value="<?= Str::e($budget['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit">Delete</button>
                </form>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <aside class="stack">
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="save_income">

      <div class="card-head"><h2>Your income</h2></div>
      <div class="card-body">
        <p class="small muted">
          Enter what you each earn and the &ldquo;by income&rdquo; split adjusts itself.
          Your partner never sees the number — only the resulting percentage.
        </p>

        <div class="field mt-2">
          <label for="income_amount">Amount</label>
          <input class="input" type="number" step="0.01" min="0" id="income_amount" name="amount"
                 value="<?= $myIncome ? number_format(((int) $myIncome['amount_cents']) / 100, 2, '.', '') : '' ?>">
        </div>

        <div class="field">
          <label for="frequency">Per</label>
          <select class="select" id="frequency" name="frequency">
            <?php foreach (['month' => 'Month', 'week' => 'Week', 'year' => 'Year'] as $value => $label): ?>
              <option value="<?= $value ?>" <?= ($myIncome['frequency'] ?? 'month') === $value ? 'selected' : '' ?>>
                <?= $label ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <button class="btn btn-block mt-2" type="submit">Save income</button>
      </div>
    </form>

    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="settle">

      <div class="card-head"><h2>Settle up</h2></div>
      <div class="card-body">
        <p class="small muted">Records the payment and clears every unsettled expense.</p>

        <div class="field mt-2">
          <label for="to_user">Paying</label>
          <select class="select" id="to_user" name="to_user" required>
            <option value="">Choose…</option>
            <?php foreach ($members as $member): ?>
              <?php if ($member['user_id'] === $user['id']) { continue; } ?>
              <option value="<?= Str::e($member['user_id']) ?>">
                <?= Str::e($member['display_name'] ?: $member['full_name'] ?: 'Partner') ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="field">
          <label for="settle_amount">Amount</label>
          <input class="input" type="number" step="0.01" min="0" id="settle_amount" name="amount">
        </div>

        <div class="field">
          <label for="method">How</label>
          <input class="input" id="method" name="method" maxlength="60" placeholder="Bank transfer">
        </div>

        <button class="btn btn-outline btn-block mt-2" type="submit">Mark as settled</button>
      </div>
    </form>

    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="save_budget">

      <div class="card-head"><h2>New budget</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="budget_name">Name</label>
          <input class="input" id="budget_name" name="name" maxlength="150" placeholder="Italy honeymoon">
        </div>
        <div class="field">
          <label for="budget_type">Type</label>
          <select class="select" id="budget_type" name="budget_type">
            <option value="household">Household</option>
            <option value="trip">Trip</option>
            <option value="event">Event</option>
            <option value="gift">Gifts</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="field">
          <label for="total">Total</label>
          <input class="input" type="number" step="0.01" min="0" id="total" name="total">
        </div>
        <div class="field">
          <label for="budget_split">Split</label>
          <select class="select" id="budget_split" name="split_type">
            <option value="equal">Equally</option>
            <option value="income">By income</option>
          </select>
        </div>
        <button class="btn btn-outline btn-block mt-2" type="submit">Create budget</button>
      </div>
    </form>

    <?php if ($byCategory !== []): ?>
      <div class="card">
        <div class="card-body">
          <h2 style="font-size:1rem">This month by category</h2>
          <ul class="list-plain small mt-2">
            <?php foreach ($byCategory as $row): ?>
              <li class="row-between">
                <span><?= Str::e(ucfirst($row['category'])) ?></span>
                <span class="tabular bold"><?= Str::e(Currency::pretty((int) $row['total'], $currency)) ?></span>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      </div>
    <?php endif; ?>
  </aside>
</div>

<?php View::end(); ?>
