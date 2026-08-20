<?php
declare(strict_types=1);

/**
 * Our Soundtrack — songs tied to the moments of a relationship. No autoplay,
 * no embeds by default; each song can carry a link the couple opens themselves.
 */
final class Soundtrack
{
    /** key => [emoji, label] */
    public const MOMENTS = [
        'anthem'      => ['🎶', 'Our song'],
        'first_meet'  => ['👀', 'When we met'],
        'first_date'  => ['💕', 'Our first date'],
        'first_trip'  => ['✈️', 'Our first trip'],
        'proposal'    => ['💍', 'The proposal'],
        'wedding'     => ['🏡', 'Our wedding'],
        'late_night'  => ['🌙', 'Late-night talks'],
        'road_trip'   => ['🚗', 'Road trips'],
        'funny'       => ['😂', 'A funny memory'],
        'just_us'     => ['❤️', 'Just us'],
    ];

    public static function moment(?string $key): array
    {
        return self::MOMENTS[$key] ?? ['🎵', 'A moment'];
    }

    /**
     * A safe, http(s)-only URL, or null. Used both for the link and to work out
     * which service it points at.
     */
    public static function safeUrl(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }
        if (!preg_match('~^https?://~i', $url)) {
            $url = 'https://' . $url;
        }
        return filter_var($url, FILTER_VALIDATE_URL) ? $url : null;
    }

    /** A friendly label + emoji for the service a URL points at. */
    public static function service(?string $url): array
    {
        $host = strtolower((string) parse_url((string) $url, PHP_URL_HOST));
        return match (true) {
            str_contains($host, 'spotify')                                  => ['🟢', 'Spotify'],
            str_contains($host, 'youtube') || str_contains($host, 'youtu.be') => ['▶️', 'YouTube'],
            str_contains($host, 'music.apple') || str_contains($host, 'apple') => ['', 'Apple Music'],
            str_contains($host, 'soundcloud')                               => ['☁️', 'SoundCloud'],
            str_contains($host, 'deezer')                                   => ['🎧', 'Deezer'],
            $host !== ''                                                    => ['🔗', 'Listen'],
            default                                                         => ['', ''],
        };
    }
}
