<?php
declare(strict_types=1);

/**
 * Long-distance helpers: each partner's local time, and the countdown to the
 * next time they are together. Timezones come from each member's profile.
 */
final class LongDistance
{
    /** A curated timezone list for the picker (label => IANA id). */
    public const TIMEZONES = [
        'UTC'                         => 'UTC',
        'London (UK)'                 => 'Europe/London',
        'Paris / Berlin / Madrid'     => 'Europe/Paris',
        'Athens / Helsinki'           => 'Europe/Athens',
        'New York (US East)'          => 'America/New_York',
        'Chicago (US Central)'        => 'America/Chicago',
        'Denver (US Mountain)'        => 'America/Denver',
        'Los Angeles (US West)'       => 'America/Los_Angeles',
        'Toronto'                     => 'America/Toronto',
        'São Paulo'                   => 'America/Sao_Paulo',
        'Lagos / Accra'               => 'Africa/Lagos',
        'Johannesburg'                => 'Africa/Johannesburg',
        'Dubai'                       => 'Asia/Dubai',
        'Karachi / Islamabad'         => 'Asia/Karachi',
        'Delhi / Mumbai'              => 'Asia/Kolkata',
        'Dhaka'                       => 'Asia/Dhaka',
        'Bangkok / Jakarta'           => 'Asia/Bangkok',
        'Singapore / Hong Kong'       => 'Asia/Singapore',
        'Tokyo / Seoul'               => 'Asia/Tokyo',
        'Sydney (AU East)'            => 'Australia/Sydney',
        'Perth (AU West)'             => 'Australia/Perth',
        'Auckland'                    => 'Pacific/Auckland',
    ];

    /** A safe IANA timezone, falling back to UTC. */
    public static function safeZone(?string $tz): string
    {
        if ($tz && in_array($tz, timezone_identifiers_list(), true)) {
            return $tz;
        }
        return 'UTC';
    }

    /**
     * The current local time in a timezone.
     * @return array{time:string,date:string,offset:string,zone:string}
     */
    public static function clock(?string $tz): array
    {
        $zone = self::safeZone($tz);
        try {
            $now = new DateTimeImmutable('now', new DateTimeZone($zone));
        } catch (Throwable) {
            $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
            $zone = 'UTC';
        }

        $offsetSeconds = $now->getOffset();
        $sign = $offsetSeconds >= 0 ? '+' : '-';
        $abs = abs($offsetSeconds);
        $offset = sprintf('UTC%s%d:%02d', $sign, intdiv($abs, 3600), intdiv($abs % 3600, 60));

        return [
            'time'   => $now->format('g:i A'),
            'date'   => $now->format('l, j M'),
            'offset' => $offset,
            'zone'   => $zone,
        ];
    }

    /** The hour difference between two timezones, right now. */
    public static function hoursApart(?string $tzA, ?string $tzB): int
    {
        try {
            $a = (new DateTimeImmutable('now', new DateTimeZone(self::safeZone($tzA))))->getOffset();
            $b = (new DateTimeImmutable('now', new DateTimeZone(self::safeZone($tzB))))->getOffset();
            return (int) round(abs($a - $b) / 3600);
        } catch (Throwable) {
            return 0;
        }
    }

    /**
     * Whole days until a date (0 = today, negative = past).
     */
    public static function daysUntil(?string $date): ?int
    {
        if (!$date) {
            return null;
        }
        try {
            $target = new DateTimeImmutable(substr($date, 0, 10) . ' 00:00:00');
            $today  = new DateTimeImmutable('today');
            return (int) $today->diff($target)->format('%r%a');
        } catch (Throwable) {
            return null;
        }
    }
}
