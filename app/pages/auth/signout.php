<?php
declare(strict_types=1);

if (Request::isPost()) {
    Auth::signOut();
    Response::redirect('/signin?notice=signed-out');
}

// A GET lands here only if somebody typed the URL; ask before signing out, so
// a stray link can never end a session.
View::begin('layouts/auth', ['title' => 'Sign out', 'no_index' => true]);
?>

<h1 style="font-size:1.4rem">Sign out?</h1>
<p class="small muted mt-2">This ends the session on this device only.</p>

<form method="post" class="mt-3">
  <?= Csrf::field() ?>
  <button class="btn btn-block" type="submit">Yes, sign me out</button>
</form>

<p class="center small mt-2"><a href="/dashboard">Stay signed in</a></p>

<?php View::end(); ?>
