<?php
declare(strict_types=1);

/** Reads the incoming request. Nothing here is trusted without validation. */
final class Request
{
    private static ?string $path = null;

    /** The path with no query string and no trailing slash, e.g. `/blog/slug`. */
    public static function path(): string
    {
        if (self::$path !== null) {
            return self::$path;
        }

        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($uri, PHP_URL_PATH);
        $path = is_string($path) ? $path : '/';
        $path = '/' . trim(rawurldecode($path), '/');

        return self::$path = $path === '/' ? '/' : rtrim($path, '/');
    }

    public static function method(): string
    {
        return strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    }

    public static function isPost(): bool
    {
        return self::method() === 'POST';
    }

    /** A GET/POST value as a trimmed string. */
    public static function input(string $key, string $fallback = ''): string
    {
        $value = $_POST[$key] ?? $_GET[$key] ?? $fallback;
        return is_string($value) ? trim($value) : $fallback;
    }

    /** A value that may legitimately contain newlines and leading spaces. */
    public static function raw(string $key, string $fallback = ''): string
    {
        $value = $_POST[$key] ?? $_GET[$key] ?? $fallback;
        return is_string($value) ? $value : $fallback;
    }

    public static function int(string $key, int $fallback = 0): int
    {
        $value = self::input($key, (string) $fallback);
        return $value === '' ? $fallback : (int) $value;
    }

    public static function float(string $key, float $fallback = 0.0): float
    {
        $value = self::input($key, (string) $fallback);
        return $value === '' ? $fallback : (float) str_replace(',', '.', $value);
    }

    /** Money in major units on the form, stored as integer cents. */
    public static function cents(string $key): ?int
    {
        $value = self::input($key);
        if ($value === '') {
            return null;
        }
        return (int) round(((float) str_replace(',', '.', $value)) * 100);
    }

    public static function bool(string $key): bool
    {
        return Str::bool($_POST[$key] ?? $_GET[$key] ?? false);
    }

    /** Empty string becomes null, for nullable columns. */
    public static function nullable(string $key): ?string
    {
        $value = self::input($key);
        return $value === '' ? null : $value;
    }

    public static function date(string $key): ?string
    {
        $value = self::input($key);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }

    /** An HTML datetime-local value converted to a MySQL DATETIME. */
    public static function dateTime(string $key): ?string
    {
        $value = self::input($key);
        if ($value === '') {
            return null;
        }
        $timestamp = strtotime($value);
        return $timestamp ? date('Y-m-d H:i:s', $timestamp) : null;
    }

    /** @return array<string,mixed> */
    public static function all(): array
    {
        return $_POST + $_GET;
    }

    public static function ip(): ?string
    {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $header) {
            $value = $_SERVER[$header] ?? '';
            if ($value !== '') {
                $ip = trim(explode(',', (string) $value)[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        return null;
    }

    public static function userAgent(): string
    {
        return mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250);
    }

    public static function isAjax(): bool
    {
        return strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'xmlhttprequest';
    }

    /** The JSON body of an API request. */
    public static function json(): array
    {
        $body = file_get_contents('php://input');
        if ($body === false || $body === '') {
            return [];
        }
        $decoded = json_decode($body, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function body(): string
    {
        return (string) file_get_contents('php://input');
    }

    public static function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return isset($_SERVER[$key]) ? (string) $_SERVER[$key] : null;
    }

    /**
     * A safe internal redirect target, so `?next=` can never send someone to
     * another site.
     */
    public static function safeNext(string $fallback = '/dashboard'): string
    {
        $next = self::input('next');
        if ($next === '' || !str_starts_with($next, '/') || str_starts_with($next, '//')) {
            return $fallback;
        }
        return $next;
    }
}
