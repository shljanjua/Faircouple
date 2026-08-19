<?php
declare(strict_types=1);

if (Auth::check()) {
    Response::redirect(Request::safeNext('/dashboard'));
}

$next = Request::safeNext('/dashboard');

if (Request::isPost()) {
    $result = Auth::signIn(Request::input('email'), Request::raw('password'));

    if (!$result['ok']) {
        Flash::error($result['error']);
        Flash::remember(['email' => Request::input('email')]);
        Response::redirect('/signin?next=' . urlencode($next));
    }

    Flash::clearOld();
    Response::redirect($next);
}

$notice = Request::input('notice');

View::begin('layouts/auth', [
    'title'       => 'Sign in',
    'description' => 'Sign in to FairCouples to see this week’s balance report.',
    'no_index'    => true,
]);
?>

<h1 style="font-size:1.5rem">Welcome back</h1>
<p class="small muted mt-1">Sign in to see this week&rsquo;s balance report.</p>

<?php if ($notice === 'verified'): ?>
  <div class="alert alert-success mt-3"><div>Email confirmed. You can sign in now.</div></div>
<?php elseif ($notice === 'password-updated'): ?>
  <div class="alert alert-success mt-3"><div>Password updated. Use it to sign in below.</div></div>
<?php elseif ($notice === 'signed-out'): ?>
  <div class="alert alert-info mt-3"><div>You are signed out.</div></div>
<?php endif; ?>

<form method="post" class="mt-3">
  <?= Csrf::field() ?>
  <input type="hidden" name="next" value="<?= Str::e($next) ?>">

  <div class="field">
    <label for="email">Email address <span class="required">*</span></label>
    <input class="input" type="email" id="email" name="email" required autocomplete="email" autofocus
           value="<?= Str::e(Flash::old('email')) ?>">
  </div>

  <div class="field">
    <label for="password">Password <span class="required">*</span></label>
    <input class="input" type="password" id="password" name="password" required autocomplete="current-password">
  </div>

  <p class="right small mt-2"><a href="/forgot-password">Forgot your password?</a></p>

  <button class="btn btn-lg btn-block mt-2" type="submit">Sign in</button>
</form>

<p class="center small muted mt-3">
  New to <?= Str::e(Settings::text('site_name', 'FairCouples')) ?>?
  <a href="/signup">Create a free account</a>
</p>

<?php View::end(); Flash::clearOld(); ?>
