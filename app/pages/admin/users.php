<?php
declare(strict_types=1);

$me = Auth::requireAdmin();

if (Request::isPost()) {
    $action = Request::input('action');
    $userId = Request::input('user_id');

    $target = Db::one('SELECT id, email, role FROM profiles WHERE id = ? LIMIT 1', [$userId]);
    if (!$target) {
        Flash::error('That account no longer exists.');
        Response::redirect('/admin/users');
    }

    // Only a superadmin may touch another superadmin.
    if ($target['role'] === 'superadmin' && !Auth::isSuperAdmin()) {
        Flash::error('Only a superadmin can change a superadmin.');
        Response::redirect('/admin/users');
    }

    if ($action === 'update') {
        $role = Request::input('role', 'user');
        $status = Request::input('status', 'active');

        if ($role === 'superadmin' && !Auth::isSuperAdmin()) {
            Flash::error('Only a superadmin can grant superadmin.');
            Response::redirect('/admin/users');
        }
        if ($userId === $me['id'] && $role !== $me['role']) {
            Flash::error('You cannot change your own role.');
            Response::redirect('/admin/users');
        }

        Db::update('profiles', $userId, [
            'role'             => $role,
            'status'           => $status,
            'suspended_reason' => Request::nullable('suspended_reason'),
        ]);

        // A suspended or banned account loses every session immediately.
        if (in_array($status, ['suspended', 'banned'], true)) {
            Db::delete('sessions', 'user_id = ?', [$userId]);
        }

        Audit::record('admin.user.update', 'profile', $userId, "Set role={$role}, status={$status}");
        Flash::success('User updated.');
        Response::redirect('/admin/users');
    }

    if ($action === 'delete') {
        if ($userId === $me['id']) {
            Flash::error('You cannot delete your own account here.');
            Response::redirect('/admin/users');
        }

        // `users` cascades into profiles and every couple-scoped table.
        $deleted = Db::delete('users', 'id = ?', [$userId]);
        if (!$deleted) {
            Db::run(
                'UPDATE profiles SET status = "pending_deletion", deleted_at = UTC_TIMESTAMP() WHERE id = ?',
                [$userId]
            );
        }

        Audit::record('admin.user.delete', 'profile', $userId, 'Deleted ' . $target['email']);
        Flash::success('User deleted.');
        Response::redirect('/admin/users');
    }

    if ($action === 'reset_link') {
        $token = Str::token();
        Db::delete('auth_tokens', 'user_id = ? AND kind = "reset"', [$userId]);
        Db::insert('auth_tokens', [
            'user_id'    => $userId,
            'kind'       => 'reset',
            'token_hash' => Str::hashToken($token),
            'expires_at' => Str::inHours(1),
        ]);

        Audit::record('admin.user.reset_link', 'profile', $userId, 'Generated a one-hour reset link for ' . $target['email']);

        Flash::success('One-time reset link (valid for one hour): ' . Config::siteUrl('/reset-password?token=' . $token));
        Response::redirect('/admin/users');
    }

    if ($action === 'set_password') {
        $password = Request::raw('new_password');
        $problem = Auth::passwordProblem($password);

        if ($problem !== null) {
            Flash::error($problem);
            Response::redirect('/admin/users');
        }

        Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [
            password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            $userId,
        ]);
        Db::delete('sessions', 'user_id = ?', [$userId]);

        Audit::record('admin.user.password_set', 'profile', $userId, 'Reset the password for ' . $target['email']);
        Flash::success('Password set. Every session for that account was signed out.');
        Response::redirect('/admin/users');
    }

    if ($action === 'grant_plan') {
        $planId = Request::input('plan_id');
        $months = max(1, min(120, Request::int('months', 12)));

        if ($planId === '') {
            Flash::error('Pick a plan.');
            Response::redirect('/admin/users');
        }

        $membership = Db::one(
            'SELECT couple_id FROM couple_members WHERE user_id = ? AND removed_at IS NULL LIMIT 1',
            [$userId]
        );

        Payments::saveSubscription([
            'user_id'                  => $userId,
            'couple_id'                => $membership['couple_id'] ?? null,
            'plan_id'                  => $planId,
            'provider'                 => 'manual',
            'provider_subscription_id' => 'manual-' . $userId . '-' . time(),
            'status'                   => 'active',
            'currency'                 => 'USD',
            'billing_interval'         => 'month',
            'amount_cents'             => 0,
            'current_period_start'     => Str::now(),
            'current_period_end'       => date('Y-m-d H:i:s', strtotime("+{$months} months")),
        ]);

        Audit::record('admin.plan.grant', 'subscription', $userId, "Granted a plan for {$months} months");
        Flash::success("Plan granted for {$months} months.");
        Response::redirect('/admin/users');
    }
}

/* ------------------------------------------------------------------ Listing */

$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 25;
$search = trim((string) ($_GET['q'] ?? ''));
$roleFilter = trim((string) ($_GET['role'] ?? ''));
$statusFilter = trim((string) ($_GET['status'] ?? ''));

$where = ['1'];
$params = [];

if ($search !== '') {
    $where[] = '(email LIKE ? OR full_name LIKE ?)';
    $params[] = '%' . $search . '%';
    $params[] = '%' . $search . '%';
}
if ($roleFilter !== '') {
    $where[] = 'role = ?';
    $params[] = $roleFilter;
}
if ($statusFilter !== '') {
    $where[] = 'status = ?';
    $params[] = $statusFilter;
}

$clause = implode(' AND ', $where);
$total = Db::count('profiles', $clause, $params);
$offset = ($page - 1) * $perPage;

$users = Db::all(
    "SELECT * FROM profiles WHERE {$clause} ORDER BY created_at DESC LIMIT {$perPage} OFFSET {$offset}",
    $params
);

$planByUser = [];
if ($users !== []) {
    $ids = array_column($users, 'id');
    $rows = Db::all(
        'SELECT s.user_id, p.name FROM subscriptions s
           LEFT JOIN plans p ON p.id = s.plan_id
          WHERE s.status IN ("active","trialing") AND s.user_id IN (' . Db::placeholders($ids) . ')',
        $ids
    );
    foreach ($rows as $row) {
        $planByUser[$row['user_id']] = $row['name'] ?: 'Paid';
    }
}

$plans = Db::all('SELECT id, name FROM plans WHERE is_active = 1 ORDER BY sort_order ASC');

View::begin('layouts/admin', ['title' => 'Users', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Users</h1>
  <p><?= number_format($total) ?> accounts. Change roles, suspend, grant plans, reset passwords or delete.</p>
</div>

<form method="get" class="toolbar">
  <div class="field" style="flex:1 1 16rem">
    <label class="sr-only" for="q">Search</label>
    <input class="input" type="search" id="q" name="q" value="<?= Str::e($search) ?>" placeholder="Search name or email…">
  </div>
  <div class="field">
    <label class="sr-only" for="role">Role</label>
    <select class="select" id="role" name="role">
      <option value="">All roles</option>
      <?php foreach (['user', 'moderator', 'admin', 'superadmin'] as $role): ?>
        <option value="<?= $role ?>" <?= $roleFilter === $role ? 'selected' : '' ?>><?= ucfirst($role) ?></option>
      <?php endforeach; ?>
    </select>
  </div>
  <div class="field">
    <label class="sr-only" for="status">Status</label>
    <select class="select" id="status" name="status">
      <option value="">All statuses</option>
      <?php foreach (['active', 'suspended', 'banned', 'pending_deletion'] as $status): ?>
        <option value="<?= $status ?>" <?= $statusFilter === $status ? 'selected' : '' ?>>
          <?= ucfirst(str_replace('_', ' ', $status)) ?>
        </option>
      <?php endforeach; ?>
    </select>
  </div>
  <button class="btn" type="submit">Filter</button>
  <?php if ($search !== '' || $roleFilter !== '' || $statusFilter !== ''): ?>
    <a class="btn btn-ghost" href="/admin/users">Clear</a>
  <?php endif; ?>
</form>

<div class="card">
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>User</th><th>Role</th><th>Status</th><th>Plan</th><th>Joined</th><th>Manage</th></tr>
      </thead>
      <tbody>
        <?php foreach ($users as $row): ?>
          <tr>
            <td>
              <span class="bold"><?= Str::e($row['full_name'] ?: '—') ?></span>
              <span class="tiny muted" style="display:block"><?= Str::e($row['email']) ?></span>
              <span class="tiny muted"><?= Str::e($row['country_code'] ?: '') ?> <?= Str::e($row['currency']) ?></span>
            </td>
            <td><span class="badge badge-<?= $row['role'] === 'user' ? 'outline' : 'primary' ?>"><?= Str::e($row['role']) ?></span></td>
            <td>
              <span class="badge badge-<?= $row['status'] === 'active' ? 'success' : 'danger' ?>">
                <?= Str::e($row['status']) ?>
              </span>
            </td>
            <td class="small"><?= Str::e($planByUser[$row['id']] ?? 'Free') ?></td>
            <td class="small muted nowrap"><?= Str::e(Str::date($row['created_at'])) ?></td>
            <td>
              <details>
                <summary class="small" style="cursor:pointer;color:hsl(var(--primary))">Manage</summary>
                <div class="card card-flat mt-2" style="width:min(22rem,80vw)">
                  <div class="card-body">
                    <form method="post">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="update">
                      <input type="hidden" name="user_id" value="<?= Str::e($row['id']) ?>">

                      <div class="field">
                        <label for="role-<?= Str::e($row['id']) ?>">Role</label>
                        <select class="select" id="role-<?= Str::e($row['id']) ?>" name="role">
                          <?php foreach (['user', 'moderator', 'admin', 'superadmin'] as $role): ?>
                            <?php if ($role === 'superadmin' && !Auth::isSuperAdmin()) { continue; } ?>
                            <option value="<?= $role ?>" <?= $row['role'] === $role ? 'selected' : '' ?>><?= ucfirst($role) ?></option>
                          <?php endforeach; ?>
                        </select>
                      </div>

                      <div class="field">
                        <label for="status-<?= Str::e($row['id']) ?>">Status</label>
                        <select class="select" id="status-<?= Str::e($row['id']) ?>" name="status">
                          <?php foreach (['active', 'suspended', 'banned', 'pending_deletion'] as $status): ?>
                            <option value="<?= $status ?>" <?= $row['status'] === $status ? 'selected' : '' ?>>
                              <?= ucfirst(str_replace('_', ' ', $status)) ?>
                            </option>
                          <?php endforeach; ?>
                        </select>
                      </div>

                      <div class="field">
                        <label for="reason-<?= Str::e($row['id']) ?>">Reason (if suspended)</label>
                        <input class="input" id="reason-<?= Str::e($row['id']) ?>" name="suspended_reason"
                               value="<?= Str::e($row['suspended_reason'] ?? '') ?>">
                      </div>

                      <button class="btn btn-sm btn-block" type="submit">Save</button>
                    </form>

                    <hr class="divider">

                    <form method="post" class="mt-2">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="grant_plan">
                      <input type="hidden" name="user_id" value="<?= Str::e($row['id']) ?>">
                      <div class="field-row">
                        <div class="field">
                          <label class="sr-only" for="plan-<?= Str::e($row['id']) ?>">Plan</label>
                          <select class="select" id="plan-<?= Str::e($row['id']) ?>" name="plan_id">
                            <?php foreach ($plans as $plan): ?>
                              <option value="<?= Str::e($plan['id']) ?>"><?= Str::e($plan['name']) ?></option>
                            <?php endforeach; ?>
                          </select>
                        </div>
                        <div class="field">
                          <label class="sr-only" for="months-<?= Str::e($row['id']) ?>">Months</label>
                          <input class="input" type="number" min="1" max="120" id="months-<?= Str::e($row['id']) ?>"
                                 name="months" value="12">
                        </div>
                      </div>
                      <button class="btn btn-sm btn-outline btn-block mt-2" type="submit">Grant plan</button>
                    </form>

                    <form method="post" class="mt-2">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="set_password">
                      <input type="hidden" name="user_id" value="<?= Str::e($row['id']) ?>">
                      <div class="field">
                        <label class="sr-only" for="pw-<?= Str::e($row['id']) ?>">New password</label>
                        <input class="input" type="text" id="pw-<?= Str::e($row['id']) ?>" name="new_password"
                               placeholder="New password" autocomplete="off">
                      </div>
                      <button class="btn btn-sm btn-outline btn-block" type="submit">Set password</button>
                    </form>

                    <form method="post" class="mt-2">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="reset_link">
                      <input type="hidden" name="user_id" value="<?= Str::e($row['id']) ?>">
                      <button class="btn btn-sm btn-ghost btn-block" type="submit">Generate a reset link</button>
                    </form>

                    <form method="post" class="mt-2"
                          data-confirm="Delete this account and everything in it? This cannot be undone.">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="delete">
                      <input type="hidden" name="user_id" value="<?= Str::e($row['id']) ?>">
                      <button class="btn btn-sm btn-danger btn-block" type="submit">Delete account</button>
                    </form>
                  </div>
                </div>
              </details>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php $pages = (int) ceil($total / $perPage); ?>
<?php if ($pages > 1): ?>
  <nav class="pagination" aria-label="Pagination">
    <?php
    $query = static function (int $target) use ($search, $roleFilter, $statusFilter): string {
        $parts = ['page=' . $target];
        if ($search !== '') { $parts[] = 'q=' . urlencode($search); }
        if ($roleFilter !== '') { $parts[] = 'role=' . urlencode($roleFilter); }
        if ($statusFilter !== '') { $parts[] = 'status=' . urlencode($statusFilter); }
        return '/admin/users?' . implode('&amp;', $parts);
    };
    ?>
    <?php if ($page > 1): ?><a href="<?= $query($page - 1) ?>">← Previous</a><?php else: ?><span></span><?php endif; ?>
    <span class="muted">Page <?= $page ?> of <?= $pages ?></span>
    <?php if ($page < $pages): ?><a href="<?= $query($page + 1) ?>">Next →</a><?php else: ?><span></span><?php endif; ?>
  </nav>
<?php endif; ?>

<?php View::end(); ?>
