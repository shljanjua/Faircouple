<?php
declare(strict_types=1);

/**
 * The love-language tool — an ongoing feature, not a one-off quiz. Each partner
 * scores the five languages 1–5 and can flag what they need most right now; the
 * other partner sees a concrete "how to love them today".
 */
final class LoveLanguage
{
    /**
     * key => [emoji, label, description, todays[]]
     * `todays` are small, doable actions to show the partner.
     */
    public const LANGUAGES = [
        'words' => [
            '💬', 'Words of affirmation',
            'Feeling loved through spoken and written appreciation, encouragement and kind words.',
            [
                'Tell them one specific thing you admire about them.',
                'Leave a short note where they\'ll find it later.',
                'Text them a genuine compliment out of the blue.',
                'Say "thank you" for something they usually do unnoticed.',
            ],
        ],
        'quality_time' => [
            '⏳', 'Quality time',
            'Feeling loved through undivided attention and shared, unhurried moments together.',
            [
                'Put both phones in another room for 30 minutes and just talk.',
                'Take a walk together with no destination.',
                'Cook a meal side by side tonight.',
                'Ask them about their day and really listen — no multitasking.',
            ],
        ],
        'acts' => [
            '🤝', 'Acts of service',
            'Feeling loved when the other person does helpful things without being asked.',
            [
                'Do one chore that\'s usually theirs — quietly.',
                'Handle a small task they\'ve been dreading.',
                'Make them a drink before they ask.',
                'Sort out one thing on their to-do list for them.',
            ],
        ],
        'gifts' => [
            '🎁', 'Gifts',
            'Feeling loved through thoughtful tokens that say "I was thinking of you".',
            [
                'Bring home their favourite small treat.',
                'Give a tiny "just because" gift — it\'s the thought that counts.',
                'Pick up something that reminded you of them today.',
                'Plan a small surprise for later this week.',
            ],
        ],
        'physical' => [
            '🫂', 'Physical affection',
            'Feeling loved through closeness — hugs, hand-holding, a hand on the shoulder.',
            [
                'Give a long, unhurried hug — the kind that lasts.',
                'Hold hands on the sofa tonight.',
                'Offer a shoulder or neck rub.',
                'Sit close, no agenda.',
            ],
        ],
    ];

    /** The column names, in order, matching LANGUAGES keys. */
    public const KEYS = ['words', 'quality_time', 'acts', 'gifts', 'physical'];

    public static function meta(?string $key): array
    {
        return self::LANGUAGES[$key] ?? ['❤️', 'Love', '', []];
    }

    /**
     * The dominant language from a profile row, with ties broken by the natural
     * order above. Returns null if there's no profile.
     */
    public static function primary(?array $profile): ?string
    {
        if (!$profile) {
            return null;
        }
        $best = null;
        $bestScore = -1;
        foreach (self::KEYS as $key) {
            $score = (int) ($profile[$key] ?? 0);
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $key;
            }
        }
        return $best;
    }

    /**
     * The language to act on for a partner: their current focus if they set one,
     * otherwise their primary language.
     */
    public static function actionable(?array $profile): ?string
    {
        if (!$profile) {
            return null;
        }
        $focus = $profile['current_focus'] ?? null;
        if ($focus && isset(self::LANGUAGES[$focus])) {
            return $focus;
        }
        return self::primary($profile);
    }

    /** An ordered ranking (highest first) for display. @return array<int,array{key:string,score:int}> */
    public static function ranking(?array $profile): array
    {
        if (!$profile) {
            return [];
        }
        $rows = [];
        foreach (self::KEYS as $key) {
            $rows[] = ['key' => $key, 'score' => (int) ($profile[$key] ?? 0)];
        }
        usort($rows, static fn ($a, $b) => $b['score'] <=> $a['score']);
        return $rows;
    }

    /** A rotating "today" suggestion for a language, varied by the day. */
    public static function todaySuggestion(string $key): string
    {
        $meta = self::meta($key);
        $ideas = $meta[3] ?? [];
        if ($ideas === []) {
            return 'Show them you were thinking of them.';
        }
        return $ideas[(int) date('z') % count($ideas)];
    }
}
