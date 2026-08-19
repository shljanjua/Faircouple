<?php
declare(strict_types=1);

$token = $params['token'];

$invitation = Db::one(
    'SELECT i.*, c.name AS couple_name, c.relationship_type
       FROM couple_invitations i
       JOIN couples c ON c.id = i.couple_id
      WHERE i.token = ? LIMIT 1',
    [$token]
);

$invalid = !$invitation
    || $invitation['status'] !== 'pending'
    || strtotime((string) $invitation['expires_at']) < time();

// Not signed in? Send them to sign up with the address the invite was sent to.
if (!Auth::check()) {
    Response::redirect($invalid ? '/signup' : '/signup?invite=' . rawurlencode($token));
}

$user = Auth::user();

if (Request::isPost() && !$invalid) {
    $members = Db::all(
        'SELECT user_id FROM couple_members WHERE couple_id = ? AND removed_at IS NULL',
        [$invitation['couple_id']]
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
        [Str::uuid(), $invitation['couple_id'], $user['id'], $invitation['display_role'] ?: 'Partner B']
    );

    Db::run(
        'UPDATE couple_invitations SET status = "accepted", accepted_at = UTC_TIMESTAMP(), accepted_by = ? WHERE id = ?',
        [$user['id'], $invitation['id']]
    );
    Db::run('UPDATE couples SET status = "active" WHERE id = ?', [$invitation['couple_id']]);
    Db::run('UPDATE profiles SET onboarded_at = UTC_TIMESTAMP() WHERE id = ?', [$user['id']]);

    Audit::notify(
        $invitation['invited_by'],
        ($user['full_name'] ?: $user['email']) . ' joined your space',
        'You can both start logging entries now.',
        '/dashboard/fairness',
        'couple',
        '💗',
        $invitation['couple_id']
    );

    Flash::success('You are in. Log your first week whenever you are ready.');
    Response::redirect('/dashboard');
}

View::begin('layouts/auth', ['title' => 'Accept your invitation', 'no_index' => true]);
?>

<?php if ($invalid): ?>
  <div class="center">
    <p style="font-size:2.5rem">⌛</p>
    <h1 style="font-size:1.4rem">This invitation is no longer valid</h1>
    <p class="small muted mt-2">
      It may have expired, been revoked, or already been accepted. Ask your partner to send a new one.
    </p>
    <a class="btn mt-3" href="/dashboard">Go to my dashboard</a>
  </div>
<?php else: ?>
  <h1 style="font-size:1.4rem">Join <?= Str::e($invitation['couple_name'] ?: 'this relationship space') ?></h1>
  <p class="small muted mt-2">
    You have been invited as <strong><?= Str::e($invitation['display_role'] ?: 'Partner B') ?></strong>.
    You will log your own entries — nobody answers on your behalf.
  </p>

  <?php if ($invitation['message']): ?>
    <blockquote class="alert alert-info mt-3">
      <div><?= Str::e($invitation['message']) ?></div>
    </blockquote>
  <?php endif; ?>

  <?php if (strtolower($user['email']) !== strtolower((string) $invitation['email'])): ?>
    <div class="alert alert-warning mt-3">
      <div>
        This invitation was sent to <strong><?= Str::e($invitation['email']) ?></strong>
        but you are signed in as <strong><?= Str::e($user['email']) ?></strong>.
        Accepting links this space to your current account.
      </div>
    </div>
  <?php endif; ?>

  <form method="post" class="mt-3">
    <?= Csrf::field() ?>
    <button class="btn btn-lg btn-block" type="submit">Accept and join</button>
  </form>

  <p class="center tiny muted mt-3">
    By joining you agree to the <a href="/terms-of-service">Terms</a> and
    <a href="/privacy-policy">Privacy Policy</a>.
  </p>
<?php endif; ?>

<?php View::end(); ?>
