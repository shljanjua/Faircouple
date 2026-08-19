<?php
declare(strict_types=1);

/** Reads app/config.php once and answers questions about it. */
final class Config
{
    private static array $values = [];

    public static function load(string $path): void
    {
        self::$values = is_file($path) ? (array) require $path : [];
    }

    /** @return mixed */
    public static function get(string $key, $fallback = null)
    {
        return self::$values[$key] ?? $fallback;
    }

    public static function siteUrl(string $path = ''): string
    {
        $base = rtrim((string) self::get('site_url', ''), '/');
        if ($base === '') {
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $base = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        }
        return $path === '' ? $base : $base . '/' . ltrim($path, '/');
    }

    public static function key(): string
    {
        return (string) self::get('app_key', 'faircouples-insecure-development-key');
    }

    public static function isDev(): bool
    {
        return self::get('env', 'production') !== 'production';
    }

    /** True while config.php still holds its shipped placeholder values. */
    public static function needsSetup(): bool
    {
        $db = (array) self::get('db', []);
        return ($db['password'] ?? '') === 'PUT-YOUR-MYSQL-PASSWORD-HERE'
            || str_starts_with(self::key(), 'CHANGE-THIS');
    }

    public static function uploadDir(): string
    {
        $dir = (string) self::get('upload_dir', __DIR__ . '/../../storage/uploads');
        $real = realpath($dir);
        return $real !== false ? $real : $dir;
    }
}
