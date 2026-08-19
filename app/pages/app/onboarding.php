<?php
declare(strict_types=1);

$user = Auth::require();

// Somebody who already has a space does not need this page.
if (Auth::couple() !== null) {
    Response::redirect('/dashboard');
}

if (Request::isPost()) {
    $name = Request::input('name') ?: 'Our space';
    $coupleId = Str::uuid();

    Db::begin();

    $created = Db::insert('couples', [
        'id'                => $coupleId,
        'name'              => mb_substr($name, 0, 150),
        'relationship_type' => Request::input('relationship_type', 'romantic'),
        'status'            => 'active',
        'anniversary_date'  => Request::date('anniversary_date'),
        'invite_code'       => strtoupper(bin2hex(random_bytes(4))),
        'owner_id'          => $user['id'],
        'currency'          => Currency::normalise($user['currency']),
        'timezone'          => $user['timezone'] ?: 'UTC',
    ]);

    if ($created === null) {
        Db::rollback();
        Flash::error('We could not create your space. Please try again.');
        Response::redirect('/onboarding');
    }

    Db::insert('couple_members', [
        'couple_id'    => $coupleId,
        'user_id'      => $user['id'],
        'member_role'  => 'owner',
        'display_role' => Request::input('display_role') ?: 'Partner A',
    ]);

    Db::insert('conversations', [
        'couple_id' => $coupleId,
        'kind'      => 'direct',
        'title'     => 'Private chat',
    ]);

    Db::run('UPDATE profiles SET onboarded_at = UTC_TIMESTAMP() WHERE id = ?', [$user['id']]);
    Db::commit();

    Audit::record('couple.create', 'couple', $coupleId, 'Created relationship space "' . $name . '"');

    // Invite the partner straight away when an address was given.
    $partnerEmail = strtolower(Request::input('partner_email'));
    if (filter_var($partnerEmail, FILTER_VALIDATE_EMAIL) && $partnerEmail !== strtolower($user['email'])) {
        $token = Str::token(24);

        Db::insert('couple_invitations', [
            'couple_id'    => $coupleId,
            'email'        => $partnerEmail,
            'token'        => $token,
            'invited_by'   => $user['id'],
            'display_role' => Request::input('partner_role') ?: 'Partner B',
            'expires_at'   => Str::inDays(14),
        ]);

        Mailer::template('partner-invite', $partnerEmail, [
            'inviter_name'      => $user['full_name'] ?: $user['email'],
            'invite_url'        => Config::siteUrl('/invite/' . $token),
            'relationship_type' => Request::input('relationship_type', 'romantic'),
            'message'           => 'Join me on FairCouples so we each track our own side.',
        ]);

        Flash::success('Space created, and the invitation is on its way to ' . $partnerEmail . '.');
    } else {
        Flash::success('Your space is ready. Invite your partner whenever you like.');
    }

    Response::redirect('/dashboard');
}

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

View::begin('layouts/bare', ['title' => 'Set up your space', 'no_index' => true]);
?>

<p class="eyebrow">Step 1 of 1</p>
<h1>Create your relationship space</h1>
<p class="muted mt-2">
  A space holds two people. You each log your own entries — nobody answers on the other&rsquo;s behalf —
  and the fairness report is built from both sides.
</p>

<form method="post" class="card mt-4">
  <?= Csrf::field() ?>
  <div class="card-body">
    <div class="field">
      <label for="name">Name this space</label>
      <input class="input" id="name" name="name" maxlength="150" placeholder="Alex &amp; Sam" autofocus>
      <span class="hint">Only the two of you ever see it.</span>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="relationship_type">Relationship type</label>
        <select class="select" id="relationship_type" name="relationship_type">
          <?= View::options($relationshipTypes, 'romantic') ?>
        </select>
      </div>

      <div class="field">
        <label for="display_role">What should we call you?</label>
        <input class="input" id="display_role" name="display_role" maxlength="60" placeholder="Partner A">
      </div>
    </div>

    <div class="field">
      <label for="anniversary_date">Anniversary (optional)</label>
      <input class="input" type="date" id="anniversary_date" name="anniversary_date">
    </div>

    <hr class="divider">

    <h2 style="font-size:1.05rem">Invite the other person</h2>
    <p class="small muted mt-1">
      You can skip this and do it later — but the report only means something once you both have entries.
    </p>

    <div class="field-row mt-2">
      <div class="field">
        <label for="partner_email">Their email</label>
        <input class="input" type="email" id="partner_email" name="partner_email" autocomplete="off">
      </div>
      <div class="field">
        <label for="partner_role">What should we call them?</label>
        <input class="input" id="partner_role" name="partner_role" maxlength="60" placeholder="Partner B">
      </div>
    </div>

    <button class="btn btn-lg btn-block mt-3" type="submit">Create my space</button>
  </div>
</form>

<div class="alert alert-info mt-3">
  <div>
    <strong>Already been invited?</strong>
    Open the link in that email, or enter the space&rsquo;s code at
    <a href="/dashboard/partner">Partner &amp; space</a>.
  </div>
</div>

<?php View::end(); ?>
