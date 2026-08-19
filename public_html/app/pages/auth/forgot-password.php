<?php
declare(strict_types=1);

$sent = false;

if (Request::isPost()) {
    $email = Request::input('email');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Flash::error('Enter a valid email address.');
        Response::redirect('/forgot-password');
    }

    // Always reports success, so the form cannot be used to discover accounts.
    Auth::requestPasswordReset($email);
    $sent = true;
}

View::begin('layouts/auth', [
    'title'    => 'Reset your password',
    'no_index' => true,
]);
?>

<?php if ($sent): ?>
  <div class="center">
    <p style="font-size:2.5rem">📮</p>
    <h1 style="font-size:1.4rem">Check your inbox</h1>
    <p class="small muted mt-2">
      If an account exists for <strong><?= Str::e(Request::input('email')) ?></strong>,
      a reset link is on its way. It expires in 60 minutes.
    </p>
    <p class="small mt-3"><a href="/signin">Back to sign in</a></p>
  </div>
<?php else: ?>
  <h1 style="font-size:1.5rem">Reset your password</h1>
  <p class="small muted mt-1">Enter your email and we will send a link to choose a new one.</p>

  <form method="post" class="mt-3">
    <?= Csrf::field() ?>
    <div class="field">
      <label for="email">Email address <span class="required">*</span></label>
      <input class="input" type="email" id="email" name="email" required autocomplete="email" autofocus>
    </div>
    <button class="btn btn-lg btn-block mt-2" type="submit">Send reset link</button>
  </form>

  <p class="center small muted mt-3">Remembered it? <a href="/signin">Sign in</a></p>
<?php endif; ?>

<?php View::end(); ?>
