<?php
declare(strict_types=1);

/** Joining with the space's short code, rather than an emailed link. */

$code = strtoupper($params['code']);

if (!Auth::check()) {
    Response::redirect('/signup?next=' . urlencode('/join/' . $code));
}

$user = Auth::user();
$couple = Db::one('SELECT id, name, relationship_type FROM couples WHERE invite_code = ? LIMIT 1', [$code]);

if (Request::isPost() && $couple) {
    $members = Db::all(
        'SELECT user_id FROM couple_members WHERE couple_id = ? AND removed_at IS NULL',
        [$couple['id']]
    );

    $alreadyIn = false;
    foreach ($members as $member) {
        if ($member['user_id'] === $user['id']) { $alreadyIn = true; break; }
    }

    if ($alreadyIn) {
        Flash::info('You are already a member of this space.');
        Response::redirect('/dashboard');
    }

    if (count($members) >= 2) {
        Flash::error('This space already has two members.');
        Response::redirect('/dashboard');
    }

    Db::run(
        'INSERT INTO couple_members (id, couple_id, user_id, member_role, display_role)
         VALUES (?, ?, ?, "partner", ?)
         ON DUPLICATE KEY UPDATE removed_at = NULL, removed_by = NULL, display_role = VALUES(display_role)',
        [Str::uuid(), $couple['id'], $user['id'], Request::input('display_role') ?: 'Partner B']
    );

    Db::run('UPDATE couples SET status = "active" WHERE id = ?', [$couple['id']]);
    Db::run('UPDATE profiles SET onboarded_at = UTC_TIMESTAMP() WHERE id = ?', [$user['id']]);

    Audit::record('couple.join', 'couple', $couple['id'], 'Joined with the invite code');

    Flash::success('You are in.');
    Response::redirect('/dashboard');
}

View::begin('layouts/auth', ['title' => 'Join a relationship space', 'no_index' => true]);
?>

<?php if (!$couple): ?>
  <div class="center">
    <p style="font-size:2.5rem">🔎</p>
    <h1 style="font-size:1.4rem">Code not recognised</h1>
    <p class="small muted mt-2">
      Check the code with your partner, or ask them to email you an invitation instead.
    </p>
    <a class="btn mt-3" href="/dashboard">Go to my dashboard</a>
  </div>
<?php else: ?>
  <div class="center">
    <h1 style="font-size:1.4rem">Join <?= Str::e($couple['name'] ?: 'this space') ?></h1>
    <p class="small muted mt-2">
      You will get your own entries and your own private notes. Nobody answers on your behalf.
    </p>
  </div>

  <form method="post" class="mt-3">
    <?= Csrf::field() ?>
    <div class="field">
      <label for="display_role">What should we call you?</label>
      <input class="input" id="display_role" name="display_role" maxlength="60" placeholder="Partner B">
    </div>
    <button class="btn btn-lg btn-block mt-2" type="submit">Join this space</button>
  </form>
<?php endif; ?>

<?php View::end(); ?>
