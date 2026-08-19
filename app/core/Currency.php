<?php
declare(strict_types=1);

/**
 * The five currencies the platform bills in. The signup country picks the
 * currency, and the member can change it later in Settings.
 */
final class Currency
{
    public const LIST = [
        'USD' => ['code' => 'USD', 'symbol' => '$',  'name' => 'US Dollar',        'flag' => '🇺🇸', 'locale' => 'en-US'],
        'GBP' => ['code' => 'GBP', 'symbol' => '£',  'name' => 'British Pound',    'flag' => '🇬🇧', 'locale' => 'en-GB'],
        'EUR' => ['code' => 'EUR', 'symbol' => '€',  'name' => 'Euro',             'flag' => '🇪🇺', 'locale' => 'de-DE'],
        'CAD' => ['code' => 'CAD', 'symbol' => 'C$', 'name' => 'Canadian Dollar',  'flag' => '🇨🇦', 'locale' => 'en-CA'],
        'AUD' => ['code' => 'AUD', 'symbol' => 'A$', 'name' => 'Australian Dollar','flag' => '🇦🇺', 'locale' => 'en-AU'],
    ];

    /** Countries offered on the signup form, each with its billing currency. */
    public const COUNTRIES = [
        ['code' => 'US',    'name' => 'United States',  'currency' => 'USD'],
        ['code' => 'GB',    'name' => 'United Kingdom', 'currency' => 'GBP'],
        ['code' => 'CA',    'name' => 'Canada',         'currency' => 'CAD'],
        ['code' => 'AU',    'name' => 'Australia',      'currency' => 'AUD'],
        ['code' => 'IE',    'name' => 'Ireland',        'currency' => 'EUR'],
        ['code' => 'DE',    'name' => 'Germany',        'currency' => 'EUR'],
        ['code' => 'FR',    'name' => 'France',         'currency' => 'EUR'],
        ['code' => 'ES',    'name' => 'Spain',          'currency' => 'EUR'],
        ['code' => 'IT',    'name' => 'Italy',          'currency' => 'EUR'],
        ['code' => 'NL',    'name' => 'Netherlands',    'currency' => 'EUR'],
        ['code' => 'BE',    'name' => 'Belgium',        'currency' => 'EUR'],
        ['code' => 'AT',    'name' => 'Austria',        'currency' => 'EUR'],
        ['code' => 'PT',    'name' => 'Portugal',       'currency' => 'EUR'],
        ['code' => 'FI',    'name' => 'Finland',        'currency' => 'EUR'],
        ['code' => 'GR',    'name' => 'Greece',         'currency' => 'EUR'],
        ['code' => 'SE',    'name' => 'Sweden',         'currency' => 'EUR'],
        ['code' => 'DK',    'name' => 'Denmark',        'currency' => 'EUR'],
        ['code' => 'NO',    'name' => 'Norway',         'currency' => 'EUR'],
        ['code' => 'CH',    'name' => 'Switzerland',    'currency' => 'EUR'],
        ['code' => 'PL',    'name' => 'Poland',         'currency' => 'EUR'],
        ['code' => 'CZ',    'name' => 'Czechia',        'currency' => 'EUR'],
        ['code' => 'NZ',    'name' => 'New Zealand',    'currency' => 'AUD'],
        ['code' => 'OTHER', 'name' => 'Somewhere else', 'currency' => 'USD'],
    ];

    public static function normalise(?string $code): string
    {
        $code = strtoupper(trim((string) $code));
        return isset(self::LIST[$code]) ? $code : 'USD';
    }

    public static function symbol(?string $code): string
    {
        return self::LIST[self::normalise($code)]['symbol'];
    }

    public static function forCountry(?string $country): string
    {
        $country = strtoupper(trim((string) $country));
        foreach (self::COUNTRIES as $row) {
            if ($row['code'] === $country) {
                return $row['currency'];
            }
        }
        return 'USD';
    }

    /** Formats integer cents, e.g. 1999 in GBP becomes £19.99. */
    public static function money(?int $cents, ?string $code = 'USD', bool $decimals = true): string
    {
        $cents = (int) $cents;
        $currency = self::normalise($code);
        $amount = $cents / 100;

        if (!$decimals && $amount === floor($amount)) {
            return self::LIST[$currency]['symbol'] . number_format($amount, 0);
        }

        return self::LIST[$currency]['symbol'] . number_format($amount, 2);
    }

    /** Same as money(), but hides `.00` on whole amounts. */
    public static function pretty(?int $cents, ?string $code = 'USD'): string
    {
        $cents = (int) $cents;
        return self::money($cents, $code, $cents % 100 !== 0);
    }

    /** Converts using the fallback rates stored in `exchange_rates`. */
    public static function convert(int $cents, string $from, string $to): int
    {
        $from = self::normalise($from);
        $to = self::normalise($to);
        if ($from === $to) {
            return $cents;
        }

        $rate = Db::value(
            'SELECT rate FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? LIMIT 1',
            [$from, $to]
        );

        if ($rate === null) {
            $inverse = Db::value(
                'SELECT rate FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? LIMIT 1',
                [$to, $from]
            );
            if ($inverse === null || (float) $inverse == 0.0) {
                return $cents;
            }
            $rate = 1 / (float) $inverse;
        }

        return (int) round($cents * (float) $rate);
    }

    /** The currency to show a visitor, from their account or a query string. */
    public static function preferred(): string
    {
        $requested = $_GET['currency'] ?? null;
        if (is_string($requested) && isset(self::LIST[strtoupper($requested)])) {
            return strtoupper($requested);
        }

        $user = Auth::user();
        if ($user && !empty($user['currency'])) {
            return self::normalise($user['currency']);
        }

        return self::normalise(Settings::text('default_currency', 'USD'));
    }
}
