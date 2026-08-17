<?php
declare(strict_types=1);

/** One-shot messages and remembered form input across a redirect. */
final class Flash
{
    public static function success(string $message): void
    {
        self::add('success', $message);
    }

    public static function error(string $message): void
    {
        self::add('danger', $message);
    }

    public static function info(string $message): void
    {
        self::add('info', $message);
    }

    public static function warning(string $message): void
    {
        self::add('warning', $message);
    }

    private static function add(string $tone, string $message): void
    {
        $_SESSION['flash'][] = ['tone' => $tone, 'message' => $message];
    }

    /** @return array<int,array{tone:string,message:string}> */
    public static function take(): array
    {
        $messages = $_SESSION['flash'] ?? [];
        unset($_SESSION['flash']);
        return is_array($messages) ? $messages : [];
    }

    /** Keeps what was typed so a rejected form can be redisplayed filled in. */
    public static function remember(array $input, array $except = ['_token', 'password', 'confirm', 'current_password']): void
    {
        foreach ($except as $key) {
            unset($input[$key]);
        }
        $_SESSION['old'] = $input;
    }

    /** @return mixed */
    public static function old(string $key, $fallback = '')
    {
        return $_SESSION['old'][$key] ?? $fallback;
    }

    public static function clearOld(): void
    {
        unset($_SESSION['old']);
    }

    /** Field-level errors, keyed by input name. */
    public static function fieldError(string $field, string $message): void
    {
        $_SESSION['errors'][$field] = $message;
    }

    public static function errorFor(string $field): ?string
    {
        return $_SESSION['errors'][$field] ?? null;
    }

    public static function clearErrors(): void
    {
        unset($_SESSION['errors']);
    }
}
