<?php
declare(strict_types=1);

Auth::requireAdmin();

if (Request::isPost()) {
    $action = Request::input('action');
    $coupleId = Request::input('couple_id');

    if ($action === 'remove_member') {
        $userId = Request::input('user_id');

        Db::run(
            'UPDATE couple_members SET removed_at = UTC_TIMESTAMP(), removed_by = ?
              WHERE couple_id = ? AND user_id = ?',
            [Auth::id(), $coupleId, $userId]
        );

        Audit::record('admin.couple.member.remove', 'couple', $coupleId, 'Admin removed member ' . $userId);
        Flash::success('Member removed. Their access to that space ended immediately.');
        Response::redirect('/admin/couples');
    }

    if ($action === 'delete_space') {
        Db::delete('couples', 'id = ?', [$coupleId]);
        Audit::record('admin.couple.delete', 'couple', $coupleId, 'Deleted a relationship space');
        Flash::success('Space deleted.');
        Response::redirect('/admin/couples');
    }
}

$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 25;
$offset = ($page - 1) * $perPage;

$total = Db::count('couples');

$couples = Db::all(
    "SELECT * FROM couples ORDER BY created_at DESC LIMIT {$perPage} OFFSET {$offset}"
);

$membersByCouple = [];
if ($couples !== []) {
    $ids = array_column($couples, 'id');
    $rows = Db::all(
        'SELECT m.*, p.email, p.full_name FROM couple_members m
           LEFT JOIN profiles p ON p.id = m.user_id
          WHERE m.couple_id IN (' . Db::placeholders($ids) . ')
          ORDER BY m.joined_at ASC',
        $ids
    );
    foreach ($rows as $row) {
        $membersByCouple[$row['couple_id']][] = $row;
    }
}

View::begin('layouts/admin', ['title' => 'Relationship spaces', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Relationship spaces</h1>
  <p>
    <?= number_format($total) ?> spaces. You can remove either member — for example when the person who
    subscribed asks for the other to be removed. Removal is immediate and audited.
  </p>
</div>

<div class="card">
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Space</th><th>Type</th><th>Members</th><th>Created</th><th>Manage</th></tr>
      </thead>
      <tbody>
        <?php foreach ($couples as $couple): ?>
          <?php $members = $membersByCouple[$couple['id']] ?? []; ?>
          <tr>
            <td>
              <span class="bold"><?= Str::e($couple['name'] ?: 'Unnamed space') ?></span>
              <span class="tiny muted mono" style="display:block"><?= Str::e($couple['invite_code']) ?></span>
            </td>
            <td class="small muted">
              <?= Str::e(str_replace('_', ' ', $couple['relationship_type'])) ?>
              <span class="badge badge-<?= $couple['status'] === 'active' ? 'success' : 'outline' ?>">
                <?= Str::e($couple['status']) ?>
              </span>
            </td>
            <td>
              <?php foreach ($members as $member): ?>
                <div class="row-between small" style="gap:0.5rem">
                  <span style="<?= $member['removed_at'] ? 'opacity:.55;text-decoration:line-through' : '' ?>">
                    <?= Str::e($member['full_name'] ?: $member['email'] ?: 'Unknown') ?>
                    <?php if ($member['member_role'] === 'owner'): ?><span class="badge badge-primary">owner</span><?php endif; ?>
                    <span class="tiny muted" style="display:block"><?= Str::e($member['email']) ?></span>
                  </span>

                  <?php if (!$member['removed_at']): ?>
                    <form method="post" data-confirm="Remove this member from the space?">
                      <?= Csrf::field() ?>
                      <input type="hidden" name="action" value="remove_member">
                      <input type="hidden" name="couple_id" value="<?= Str::e($couple['id']) ?>">
                      <input type="hidden" name="user_id" value="<?= Str::e($member['user_id']) ?>">
                      <button class="btn btn-sm btn-ghost" type="submit">Remove</button>
                    </form>
                  <?php else: ?>
                    <span class="badge">removed</span>
                  <?php endif; ?>
                </div>
              <?php endforeach; ?>
              <?php if ($members === []): ?><span class="small muted">No members</span><?php endif; ?>
            </td>
            <td class="small muted nowrap"><?= Str::e(Str::date($couple['created_at'])) ?></td>
            <td>
              <form method="post"
                    data-confirm="Delete this whole space and every entry in it? This cannot be undone.">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="delete_space">
                <input type="hidden" name="couple_id" value="<?= Str::e($couple['id']) ?>">
                <button class="btn btn-sm btn-danger" type="submit">Delete space</button>
              </form>
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
    <?php if ($page > 1): ?><a href="/admin/couples?page=<?= $page - 1 ?>">← Previous</a><?php else: ?><span></span><?php endif; ?>
    <span class="muted">Page <?= $page ?> of <?= $pages ?></span>
    <?php if ($page < $pages): ?><a href="/admin/couples?page=<?= $page + 1 ?>">Next →</a><?php else: ?><span></span><?php endif; ?>
  </nav>
<?php endif; ?>

<?php View::end(); ?>
