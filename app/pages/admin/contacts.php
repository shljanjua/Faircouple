<?php
declare(strict_types=1);

Auth::requireAdmin();

/*
 * The contact form inbox and the newsletter list, plus CSV export for both so
 * the list can be moved into a mail tool without database access.
 */

if (Request::isPost()) {
    $action = Request::input('action');
    $id = Request::input('id');

    if ($action === 'status') {
        $status = Request::input('status', 'read');
        if (!in_array($status, ['new', 'read', 'replied', 'closed', 'spam'], true)) {
            $status = 'read';
        }

        Db::update('contact_messages', $id, [
            'status'     => $status,
            'replied_at' => $status === 'replied' ? Str::now() : null,
        ]);

        Flash::success('Message marked as ' . $status . '.');
        Response::redirect('/admin/contacts');
    }

    if ($action === 'reply') {
        $message = Db::one('SELECT * FROM contact_messages WHERE id = ? LIMIT 1', [$id]);
        if (!$message) {
            Flash::error('That message no longer exists.');
            Response::redirect('/admin/contacts');
        }

        $body = trim(Request::raw('body'));
        if ($body === '') {
            Flash::error('Write a reply first.');
            Response::redirect('/admin/contacts');
        }

        $result = Mailer::send(
            (string) $message['email'],
            'Re: ' . ($message['subject'] ?: 'Your message to ' . Settings::text('site_name', 'FairCouples')),
            '<p>Hi ' . Str::e((string) $message['name']) . ',</p>'
                . '<div>' . Str::markdown($body) . '</div>'
                . '<hr><p style="color:#777;font-size:13px">You wrote to us on '
                . Str::e(Str::date($message['created_at'])) . ':</p>'
                . '<blockquote style="color:#777;font-size:13px">'
                . Str::e(Str::excerpt($message['message'], 400)) . '</blockquote>'
        );

        if ($result['ok']) {
            Db::update('contact_messages', $id, ['status' => 'replied', 'replied_at' => Str::now()]);
            Audit::record('admin.contact.reply', 'contact_message', $id, 'Replied to ' . $message['email']);
            Flash::success('Reply sent to ' . $message['email'] . '.');
        } else {
            Flash::error('Could not send the reply: ' . $result['error']);
        }

        Response::redirect('/admin/contacts');
    }

    if ($action === 'delete') {
        Db::delete('contact_messages', 'id = ?', [$id]);
        Flash::success('Message deleted.');
        Response::redirect('/admin/contacts');
    }

    if ($action === 'unsubscribe') {
        Db::update('newsletter_subscribers', $id, [
            'status'          => 'unsubscribed',
            'unsubscribed_at' => Str::now(),
        ]);
        Flash::success('Marked as unsubscribed.');
        Response::redirect('/admin/contacts');
    }

    if ($action === 'subscriber_delete') {
        Db::delete('newsletter_subscribers', 'id = ?', [$id]);
        Flash::success('Subscriber removed.');
        Response::redirect('/admin/contacts');
    }
}

/* ------------------------------------------------------------- CSV export */

$export = (string) ($_GET['export'] ?? '');

if ($export === 'subscribers') {
    $rows = Db::all('SELECT email, name, status, source, country_code, created_at
                       FROM newsletter_subscribers ORDER BY created_at DESC');

    $csv = "email,name,status,source,country,subscribed_at\n";
    foreach ($rows as $row) {
        $csv .= implode(',', array_map(
            static fn ($value) => '"' . str_replace('"', '""', (string) $value) . '"',
            [$row['email'], $row['name'], $row['status'], $row['source'], $row['country_code'], $row['created_at']]
        )) . "\n";
    }

    Audit::record('admin.subscribers.export', 'newsletter', null, 'Exported ' . count($rows) . ' subscribers');
    Response::download($csv, 'faircouples-subscribers-' . Str::today() . '.csv', 'text/csv; charset=utf-8');
}

if ($export === 'messages') {
    $rows = Db::all('SELECT name, email, subject, category, status, created_at, message
                       FROM contact_messages ORDER BY created_at DESC');

    $csv = "name,email,subject,category,status,received_at,message\n";
    foreach ($rows as $row) {
        $csv .= implode(',', array_map(
            static fn ($value) => '"' . str_replace('"', '""', (string) $value) . '"',
            [$row['name'], $row['email'], $row['subject'], $row['category'],
             $row['status'], $row['created_at'], $row['message']]
        )) . "\n";
    }

    Response::download($csv, 'faircouples-messages-' . Str::today() . '.csv', 'text/csv; charset=utf-8');
}

/* ----------------------------------------------------------------- Reading */

$statusFilter = trim((string) ($_GET['status'] ?? ''));

$messages = $statusFilter !== ''
    ? Db::all('SELECT * FROM contact_messages WHERE status = ? ORDER BY created_at DESC LIMIT 100', [$statusFilter])
    : Db::all('SELECT * FROM contact_messages ORDER BY status = "new" DESC, created_at DESC LIMIT 100');

$subscribers = Db::all('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 200');

$unread = Db::count('contact_messages', 'status = ?', ['new']);
$subscribed = Db::count('newsletter_subscribers', 'status = ?', ['subscribed']);
$unsubscribed = Db::count('newsletter_subscribers', 'status = ?', ['unsubscribed']);

View::begin('layouts/admin', ['title' => 'Inbox & subscribers', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Inbox &amp; subscribers</h1>
  <p>Contact form messages and the newsletter list. Replies go out through your SMTP account.</p>
</div>

<div class="grid grid-4">
  <div class="card stat"><p class="stat-label">Unread</p><p class="stat-value tabular"><?= number_format($unread) ?></p></div>
  <div class="card stat"><p class="stat-label">Total messages</p><p class="stat-value tabular"><?= number_format(Db::count('contact_messages')) ?></p></div>
  <div class="card stat"><p class="stat-label">Subscribed</p><p class="stat-value tabular"><?= number_format($subscribed) ?></p></div>
  <div class="card stat"><p class="stat-label">Unsubscribed</p><p class="stat-value tabular"><?= number_format($unsubscribed) ?></p></div>
</div>

<div class="tabs mt-3">
  <a href="/admin/contacts" class="<?= $statusFilter === '' ? 'is-active' : '' ?>">All</a>
  <?php foreach (['new', 'read', 'replied', 'closed', 'spam'] as $status): ?>
    <a href="/admin/contacts?status=<?= $status ?>" class="<?= $statusFilter === $status ? 'is-active' : '' ?>">
      <?= Str::e(ucfirst($status)) ?>
    </a>
  <?php endforeach; ?>
  <a href="/admin/contacts?export=messages">Export CSV</a>
</div>

<div class="card">
  <div class="card-head"><h2>Messages</h2></div>
  <div class="card-body stack">
    <?php if ($messages === []): ?>
      <p class="small muted">No messages<?= $statusFilter !== '' ? ' with that status' : '' ?>.</p>
    <?php endif; ?>

    <?php foreach ($messages as $message): ?>
      <div class="card card-flat">
        <div class="card-body">
          <div class="row-between" style="align-items:flex-start;gap:0.75rem">
            <div>
              <span class="bold">
                <?= Str::e($message['subject'] ?: '(no subject)') ?>
                <?php if ($message['status'] === 'new'): ?>
                  <span class="badge badge-primary">new</span>
                <?php else: ?>
                  <span class="badge"><?= Str::e($message['status']) ?></span>
                <?php endif; ?>
              </span>
              <span class="small muted" style="display:block">
                <?= Str::e($message['name']) ?> &lt;<?= Str::e($message['email']) ?>&gt;
                · <?= Str::e($message['category'] ?? 'general') ?>
                · <?= Str::e(Str::timeAgo($message['created_at'])) ?>
              </span>
            </div>
            <div class="nowrap">
              <a class="btn btn-sm btn-outline" href="mailto:<?= Str::e($message['email']) ?>">Email client</a>
              <form method="post" style="display:inline" data-confirm="Delete this message?">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= Str::e($message['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">×</button>
              </form>
            </div>
          </div>

          <p class="mt-2" style="white-space:pre-wrap"><?= Str::e($message['message']) ?></p>

          <details class="mt-2">
            <summary class="small" style="cursor:pointer;color:hsl(var(--primary))">Reply from here</summary>
            <form method="post" class="mt-2">
              <?= Csrf::field() ?>
              <input type="hidden" name="action" value="reply">
              <input type="hidden" name="id" value="<?= Str::e($message['id']) ?>">
              <div class="field">
                <label for="body-<?= Str::e($message['id']) ?>">Your reply</label>
                <textarea class="textarea" rows="5" id="body-<?= Str::e($message['id']) ?>" name="body" required></textarea>
                <span class="hint">Markdown is supported. Their original message is quoted underneath.</span>
              </div>
              <button class="btn btn-sm" type="submit">Send reply</button>
            </form>
          </details>

          <form method="post" class="row mt-2" style="gap:0.4rem">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="status">
            <input type="hidden" name="id" value="<?= Str::e($message['id']) ?>">
            <?php foreach (['read', 'replied', 'closed', 'spam'] as $status): ?>
              <button class="btn btn-sm btn-ghost" type="submit" name="status" value="<?= $status ?>">
                Mark <?= $status ?>
              </button>
            <?php endforeach; ?>
          </form>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
</div>

<div class="card mt-3">
  <div class="card-head">
    <h2>Newsletter subscribers (<?= number_format(Db::count('newsletter_subscribers')) ?>)</h2>
    <a class="btn btn-sm btn-outline" href="/admin/contacts?export=subscribers">Export CSV</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Email</th><th>Name</th><th>Source</th><th>Country</th><th>Status</th><th>Joined</th><th></th></tr></thead>
      <tbody>
        <?php if ($subscribers === []): ?>
          <tr><td colspan="7" class="small muted">Nobody has subscribed yet.</td></tr>
        <?php endif; ?>
        <?php foreach ($subscribers as $subscriber): ?>
          <tr>
            <td class="small"><?= Str::e($subscriber['email']) ?></td>
            <td class="small muted"><?= Str::e($subscriber['name'] ?? '—') ?></td>
            <td class="tiny muted"><?= Str::e($subscriber['source'] ?? '—') ?></td>
            <td class="tiny muted"><?= Str::e($subscriber['country_code'] ?? '—') ?></td>
            <td>
              <span class="badge badge-<?= $subscriber['status'] === 'subscribed' ? 'success' : 'outline' ?>">
                <?= Str::e($subscriber['status']) ?>
              </span>
            </td>
            <td class="tiny muted nowrap"><?= Str::e(Str::date($subscriber['created_at'])) ?></td>
            <td class="right nowrap">
              <?php if ($subscriber['status'] === 'subscribed'): ?>
                <form method="post" style="display:inline">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="unsubscribe">
                  <input type="hidden" name="id" value="<?= Str::e($subscriber['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit">Unsubscribe</button>
                </form>
              <?php endif; ?>
              <form method="post" style="display:inline" data-confirm="Remove this subscriber entirely?">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="subscriber_delete">
                <input type="hidden" name="id" value="<?= Str::e($subscriber['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">×</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
