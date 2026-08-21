<?php
declare(strict_types=1);

/**
 * Step 2 of "Sign in with Google": Google has redirected back with a one-time
 * code. Verify the state, swap the code for the user's profile, then sign them
 * in (creating the account on first use).
 */

if (Auth::check()) {
    Response::redirect('/dashboard');
}

$saved = $_SESSION['google_oauth'] ?? null;
unset($_SESSION['google_oauth']);

$fail = static function (string $message): void {
    Flash::error($message);
    Response::redirect('/signin');
};

if (!GoogleAuth::enabled()) {
    $fail('Google sign-in is not available right now.');
}

// The visitor cancelled, or Google refused.
if (Request::input('error') !== '') {
    $fail('Google sign-in was cancelled.');
}

// State must match the value we set before the redirect.
$state = Request::input('state');
if (!is_array($saved) || ($saved['state'] ?? '') === '' || !hash_equals((string) $saved['state'], $state)) {
    $fail('That Google sign-in link had expired. Please try again.');
}

// Links older than ten minutes are treated as stale.
if ((time() - (int) ($saved['at'] ?? 0)) > 600) {
    $fail('That Google sign-in link had expired. Please try again.');
}

$code = Request::input('code');
if ($code === '') {
    $fail('Google did not return a sign-in code. Please try again.');
}

$token = GoogleAuth::exchangeCode($code);
if (!$token['ok']) {
    $fail('We could not complete Google sign-in. Please try again or use your email and password.');
}

$info = GoogleAuth::userInfo($token['access_token']);
if (!$info['ok']) {
    $fail($info['error'] ?? 'We could not read your Google profile.');
}

$result = Auth::signInWithGoogle($info['profile']);
if (!$result['ok']) {
    $fail($result['error'] ?? 'We could not sign you in with Google.');
}

Flash::clearOld();
Flash::clearErrors();

$isNew    = !empty($result['new']);
$plan     = (string) ($saved['plan'] ?? '');
$interval = (string) ($saved['interval'] ?? 'year');
$invite   = (string) ($saved['invite'] ?? '');
$next     = (string) ($saved['next'] ?? '/dashboard');

if ($invite !== '') {
    Response::redirect('/invite/' . rawurlencode($invite));
}
if ($plan !== '') {
    Response::redirect('/checkout?plan=' . rawurlencode($plan) . '&interval=' . rawurlencode($interval));
}
if ($isNew) {
    Response::redirect('/onboarding');
}

Response::redirect($next !== '' ? $next : '/dashboard');
