<?php
declare(strict_types=1);

/**
 * Everything the admin panel controls lives in `site_settings` as JSON values:
 * branding, analytics ids, SMTP, SEO defaults, tax, maintenance mode.
 */
final class Settings
{
    private static ?array $cache = null;

    private const DEFAULTS = [
        'site_name'                   => 'FairCouples',
        'site_tagline'                => 'Fair love, measured.',
        'site_description'            => 'FairCouples is the relationship fairness platform for couples and families — track emotions, balance effort, split budgets fairly and plan trips together.',
        'support_email'               => 'support@faircouples.com',
        'company_name'                => 'FairCouples',
        'default_currency'            => 'USD',
        'supported_currencies'        => ['USD', 'GBP', 'EUR', 'CAD', 'AUD'],
        'maintenance_mode'            => false,
        'signup_enabled'              => true,
        'require_email_verification'  => true,
        'trial_days'                  => 14,
        'email_enabled'               => true,
        'email_admin_notifications'   => true,
        'smtp_port'                   => 465,
        'smtp_secure'                 => true,
        'cookie_banner_enabled'       => true,
        'seo_default_og_image'        => '',
        'seo_twitter_handle'          => '',
    ];

    /** @return array<string,mixed> */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $values = self::DEFAULTS;
        foreach (Db::all('SELECT setting_key, value FROM site_settings') as $row) {
            $decoded = json_decode((string) $row['value'], true);
            $values[$row['setting_key']] = json_last_error() === JSON_ERROR_NONE ? $decoded : $row['value'];
        }

        // The configured site URL always wins over a stale database value.
        $values['site_url'] = Config::siteUrl();

        return self::$cache = $values;
    }

    /** @return mixed */
    public static function get(string $key, $fallback = null)
    {
        $all = self::all();
        return array_key_exists($key, $all) ? $all[$key] : $fallback;
    }

    /**
     * A stored empty string counts as "not set", so the fallback applies to a
     * field an admin cleared as well as one that was never written. Callers
     * that treat blank as meaningful (analytics ids, optional SMTP fields)
     * pass no fallback, so they still get '' back.
     */
    public static function text(string $key, string $fallback = ''): string
    {
        $value = self::get($key, $fallback);
        if (is_array($value) || is_object($value)) {
            return $fallback;
        }
        if (is_bool($value)) {
            return $value ? '1' : '';
        }

        $value = trim((string) $value);
        return $value !== '' ? $value : $fallback;
    }

    public static function bool(string $key, bool $fallback = false): bool
    {
        $value = self::get($key, $fallback);
        if (is_bool($value)) {
            return $value;
        }
        if (is_string($value)) {
            return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
        }
        return (bool) $value;
    }

    public static function number(string $key, float $fallback = 0): float
    {
        $value = self::get($key, $fallback);
        return is_numeric($value) ? (float) $value : $fallback;
    }

    /** @return array<int,string> */
    public static function list(string $key, array $fallback = []): array
    {
        $value = self::get($key, $fallback);
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            return array_values(array_filter(array_map('trim', explode(',', $value))));
        }
        return $fallback;
    }

    /** Writes one or many settings. Values are stored as JSON. */
    public static function put(array $values, ?string $actorId = null): void
    {
        foreach ($values as $key => $value) {
            Db::run(
                'INSERT INTO site_settings (setting_key, value, updated_by)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)',
                [$key, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $actorId]
            );
        }
        self::$cache = null;
    }

    /** Settings grouped for the admin editor. */
    public static function grouped(): array
    {
        $rows = Db::all('SELECT * FROM site_settings ORDER BY group_name ASC, setting_key ASC');
        $groups = [];
        foreach ($rows as $row) {
            $groups[$row['group_name'] ?: 'general'][] = $row + [
                'decoded' => json_decode((string) $row['value'], true),
            ];
        }
        return $groups;
    }

    /** True when the public site should show the maintenance notice. */
    public static function inMaintenance(): bool
    {
        return self::bool('maintenance_mode', false) && !Auth::isAdmin();
    }

    public static function forget(): void
    {
        self::$cache = null;
    }
}
