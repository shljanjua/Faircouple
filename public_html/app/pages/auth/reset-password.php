<?php
declare(strict_types=1);

$token = Request::input('token');

if (Request::isPost()) {
    $result = Auth::resetPassword($token, Request::raw('password'), Request::raw('confirm'));

    if (!$result['ok']) {
        Flash::error($result['error']);
        Response::redirect('/reset-password?token=' . urlencode($token));
    }

    Flash::success('Password updated. Sign in with your new password.');
    Response::redirect('/signin?notice=password-updated');
}

View::begin('layouts/auth', ['title' => 'Choose a new password', 'no_index' => true]);
?>

<h1 style="font-size:1.5rem">Choose a new password</h1>
<p class="small muted mt-1">Every other device will be signed out once it changes.</p>

<?php if ($token === ''): ?>
  <div class="alert alert-warning mt-3">
    <div>
      This link is missing its token. Request a new one from the
      <a href="/forgot-password">forgot-password page</a>.
    </div>
  </div>
<?php else: ?>
  <form method="post" class="mt-3">
    <?= Csrf::field() ?>
    <input type="hidden" name="token" value="<?= Str::e($token) ?>">

    <div class="field">
      <label for="password">New password <span class="required">*</span></label>
      <input class="input" type="password" id="password" name="password" required
             autocomplete="new-password" minlength="8" autofocus>
      <span class="hint">At least 8 characters, with an uppercase letter and a number.</span>
    </div>

    <div class="field">
      <label for="confirm">Confirm new password <span class="required">*</span></label>
      <input class="input" type="password" id="confirm" name="confirm" required autocomplete="new-password">
    </div>

    <button class="btn btn-lg btn-block mt-3" type="submit">Update password</button>
  </form>
<?php endif; ?>

<?php View::end(); ?>
