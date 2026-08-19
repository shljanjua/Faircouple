<?php
declare(strict_types=1);

$me = Auth::requireAdmin();

/*
 * SMTP credentials, the ten transactional templates and the delivery log.
 * The password is write-only: the form never renders it back, and a blank
 * field means "keep what is stored".
 */

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'smtp') {
        $values = [
            'email_enabled'             => Request::bool('email_enabled'),
            'email_admin_notifications' => Request::bool('email_admin_notifications'),
            'smtp_host'                 => trim(Request::input('smtp_host')),
            'smtp_port'                 => Request::int('smtp_port', 465) ?: 465,
            'smtp_secure'               => Request::bool('smtp_secure'),
            'smtp_user'                 => trim(Request::input('smtp_user')),
            'smtp_from_email'           => trim(Request::input('smtp_from_email')),
            'smtp_from_name'            => trim(Request::input('smtp_from_name')),
            'smtp_reply_to'             => trim(Request::input('smtp_reply_to')),
        ];

        // Blank password means leave the stored one alone.
        $password = Request::input('smtp_password');
        if ($password !== '') {
            $values['smtp_password'] = $password;
        }

        Settings::put($values, $me['id']);

        Audit::record('admin.email.smtp', 'settings', 'smtp', 'Updated the SMTP settings');
        Flash::success('SMTP settings saved.');
        Response::redirect('/admin/emails');
    }

    if ($action === 'verify') {
        $result = Mailer::verify();
        if ($result['ok']) {
            Flash::success('Connected and authenticated successfully.');
        } else {
            Flash::error('SMTP check failed: ' . $result['error']);
        }
        Response::redirect('/admin/emails');
    }

    if ($action === 'test') {
        $to = trim(Request::input('test_email'));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            Flash::error('Enter a valid email address to send the test to.');
            Response::redirect('/admin/emails');
        }

        $result = Mailer::send(
            $to,
            'FairCouples SMTP test',
            '<h2>It works.</h2><p>Your FairCouples site can send email through '
                . Str::e(Settings::text('smtp_host')) . '.</p>'
                . '<p>Sent at ' . Str::e(Str::dateTime(Str::now())) . '.</p>'
        );

        if ($result['ok']) {
            Flash::success('Test email sent to ' . $to . '. Check the inbox and the spam folder.');
        } else {
            Flash::error('Could not send: ' . $result['error']);
        }
        Response::redirect('/admin/emails');
    }

    if ($action === 'template') {
        $id = Request::input('id');

        Db::update('email_templates', $id, [
            'name'      => Request::input('name'),
            'subject'   => Request::input('subject'),
            'html_body' => Request::raw('html_body'),
            'text_body' => Request::nullable('text_body'),
            'is_active' => Request::bool('is_active'),
        ]);

        Audit::record('admin.email.template', 'email_template', $id, 'Edited an email template');
        Flash::success('Template saved.');
        Response::redirect('/admin/emails?template=' . urlencode($id));
    }

    if ($action === 'template_send') {
        $slug = Request::input('slug');
        $to = trim(Request::input('to'));

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            Flash::error('Enter a valid email address.');
            Response::redirect('/admin/emails?template=' . urlencode(Request::input('id')));
        }

        // Fill every declared variable with an obvious sample value.
        $template = Db::one('SELECT variables FROM email_templates WHERE slug = ? LIMIT 1', [$slug]);
        $variables = [];
        foreach (Str::json($template['variables'] ?? null) as $variable) {
            $variables[(string) $variable] = '[' . $variable . ']';
        }

        $result = Mailer::template($slug, $to, $variables);

        if ($result['ok']) {
            Flash::success('Preview sent to ' . $to . '.');
        } else {
            Flash::error('Could not send: ' . $result['error']);
        }
        Response::redirect('/admin/emails?template=' . urlencode(Request::input('id')));
    }
}

$templates = Db::all('SELECT * FROM email_templates ORDER BY name ASC');

$editing = null;
if (($_GET['template'] ?? '') !== '') {
    $editing = Db::one('SELECT * FROM email_templates WHERE id = ? LIMIT 1', [$_GET['template']]);
}

$logs = Db::all('SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 60');

$sent = Db::count('email_logs', 'status = ?', ['sent']);
$failed = Db::count('email_logs', 'status = ?', ['failed']);
$configured = Settings::text('smtp_host') !== '';

View::begin('layouts/admin', ['title' => 'Email & SMTP', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Email &amp; SMTP</h1>
  <p>
    Every transactional email — signup confirmation, partner invites, password resets, receipts and the
    weekly fairness report — goes out through the SMTP account you set here.
  </p>
</div>

<?php if (!$configured): ?>
  <div class="alert alert-warning">
    <div>
      <strong>SMTP is not configured yet</strong>
      Until you add a host below, no confirmation emails, invites or password resets can be sent.
      In hPanel go to <em>Emails → Email Accounts → Connect Devices</em> to find your host, port and
      credentials.
    </div>
  </div>
<?php endif; ?>

<div class="grid grid-4 mt-3">
  <div class="card stat"><p class="stat-label">Delivered</p><p class="stat-value tabular"><?= number_format($sent) ?></p></div>
  <div class="card stat"><p class="stat-label">Failed</p><p class="stat-value tabular"><?= number_format($failed) ?></p></div>
  <div class="card stat"><p class="stat-label">Templates</p><p class="stat-value tabular"><?= count($templates) ?></p></div>
  <div class="card stat">
    <p class="stat-label">Sending</p>
    <p class="stat-value">
      <?php if (!Settings::bool('email_enabled', true)): ?>
        <span class="badge badge-danger">off</span>
      <?php elseif ($configured): ?>
        <span class="badge badge-success">on</span>
      <?php else: ?>
        <span class="badge badge-warning">no host</span>
      <?php endif; ?>
    </p>
  </div>
</div>

<!-- --------------------------------------------------------------- SMTP -->
<form method="post" class="card mt-3">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="smtp">

  <div class="card-head"><h2>SMTP connection</h2></div>

  <div class="card-body">
    <div class="field-row">
      <div class="field">
        <label for="smtp_host">SMTP host <span class="required">*</span></label>
        <input class="input mono" id="smtp_host" name="smtp_host"
               value="<?= Str::e(Settings::text('smtp_host')) ?>" placeholder="smtp.hostinger.com">
      </div>
      <div class="field">
        <label for="smtp_port">Port</label>
        <select class="select" id="smtp_port" name="smtp_port">
          <option value="465" <?= (int) Settings::number('smtp_port', 465) === 465 ? 'selected' : '' ?>>
            465 — SSL (recommended)
          </option>
          <option value="587" <?= (int) Settings::number('smtp_port', 465) === 587 ? 'selected' : '' ?>>
            587 — STARTTLS
          </option>
          <option value="25" <?= (int) Settings::number('smtp_port', 465) === 25 ? 'selected' : '' ?>>
            25 — unencrypted
          </option>
        </select>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="smtp_user">Username</label>
        <input class="input mono" id="smtp_user" name="smtp_user" autocomplete="off"
               value="<?= Str::e(Settings::text('smtp_user')) ?>" placeholder="no-reply@yourdomain.com">
      </div>
      <div class="field">
        <label for="smtp_password">
          Password
          <?php if (Settings::text('smtp_password') !== ''): ?>
            <span class="badge badge-success">saved</span>
          <?php endif; ?>
        </label>
        <input class="input mono" type="password" id="smtp_password" name="smtp_password" autocomplete="new-password"
               placeholder="<?= Settings::text('smtp_password') !== ''
                   ? 'Leave blank to keep the saved password'
                   : 'Your mailbox password' ?>">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="smtp_from_email">From address</label>
        <input class="input" type="email" id="smtp_from_email" name="smtp_from_email"
               value="<?= Str::e(Settings::text('smtp_from_email')) ?>" placeholder="hello@yourdomain.com">
        <span class="hint">Must be a mailbox on your own domain or the mail will be marked as spam.</span>
      </div>
      <div class="field">
        <label for="smtp_from_name">From name</label>
        <input class="input" id="smtp_from_name" name="smtp_from_name"
               value="<?= Str::e(Settings::text('smtp_from_name', 'FairCouples')) ?>">
      </div>
      <div class="field">
        <label for="smtp_reply_to">Reply-to</label>
        <input class="input" type="email" id="smtp_reply_to" name="smtp_reply_to"
               value="<?= Str::e(Settings::text('smtp_reply_to')) ?>">
      </div>
    </div>

    <div class="stack-sm mt-2">
      <label class="checkbox">
        <input type="checkbox" name="email_enabled" value="1"
               <?= Settings::bool('email_enabled', true) ? 'checked' : '' ?>>
        <span>Send email — turn this off to silence all outgoing mail while you test</span>
      </label>
      <label class="checkbox">
        <input type="checkbox" name="smtp_secure" value="1"
               <?= Settings::bool('smtp_secure', true) ? 'checked' : '' ?>>
        <span>Use TLS on port 587 — port 465 always uses SSL regardless</span>
      </label>
      <label class="checkbox">
        <input type="checkbox" name="email_admin_notifications" value="1"
               <?= Settings::bool('email_admin_notifications', true) ? 'checked' : '' ?>>
        <span>Email the support inbox on new signups, payments and contact messages</span>
      </label>
    </div>

    <button class="btn btn-lg mt-3" type="submit">Save SMTP settings</button>
  </div>
</form>

<div class="grid grid-2 mt-3">
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="verify">
    <div class="card-head"><h2>Check the connection</h2></div>
    <div class="card-body">
      <p class="small muted">
        Opens a socket to the host, starts TLS and authenticates — without sending anything.
        The fastest way to tell a wrong password from a blocked port.
      </p>
      <button class="btn btn-outline mt-2" type="submit">Verify connection</button>
    </div>
  </form>

  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="test">
    <div class="card-head"><h2>Send a test email</h2></div>
    <div class="card-body">
      <div class="field">
        <label for="test_email">Send to</label>
        <input class="input" type="email" id="test_email" name="test_email" required
               value="<?= Str::e($me['email']) ?>">
      </div>
      <button class="btn mt-2" type="submit">Send test</button>
    </div>
  </form>
</div>

<!-- ---------------------------------------------------------- Templates -->
<?php if ($editing): ?>
  <form method="post" class="card mt-3">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="template">
    <input type="hidden" name="id" value="<?= Str::e($editing['id']) ?>">

    <div class="card-head">
      <h2>Edit: <?= Str::e($editing['name']) ?></h2>
      <a class="small" href="/admin/emails">Cancel</a>
    </div>

    <div class="card-body">
      <?php if ($editing['description']): ?>
        <p class="small muted"><?= Str::e($editing['description']) ?></p>
      <?php endif; ?>

      <?php $variables = Str::json($editing['variables'] ?? null); ?>
      <?php if ($variables !== []): ?>
        <p class="small mt-2">
          <strong>Available placeholders</strong> — paste them anywhere in the subject or body:
        </p>
        <p class="mt-1">
          <?php foreach ($variables as $variable): ?>
            <code style="margin-right:0.35rem">{{<?= Str::e((string) $variable) ?>}}</code>
          <?php endforeach; ?>
          <code>{{site_name}}</code> <code>{{site_url}}</code> <code>{{year}}</code>
        </p>
      <?php endif; ?>

      <div class="field-row mt-3">
        <div class="field">
          <label for="name">Internal name</label>
          <input class="input" id="name" name="name" required value="<?= Str::e($editing['name']) ?>">
        </div>
        <div class="field">
          <label for="slug_display">Slug</label>
          <input class="input mono" id="slug_display" value="<?= Str::e($editing['slug']) ?>" disabled>
          <span class="hint">The code refers to this template by its slug, so it cannot be changed.</span>
        </div>
      </div>

      <div class="field">
        <label for="subject">Subject line <span class="required">*</span></label>
        <input class="input" id="subject" name="subject" required maxlength="250"
               value="<?= Str::e($editing['subject']) ?>">
      </div>

      <div class="field">
        <label for="html_body">HTML body <span class="required">*</span></label>
        <textarea class="textarea mono" rows="20" id="html_body" name="html_body" required
                  style="font-size:0.8rem"><?= Str::e($editing['html_body']) ?></textarea>
        <span class="hint">Wrapped in the site's email shell automatically — write just the inner content.</span>
      </div>

      <div class="field">
        <label for="text_body">Plain text fallback</label>
        <textarea class="textarea mono" rows="6" id="text_body" name="text_body"
                  style="font-size:0.8rem"><?= Str::e($editing['text_body'] ?? '') ?></textarea>
      </div>

      <label class="checkbox">
        <input type="checkbox" name="is_active" value="1" <?= Str::bool($editing['is_active']) ? 'checked' : '' ?>>
        <span>Active — switching this off stops that email being sent at all</span>
      </label>

      <button class="btn btn-lg mt-3" type="submit">Save template</button>
    </div>
  </form>

  <form method="post" class="card mt-3">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="template_send">
    <input type="hidden" name="id" value="<?= Str::e($editing['id']) ?>">
    <input type="hidden" name="slug" value="<?= Str::e($editing['slug']) ?>">
    <div class="card-head"><h2>Send yourself a preview</h2></div>
    <div class="card-body">
      <p class="small muted">Placeholders are filled with their own names in brackets so you can see where each one lands.</p>
      <div class="field mt-2">
        <label for="to">Send to</label>
        <input class="input" type="email" id="to" name="to" required value="<?= Str::e($me['email']) ?>">
      </div>
      <button class="btn btn-outline mt-2" type="submit">Send preview</button>
    </div>
  </form>
<?php endif; ?>

<div class="card mt-3">
  <div class="card-head"><h2>Templates</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Template</th><th>Slug</th><th>Subject</th><th>State</th><th></th></tr></thead>
      <tbody>
        <?php foreach ($templates as $template): ?>
          <tr>
            <td>
              <span class="bold"><?= Str::e($template['name']) ?></span>
              <span class="tiny muted" style="display:block"><?= Str::e(Str::excerpt($template['description'], 70)) ?></span>
            </td>
            <td class="mono tiny muted"><?= Str::e($template['slug']) ?></td>
            <td class="small"><?= Str::e(Str::excerpt($template['subject'], 54)) ?></td>
            <td>
              <span class="badge badge-<?= Str::bool($template['is_active']) ? 'success' : 'outline' ?>">
                <?= Str::bool($template['is_active']) ? 'on' : 'off' ?>
              </span>
            </td>
            <td class="right">
              <a class="btn btn-sm btn-outline"
                 href="/admin/emails?template=<?= Str::e($template['id']) ?>">Edit</a>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<div class="card mt-3">
  <div class="card-head"><h2>Delivery log</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Template</th><th>Status</th><th>Error</th></tr></thead>
      <tbody>
        <?php if ($logs === []): ?>
          <tr><td colspan="6" class="small muted">Nothing sent yet.</td></tr>
        <?php endif; ?>
        <?php foreach ($logs as $log): ?>
          <tr>
            <td class="tiny muted nowrap"><?= Str::e(Str::dateTime($log['created_at'])) ?></td>
            <td class="small"><?= Str::e($log['to_email']) ?></td>
            <td class="small"><?= Str::e(Str::excerpt($log['subject'], 40)) ?></td>
            <td class="tiny mono muted"><?= Str::e($log['template_slug'] ?? '—') ?></td>
            <td>
              <span class="badge badge-<?= $log['status'] === 'sent' ? 'success' : ($log['status'] === 'queued' ? 'outline' : 'danger') ?>">
                <?= Str::e($log['status']) ?>
              </span>
            </td>
            <td class="tiny muted"><?= Str::e(Str::excerpt($log['error'], 60)) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
