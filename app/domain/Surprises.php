<?php
declare(strict_types=1);

/**
 * Surprise Mode — a partner writes something and schedules it; it stays sealed
 * for the recipient until the reveal time, then unlocks. No AI: the content is
 * whatever the sender writes, framed by the surprise type.
 */
final class Surprises
{
    /** key => [emoji, label, hint] — hint is shown on the sealed teaser. */
    public const TYPES = [
        'love_letter' => ['💌', 'A love letter',            'A letter, sealed until the moment is right'],
        'photo_reveal'=> ['📸', 'A photo reveal',           'A photo, hidden until it unlocks'],
        'memory'      => ['🎞️', 'A memory',                 'A memory they\'ll want to relive'],
        'countdown'   => ['⏳', 'A countdown',              'Something worth waiting for'],
        'question'    => ['❓', 'A question',               'A question, revealed at the right time'],
        'gift'        => ['🎁', 'A gift',                   'A little something'],
        'big_news'    => ['✨', 'I have something to tell you', 'Something they should hear soon'],
    ];

    public static function meta(?string $key): array
    {
        return self::TYPES[$key] ?? ['🎁', 'A surprise', 'Something is waiting'];
    }

    /** True once a surprise's reveal time has arrived. */
    public static function isRevealable(array $surprise): bool
    {
        $revealAt = $surprise['reveal_at'] ?? null;
        if (!$revealAt) {
            return true;
        }
        return strtotime((string) $revealAt) <= time();
    }

    /** A friendly "reveals in…" string, or null once it's due. */
    public static function countdown(array $surprise): ?string
    {
        if (self::isRevealable($surprise)) {
            return null;
        }
        $seconds = strtotime((string) $surprise['reveal_at']) - time();
        $days = intdiv($seconds, 86400);
        $hours = intdiv($seconds % 86400, 3600);
        $mins = intdiv($seconds % 3600, 60);

        if ($days > 0) {
            return $days . ' day' . ($days === 1 ? '' : 's') . ($hours ? ", {$hours}h" : '');
        }
        if ($hours > 0) {
            return $hours . 'h ' . $mins . 'm';
        }
        return max(1, $mins) . ' min';
    }
}
