<?php
declare(strict_types=1);

$token  = Request::input('token');
$resend = Request::input('resend');

/* A confirmation link was clicked. */
if ($token !== '') {
    $result = Auth::verifyEmail($token);

    if ($result['ok']) {
        Flash::success('Email confirmed. Welcome to ' . Settings::text('site_name', 'FairCouples') . '.');
        Response::redirect('/onboarding');
    }

    Flash::error($result['error']);
}

/* Somebody asked for another confirmation email. */
if (Request::isPost()) {
    $email = strtolower(Request::input('email'));

    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $row = Db::one(
            'SELECT u.id, u.email, u.email_verified_at, p.full_name
               FROM users u JOIN profiles p ON p.id = u.id
              WHERE u.email = ? LIMIT 1',
            [$email]
        );

        if ($row && !$row['email_verified_at']) {
            Auth::sendVerification($row['id'], $row['email'], $row['full_name']);
        }
    }

    // Always the same answer, so this cannot be used to find accounts.
    Flash::success('If that address still needs confirming, a new link is on its way.');
    Response::redirect('/verify-email');
}

View::begin('layouts/auth', ['title' => 'Confirm your email', 'no_index' => true]);
?>

<h1 style="font-size:1.5rem">Confirm your email</h1>
<p class="small muted mt-1">
  Click the link we emailed you. If it has expired, send yourself a fresh one below.
</p>

<form method="post" class="mt-3">
  <?= Csrf::field() ?>
  <div class="field">
    <label for="email">Email address</label>
    <input class="input" type="email" id="email" name="email" required autocomplete="email"
           value="<?= Str::e($resend) ?>" placeholder="you@example.com">
  </div>
  <button class="btn btn-block mt-2" type="submit">Send the confirmation link again</button>
</form>

<p class="center small muted mt-3">
  Already confirmed? <a href="/signin">Sign in</a>
</p>

<?php View::end(); ?>
