<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$couple   = $context['couple'];
$coupleId = $couple['id'];
$isOwner  = $couple['owner_id'] === $user['id'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'invite') {
        $email = strtolower(Request::input('email'));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Flash::error('Enter a valid email address.');
            Response::redirect('/dashboard/partner');
        }
        if ($email === strtolower($user['email'])) {
            Flash::error('That is your own address.');
            Response::redirect('/dashboard/partner');
        }
        if (count($context['members']) >= 2) {
            Flash::error('This space already has two members. Remove one first.');
            Response::redirect('/dashboard/partner');
        }

        $token = Str::token(24);

        Db::insert('couple_invitations', [
            'couple_id'    => $coupleId,
            'email'        => $email,
            'token'        => $token,
            'invited_by'   => $user['id'],
            'display_role' => Request::input('display_role') ?: 'Partner B',
            'message'      => Request::nullable('message'),
            'expires_at'   => Str::inDays(14),
        ]);

        Mailer::template('partner-invite', $email, [
            'inviter_name'      => $user['full_name'] ?: $user['email'],
            'invite_url'        => Config::siteUrl('/invite/' . $token),
            'relationship_type' => $couple['relationship_type'],
            'message'           => Request::input('message') ?: 'Join me on FairCouples so we each track our own side.',
        ]);

        Audit::record('couple.invite', 'couple', $coupleId, 'Invited ' . $email);

        Flash::success('Invitation sent to ' . $email . '.');
        Response::redirect('/dashboard/partner');
    }

    if ($action === 'revoke') {
        Db::run(
            'UPDATE couple_invitations SET status = "revoked" WHERE id = ? AND couple_id = ?',
            [Request::input('id'), $coupleId]
        );
        Flash::success('Invitation revoked.');
        Response::redirect('/dashboard/partner');
    }

    if ($action === 'update_space') {
        Db::update('couples', $coupleId, [
            'name'               => mb_substr(Request::input('name', $couple['name'] ?? ''), 0, 150),
            'relationship_type'  => Request::input('relationship_type', $couple['relationship_type']),
            'fairness_weighting' => Request::input('fairness_weighting', 'equal'),
            'currency'           => Currency::normalise(Request::input('currency', $couple['currency'])),
            'anniversary_date'   => Request::date('anniversary_date'),
        ]);
        Flash::success('Space updated.');
        Response::redirect('/dashboard/partner');
    }

    if ($action === 'update_role') {
        $memberId = Request::input('member_id');
        Db::run(
            'UPDATE couple_members SET display_role = ? WHERE id = ? AND couple_id = ? AND user_id = ?',
            [mb_substr(Request::input('display_role'), 0, 60), $memberId, $coupleId, $user['id']]
        );
        Flash::success('Saved.');
        Response::redirect('/dashboard/partner');
    }

    if ($action === 'remove_member') {
        $targetId = Request::input('user_id');
        $isSelf = $targetId === $user['id'];

        // The owner can remove the other person; anybody can remove themselves.
        if (!$isOwner && !$isSelf) {
            Flash::error('Only the person who created this space can remove the other member.');
            Response::redirect('/dashboard/partner');
        }
        if ($isOwner && $isSelf) {
            Flash::error('You own this space. Transfer it or delete the space instead.');
            Response::redirect('/dashboard/partner');
        }

        Db::run(
            'UPDATE couple_members SET removed_at = UTC_TIMESTAMP(), removed_by = ?
              WHERE couple_id = ? AND user_id = ?',
            [$user['id'], $coupleId, $targetId]
        );

        $removed = Db::one('SELECT email, full_name FROM profiles WHERE id = ? LIMIT 1', [$targetId]);
        if ($removed && $removed['email']) {
            Mailer::template('account-removed', $removed['email'], [
                'name'        => $removed['full_name'] ?: 'there',
                'couple_name' => $couple['name'] ?: 'your shared space',
            ], $targetId);
        }

        Audit::notify(
            $targetId,
            'You were removed from a shared space',
            'Your own private entries are still in your account.',
            '/dashboard',
            'couple',
            '⚠️',
            $coupleId
        );

        Audit::record('couple.member.remove', 'couple', $coupleId, 'Removed member ' . $targetId);

        Flash::success($isSelf ? 'You have left the space.' : 'Partner removed. Their access ended immediately.');
        Response::redirect($isSelf ? '/onboarding' : '/dashboard/partner');
    }
}

$invitations = Db::all(
    'SELECT * FROM couple_invitations WHERE couple_id = ? ORDER BY created_at DESC LIMIT 10',
    [$coupleId]
);

$relationshipTypes = [
    'romantic'      => 'Dating / partners',
    'engaged'       => 'Engaged',
    'married'       => 'Married',
    'long_distance' => 'Long-distance',
    'parent_child'  => 'Parent & child',
    'siblings'      => 'Siblings',
    'friends'       => 'Close friends',
    'family'        => 'Other family',
];

View::begin('layouts/app', ['title' => 'Partner & space', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Partner &amp; space</h1>
  <p>Who is in this space, how it is set up, and how to invite the other person.</p>
</div>

<div class="grid grid-sidebar">
  <div class="stack">
    <div class="card">
      <div class="card-head"><h2>Members</h2></div>
      <div class="card-body stack">
        <?php foreach ($context['members'] as $member): ?>
          <div class="row-between">
            <div class="row" style="gap:0.75rem">
              <?= View::avatar($member['avatar_url'] ?? null, $member['full_name'] ?? null, 44) ?>
              <div>
                <p class="bold">
                  <?= Str::e($member['full_name'] ?: $member['email']) ?>
                  <?php if ($member['user_id'] === $user['id']): ?><span class="badge">you</span><?php endif; ?>
                  <?php if ($member['member_role'] === 'owner'): ?><span class="badge badge-primary">owner</span><?php endif; ?>
                </p>
                <p class="tiny muted">
                  <?= Str::e($member['email']) ?>
                  · <?= Str::e($member['display_role'] ?: 'Member') ?>
                  <?php if ($member['income_share'] !== null): ?>
                    · <?= number_format((float) $member['income_share'], 0) ?>% income share
                  <?php endif; ?>
                </p>
              </div>
            </div>

            <?php if ($isOwner && $member['user_id'] !== $user['id']): ?>
              <form method="post"
                    data-confirm="Remove this person from the space? Their access ends immediately.">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="remove_member">
                <input type="hidden" name="user_id" value="<?= Str::e($member['user_id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">Remove</button>
              </form>
            <?php elseif (!$isOwner && $member['user_id'] === $user['id']): ?>
              <form method="post" data-confirm="Leave this space? Your own private entries stay in your account.">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="remove_member">
                <input type="hidden" name="user_id" value="<?= Str::e($user['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">Leave</button>
              </form>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>

        <?php if (count($context['members']) < 2): ?>
          <div class="alert alert-warning">
            <div>
              <strong>Waiting for the second person.</strong>
              A fairness report compares two sides. Until they join, the numbers only reflect yours.
            </div>
          </div>
        <?php endif; ?>
      </div>
    </div>

    <?php if (count($context['members']) < 2): ?>
      <form method="post" class="card">
        <?= Csrf::field() ?>
        <input type="hidden" name="action" value="invite">

        <div class="card-head"><h2>Invite your partner</h2></div>
        <div class="card-body">
          <div class="field-row">
            <div class="field">
              <label for="email">Their email <span class="required">*</span></label>
              <input class="input" type="email" id="email" name="email" required>
            </div>
            <div class="field">
              <label for="display_role">What should we call them?</label>
              <input class="input" id="display_role" name="display_role" maxlength="60" placeholder="Partner B">
            </div>
          </div>

          <div class="field">
            <label for="message">A note (optional)</label>
            <textarea class="textarea" rows="2" id="message" name="message"
                      placeholder="Let's both do this properly — you get your own login."></textarea>
          </div>

          <button class="btn mt-2" type="submit">Send the invitation</button>
        </div>
      </form>
    <?php endif; ?>

    <?php if ($invitations !== []): ?>
      <div class="card">
        <div class="card-head"><h2>Invitations</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Sent to</th><th>Status</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              <?php foreach ($invitations as $invitation): ?>
                <tr>
                  <td class="small"><?= Str::e($invitation['email']) ?></td>
                  <td>
                    <?php
                    $tone = match ($invitation['status']) {
                        'accepted' => 'success',
                        'pending'  => 'warning',
                        default    => 'outline',
                    };
                    ?>
                    <span class="badge badge-<?= $tone ?>"><?= Str::e($invitation['status']) ?></span>
                  </td>
                  <td class="small muted nowrap"><?= Str::e(Str::date($invitation['expires_at'])) ?></td>
                  <td class="right">
                    <?php if ($invitation['status'] === 'pending'): ?>
                      <button class="btn btn-sm btn-ghost" type="button"
                              data-copy="<?= Str::e(Config::siteUrl('/invite/' . $invitation['token'])) ?>">
                        Copy link
                      </button>
                      <form method="post" style="display:inline">
                        <?= Csrf::field() ?>
                        <input type="hidden" name="action" value="revoke">
                        <input type="hidden" name="id" value="<?= Str::e($invitation['id']) ?>">
                        <button class="btn btn-sm btn-ghost" type="submit">Revoke</button>
                      </form>
                    <?php endif; ?>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <aside class="stack">
    <div class="card">
      <div class="card-body">
        <h2 style="font-size:1rem">Join by code</h2>
        <p class="small muted mt-2">If email is awkward, give them this code instead.</p>
        <p class="mono center mt-2" style="font-size:1.5rem;letter-spacing:0.15em">
          <?= Str::e($couple['invite_code']) ?>
        </p>
        <button class="btn btn-sm btn-outline btn-block mt-2" type="button"
                data-copy="<?= Str::e(Config::siteUrl('/join/' . $couple['invite_code'])) ?>">
          Copy the join link
        </button>
      </div>
    </div>

    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="update_space">

      <div class="card-head"><h2>Space settings</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="name">Space name</label>
          <input class="input" id="name" name="name" maxlength="150" value="<?= Str::e($couple['name'] ?? '') ?>">
        </div>

        <div class="field">
          <label for="relationship_type">Relationship type</label>
          <select class="select" id="relationship_type" name="relationship_type">
            <?= View::options($relationshipTypes, $couple['relationship_type']) ?>
          </select>
        </div>

        <div class="field">
          <label for="currency">Shared currency</label>
          <select class="select" id="currency" name="currency">
            <?php foreach (Currency::LIST as $code => $meta): ?>
              <option value="<?= Str::e($code) ?>" <?= $couple['currency'] === $code ? 'selected' : '' ?>>
                <?= Str::e($meta['flag'] . ' ' . $code) ?>
              </option>
            <?php endforeach; ?>
          </select>
          <span class="hint">Used for shared budgets and trip costs.</span>
        </div>

        <div class="field">
          <label for="anniversary_date">Anniversary</label>
          <input class="input" type="date" id="anniversary_date" name="anniversary_date"
                 value="<?= Str::e(substr((string) $couple['anniversary_date'], 0, 10)) ?>">
        </div>

        <button class="btn btn-outline btn-block mt-2" type="submit">Save space</button>
      </div>
    </form>

    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="update_role">
      <input type="hidden" name="member_id" value="<?= Str::e($context['me']['id'] ?? '') ?>">

      <div class="card-head"><h2>Your label</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="display_role_me">What should we call you here?</label>
          <input class="input" id="display_role_me" name="display_role" maxlength="60"
                 value="<?= Str::e($context['me']['display_role'] ?? '') ?>">
        </div>
        <button class="btn btn-outline btn-block mt-2" type="submit">Save</button>
      </div>
    </form>
  </aside>
</div>

<?php View::end(); ?>
