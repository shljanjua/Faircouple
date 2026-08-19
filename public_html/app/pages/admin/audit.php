<?php
declare(strict_types=1);

Auth::requireAdmin();

/*
 * The audit trail. Every admin action that changes data writes a row here, so
 * "who removed that partner?" always has an answer.
 */

if (Request::isPost() && Request::input('action') === 'prune') {
    // MySQL will not bind a placeholder inside INTERVAL, so the window is
    // clamped to an integer and inlined — there is no string to inject into.
    $days = (int) Str::clamp((float) Request::int('days', 180), 30, 3650);

    Db::run("DELETE FROM audit_logs WHERE created_at < (UTC_TIMESTAMP() - INTERVAL {$days} DAY)");
    Audit::record('admin.audit.prune', 'audit_log', null, 'Pruned audit entries older than ' . $days . ' days');

    Flash::success('Older entries removed.');
    Response::redirect('/admin/audit');
}

$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 50;
$offset = ($page - 1) * $perPage;

$search = trim((string) ($_GET['q'] ?? ''));
$actionFilter = trim((string) ($_GET['action_type'] ?? ''));

$where = ['1'];
$params = [];

if ($search !== '') {
    $where[] = '(actor_email LIKE ? OR summary LIKE ? OR entity_id LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

if ($actionFilter !== '') {
    $where[] = 'action LIKE ?';
    $params[] = $actionFilter . '%';
}

$clause = implode(' AND ', $where);
$total = Db::count('audit_logs', $clause, $params);

// LIMIT/OFFSET cannot be bound reliably, so they are cast to int and inlined.
$entries = Db::all(
    "SELECT * FROM audit_logs WHERE {$clause} ORDER BY created_at DESC LIMIT {$perPage} OFFSET {$offset}",
    $params
);

$actionGroups = Db::all(
    'SELECT SUBSTRING_INDEX(action, ".", 2) AS prefix, COUNT(*) AS total
       FROM audit_logs GROUP BY prefix ORDER BY total DESC LIMIT 20'
);

$today = Db::count('audit_logs', 'created_at >= (UTC_TIMESTAMP() - INTERVAL 1 DAY)');
$week = Db::count('audit_logs', 'created_at >= (UTC_TIMESTAMP() - INTERVAL 7 DAY)');

View::begin('layouts/admin', ['title' => 'Audit log', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Audit log</h1>
  <p>Every administrative change, with who made it, when, and from which address.</p>
</div>

<div class="grid grid-4">
  <div class="card stat"><p class="stat-label">Total entries</p><p class="stat-value tabular"><?= number_format(Db::count('audit_logs')) ?></p></div>
  <div class="card stat"><p class="stat-label">Last 24 hours</p><p class="stat-value tabular"><?= number_format($today) ?></p></div>
  <div class="card stat"><p class="stat-label">Last 7 days</p><p class="stat-value tabular"><?= number_format($week) ?></p></div>
  <div class="card stat"><p class="stat-label">Matching filter</p><p class="stat-value tabular"><?= number_format($total) ?></p></div>
</div>

<div class="card mt-3">
  <div class="card-body">
    <form method="get" class="field-row" style="align-items:flex-end">
      <div class="field">
        <label for="q">Search</label>
        <input class="input" id="q" name="q" value="<?= Str::e($search) ?>"
               placeholder="Email, summary or record id">
      </div>
      <div class="field">
        <label for="action_type">Action</label>
        <select class="select" id="action_type" name="action_type">
          <option value="">Everything</option>
          <?php foreach ($actionGroups as $group): ?>
            <option value="<?= Str::e($group['prefix']) ?>"
                    <?= $actionFilter === $group['prefix'] ? 'selected' : '' ?>>
              <?= Str::e($group['prefix']) ?> (<?= number_format((int) $group['total']) ?>)
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <button class="btn" type="submit">Filter</button>
      <?php if ($search !== '' || $actionFilter !== ''): ?>
        <a class="btn btn-ghost" href="/admin/audit">Clear</a>
      <?php endif; ?>
    </form>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>When</th><th>Who</th><th>Action</th><th>What changed</th><th>Record</th><th>From</th></tr>
      </thead>
      <tbody>
        <?php if ($entries === []): ?>
          <tr><td colspan="6" class="small muted">Nothing matches that filter.</td></tr>
        <?php endif; ?>
        <?php foreach ($entries as $entry): ?>
          <tr>
            <td class="tiny muted nowrap">
              <?= Str::e(Str::dateTime($entry['created_at'])) ?>
              <span style="display:block"><?= Str::e(Str::timeAgo($entry['created_at'])) ?></span>
            </td>
            <td class="small"><?= Str::e($entry['actor_email'] ?: 'system') ?></td>
            <td class="tiny mono"><?= Str::e($entry['action']) ?></td>
            <td class="small"><?= Str::e($entry['summary'] ?? '—') ?></td>
            <td class="tiny muted mono">
              <?= Str::e($entry['entity_type'] ?? '') ?>
              <?php if ($entry['entity_id']): ?>
                <span style="display:block"><?= Str::e(Str::excerpt($entry['entity_id'], 20)) ?></span>
              <?php endif; ?>
            </td>
            <td class="tiny muted mono"><?= Str::e($entry['ip_address'] ?? '—') ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php
$pages = (int) ceil($total / $perPage);
$query = static function (int $target) use ($search, $actionFilter): string {
    $parts = ['page=' . $target];
    if ($search !== '') {
        $parts[] = 'q=' . urlencode($search);
    }
    if ($actionFilter !== '') {
        $parts[] = 'action_type=' . urlencode($actionFilter);
    }
    return '/admin/audit?' . implode('&amp;', $parts);
};
?>
<?php if ($pages > 1): ?>
  <nav class="pagination" aria-label="Pagination">
    <?php if ($page > 1): ?>
      <a href="<?= $query($page - 1) ?>">← Previous</a>
    <?php else: ?><span></span><?php endif; ?>
    <span class="muted">Page <?= $page ?> of <?= number_format($pages) ?></span>
    <?php if ($page < $pages): ?>
      <a href="<?= $query($page + 1) ?>">Next →</a>
    <?php else: ?><span></span><?php endif; ?>
  </nav>
<?php endif; ?>

<div class="card mt-3">
  <div class="card-head"><h2>Housekeeping</h2></div>
  <div class="card-body">
    <form method="post" class="field-row" style="align-items:flex-end"
          data-confirm="Delete audit entries older than the chosen window? This cannot be undone.">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="prune">
      <div class="field" style="max-width:12rem">
        <label for="days">Delete entries older than</label>
        <select class="select" id="days" name="days">
          <option value="90">90 days</option>
          <option value="180" selected>180 days</option>
          <option value="365">1 year</option>
          <option value="730">2 years</option>
        </select>
      </div>
      <button class="btn btn-outline" type="submit">Prune</button>
    </form>
    <p class="tiny muted mt-2">
      The prune itself is recorded, so the trail always shows that a prune happened and who ran it.
    </p>
  </div>
</div>

<?php View::end(); ?>
