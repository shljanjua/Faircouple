<?php
declare(strict_types=1);

/**
 * Step 1 of "Sign in with Google": send the visitor to Google's consent screen.
 * A random state token is stashed in the session and echoed back by Google so
 * the callback can prove the round-trip was one we started.
 */

if (Auth::check()) {
    Response::redirect('/dashboard');
}

if (!GoogleAuth::enabled()) {
    Flash::error('Google sign-in is not available right now.');
    Response::redirect('/signin');
}

$state = bin2hex(random_bytes(16));

$_SESSION['google_oauth'] = [
    'state'    => $state,
    'next'     => Request::safeNext('/dashboard'),
    'plan'     => Request::input('plan'),
    'interval' => Request::input('interval', 'year'),
    'invite'   => Request::input('invite'),
    'at'       => time(),
];

Response::redirect(GoogleAuth::authUrl($state));
