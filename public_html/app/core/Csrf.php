<?php
declare(strict_types=1);

/** One token per session, checked on every POST. */
final class Csrf
{
    public static function token(): string
    {
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = Str::token(24);
        }
        return (string) $_SESSION['csrf'];
    }

    /** The hidden input every form includes. */
    public static function field(): string
    {
        return '<input type="hidden" name="_token" value="' . Str::e(self::token()) . '">';
    }

    public static function valid(): bool
    {
        $sent = (string) ($_POST['_token'] ?? $_GET['_token'] ?? '');
        $known = (string) ($_SESSION['csrf'] ?? '');
        return $sent !== '' && $known !== '' && hash_equals($known, $sent);
    }

    /** Stops the request unless the token matches. */
    public static function check(): void
    {
        if (!Request::isPost()) {
            return;
        }
        if (self::valid()) {
            return;
        }

        if (Request::isAjax()) {
            Response::json(['ok' => false, 'error' => 'Your session expired. Reload the page and try again.'], 419);
        }

        Flash::error('Your session expired. Please try again.');
        Response::back('/');
    }
}
