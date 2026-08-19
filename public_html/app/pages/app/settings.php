<?php
declare(strict_types=1);

$user = Auth::require();
$tab = Request::input('tab', 'profile');

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'profile') {
        Db::update('profiles', $user['id'], [
            'full_name'     => Request::nullable('full_name'),
            'display_name'  => Request::nullable('display_name'),
            'phone'         => Request::nullable('phone'),
            'bio'           => Request::nullable('bio'),
            'date_of_birth' => Request::date('date_of_birth'),
            'gender'        => Request::input('gender') !== '' ? Request::input('gender') : null,
            'country_code'  => strtoupper(Request::input('country_code')) !== '' ? substr(strtoupper(Request::input('country_code')), 0, 2) : null,
            'timezone'      => Request::input('timezone', $user['timezone']) ?: 'UTC',
            'currency'      => Currency::normalise(Request::input('currency', $user['currency'])),
        ]);

        // A new profile photo, if one was chosen.
        if (!empty($_FILES['avatar']['name'])) {
            $stored = Storage::store($_FILES['avatar'], 'avatars', null, $user['id'], 'avatar');
            if ($stored['ok']) {
                $previous = $user['avatar_url'];
                Db::update('profiles', $user['id'], ['avatar_url' => Storage::url('avatars', $stored['path'])]);

                // Clean up whatever the old URL pointed at.
                if ($previous && str_contains($previous, 'b=avatars')) {
                    parse_str((string) parse_url($previous, PHP_URL_QUERY), $query);
                    if (!empty($query['p'])) {
                        Storage::delete('avatars', (string) $query['p']);
                    }
                }
            } else {
                Flash::error($stored['error']);
            }
        }

        Flash::success('Profile updated.');
        Response::redirect('/dashboard/settings?tab=profile');
    }

    if ($action === 'password') {
        $result = Auth::changePassword(Request::raw('current_password'), Request::raw('password'));

        if (!$result['ok']) {
            Flash::error($result['error']);
        } elseif (Request::raw('password') !== Request::raw('confirm')) {
            Flash::error('The two new passwords do not match.');
        } else {
            Flash::success('Password updated. Every other device has been signed out.');
        }

        Response::redirect('/dashboard/settings?tab=security');
    }

    if ($action === 'notifications') {
        $prefs = [
            'email'            => Request::bool('notify_email'),
            'partner_activity' => Request::bool('notify_partner'),
            'weekly_report'    => Request::bool('notify_weekly'),
            'push'             => Request::bool('notify_push'),
        ];
        Db::update('profiles', $user['id'], ['notification_prefs' => json_encode($prefs)]);
        Flash::success('Preferences saved.');
        Response::redirect('/dashboard/settings?tab=notifications');
    }

    if ($action === 'sessions') {
        Db::delete('sessions', 'user_id = ? AND id <> ?', [$user['id'], $_SESSION['sid'] ?? '']);
        Flash::success('Every other device has been signed out.');
        Response::redirect('/dashboard/settings?tab=security');
    }

    if ($action === 'delete_account') {
        if (strtoupper(trim(Request::input('confirm'))) !== 'DELETE') {
            Flash::error('Type DELETE to confirm.');
            Response::redirect('/dashboard/settings?tab=privacy');
        }

        // Private entries go; shared rows are detached so the partner keeps theirs.
        Db::delete('emotion_logs', 'user_id = ? AND is_private = 1', [$user['id']]);
        Db::delete('fairness_entries', 'user_id = ? AND is_private = 1', [$user['id']]);

        Db::run(
            'UPDATE couple_members SET removed_at = UTC_TIMESTAMP() WHERE user_id = ? AND removed_at IS NULL',
            [$user['id']]
        );
        Db::run(
            'UPDATE profiles SET status = "pending_deletion", deleted_at = UTC_TIMESTAMP() WHERE id = ?',
            [$user['id']]
        );
        Db::run('UPDATE users SET disabled_at = UTC_TIMESTAMP() WHERE id = ?', [$user['id']]);
        Db::delete('sessions', 'user_id = ?', [$user['id']]);

        Audit::record('account.delete', 'profile', $user['id'], 'Member deleted their own account', [], $user['id'], $user['email']);

        Auth::signOut();
        Flash::success('Your account is closed. Sign-in is disabled and the rest is purged within 30 days.');
        Response::redirect('/');
    }
}

$sessions = Db::all(
    'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
    [$user['id']]
);

$prefs = $user['notification_prefs'];
$tabs = ['profile' => 'Profile', 'security' => 'Security', 'notifications' => 'Notifications', 'privacy' => 'Privacy & data'];

View::begin('layouts/app', ['title' => 'Settings', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Settings</h1>
  <p>Your account, security and privacy controls.</p>
</div>

<div class="tabs">
  <?php foreach ($tabs as $key => $label): ?>
    <a href="/dashboard/settings?tab=<?= $key ?>" class="<?= $tab === $key ? 'is-active' : '' ?>"><?= $label ?></a>
  <?php endforeach; ?>
</div>

<?php if ($tab === 'profile'): ?>
  <form method="post" enctype="multipart/form-data" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="profile">

    <div class="card-head"><h2>Your profile</h2></div>
    <div class="card-body">
      <div class="row" style="gap:1rem">
        <?= View::avatar($user['avatar_url'], $user['full_name'], 64) ?>
        <div class="field" style="flex:1">
          <label for="avatar">Profile photo</label>
          <input class="input" type="file" id="avatar" name="avatar" accept="image/*" style="height:auto;padding:0.6rem">
          <span class="hint">Up to 5 MB.</span>
        </div>
      </div>

      <div class="field-row mt-3">
        <div class="field">
          <label for="full_name">Full name</label>
          <input class="input" id="full_name" name="full_name" maxlength="120" value="<?= Str::e($user['full_name']) ?>">
        </div>
        <div class="field">
          <label for="display_name">What your partner sees</label>
          <input class="input" id="display_name" name="display_name" maxlength="120" value="<?= Str::e($user['display_name']) ?>">
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="email_display">Email</label>
          <input class="input" id="email_display" value="<?= Str::e($user['email']) ?>" disabled>
          <span class="hint">Contact support to change the address on the account.</span>
        </div>
        <div class="field">
          <label for="phone">Phone</label>
          <input class="input" id="phone" name="phone" maxlength="40" value="<?= Str::e($user['phone']) ?>">
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="country_code">Country</label>
          <select class="select" id="country_code" name="country_code" data-country-select>
            <option value="">Not set</option>
            <?php foreach (Currency::COUNTRIES as $row): ?>
              <?php if ($row['code'] === 'OTHER') { continue; } ?>
              <option value="<?= Str::e($row['code']) ?>" data-currency="<?= Str::e($row['currency']) ?>"
                      <?= $user['country_code'] === $row['code'] ? 'selected' : '' ?>>
                <?= Str::e($row['name']) ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="field">
          <label for="currency">Billing currency</label>
          <select class="select" id="currency" name="currency" data-currency-select>
            <?php foreach (Currency::LIST as $code => $meta): ?>
              <option value="<?= Str::e($code) ?>" <?= $user['currency'] === $code ? 'selected' : '' ?>>
                <?= Str::e($meta['flag'] . ' ' . $code . ' — ' . $meta['name']) ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="field">
          <label for="date_of_birth">Date of birth</label>
          <input class="input" type="date" id="date_of_birth" name="date_of_birth"
                 value="<?= Str::e(substr((string) $user['date_of_birth'], 0, 10)) ?>">
        </div>
      </div>

      <div class="field">
        <label for="bio">About you</label>
        <textarea class="textarea" rows="3" id="bio" name="bio"><?= Str::e($user['bio']) ?></textarea>
      </div>

      <input type="hidden" name="timezone" value="<?= Str::e($user['timezone']) ?>">

      <button class="btn mt-2" type="submit">Save profile</button>
    </div>
  </form>

<?php elseif ($tab === 'security'): ?>
  <div class="grid grid-2">
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="password">

      <div class="card-head"><h2>Change password</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="current_password">Current password <span class="required">*</span></label>
          <input class="input" type="password" id="current_password" name="current_password"
                 required autocomplete="current-password">
        </div>
        <div class="field">
          <label for="password">New password <span class="required">*</span></label>
          <input class="input" type="password" id="password" name="password" required
                 autocomplete="new-password" minlength="8">
          <span class="hint">At least 8 characters, with an uppercase letter and a number.</span>
        </div>
        <div class="field">
          <label for="confirm">Confirm new password <span class="required">*</span></label>
          <input class="input" type="password" id="confirm" name="confirm" required autocomplete="new-password">
        </div>
        <button class="btn mt-2" type="submit">Update password</button>
      </div>
    </form>

    <div class="card">
      <div class="card-head"><h2>Signed-in devices</h2></div>
      <div class="card-body">
        <ul class="list-plain small">
          <?php foreach ($sessions as $session): ?>
            <li class="row-between">
              <span>
                <?= Str::e($session['ip_address'] ?: 'Unknown IP') ?>
                <?php if ($session['id'] === ($_SESSION['sid'] ?? '')): ?>
                  <span class="badge badge-success">this device</span>
                <?php endif; ?>
                <span class="tiny muted" style="display:block">
                  <?= Str::e(Str::excerpt($session['user_agent'], 60)) ?>
                </span>
              </span>
              <span class="tiny muted nowrap"><?= Str::e(Str::timeAgo($session['created_at'])) ?></span>
            </li>
          <?php endforeach; ?>
        </ul>

        <form method="post" class="mt-3" data-confirm="Sign out every other device?">
          <?= Csrf::field() ?>
          <input type="hidden" name="action" value="sessions">
          <button class="btn btn-outline btn-block" type="submit">Sign out everywhere else</button>
        </form>
      </div>
    </div>
  </div>

<?php elseif ($tab === 'notifications'): ?>
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="notifications">

    <div class="card-head"><h2>Notifications</h2></div>
    <div class="card-body">
      <?php
      $switches = [
          ['notify_email',   'email',            'Email notifications', 'Account and billing emails always send.'],
          ['notify_partner', 'partner_activity', 'Partner activity',    'When your partner logs an entry or replies.'],
          ['notify_weekly',  'weekly_report',    'Weekly fairness report', 'A summary of both sides, every Monday.'],
          ['notify_push',    'push',             'In-app notifications', 'Reminders for check-ins and trips.'],
      ];
      foreach ($switches as [$field, $key, $label, $hint]): ?>
        <label class="switch">
          <span>
            <span class="bold"><?= $label ?></span>
            <span class="small muted" style="display:block"><?= $hint ?></span>
          </span>
          <input type="checkbox" name="<?= $field ?>" value="1" <?= ($prefs[$key] ?? true) ? 'checked' : '' ?>>
        </label>
      <?php endforeach; ?>

      <button class="btn mt-3" type="submit">Save preferences</button>
    </div>
  </form>

<?php else: ?>
  <div class="grid grid-2">
    <div class="card">
      <div class="card-head"><h2>Export your data</h2></div>
      <div class="card-body">
        <p class="small muted">
          Download everything you have entered as JSON — emotions, fairness entries, check-ins,
          assessments, expenses, gifts, trips and documents.
        </p>
        <a class="btn btn-outline mt-3" href="/dashboard/export">Download my data</a>
      </div>
    </div>

    <form method="post" class="card card-danger" data-confirm="This closes your account. Are you certain?">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="delete_account">

      <div class="card-head"><h2 class="tone-danger">Delete your account</h2></div>
      <div class="card-body">
        <p class="small muted">
          This removes your private entries, ends your access to shared spaces and cancels future billing.
          Financial records required by law are kept. It cannot be undone.
        </p>

        <div class="field mt-3">
          <label for="confirm_delete">Type DELETE to confirm</label>
          <input class="input" id="confirm_delete" name="confirm" placeholder="DELETE" autocomplete="off">
        </div>

        <button class="btn btn-danger mt-2" type="submit">Delete my account</button>
      </div>
    </form>
  </div>
<?php endif; ?>

<?php View::end(); ?>
