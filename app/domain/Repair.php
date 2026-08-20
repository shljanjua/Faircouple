<?php
declare(strict_types=1);

/**
 * The guided conflict-repair flow. Each partner answers the same five steps
 * for themselves, then they see both sides and exchange warm "repair together"
 * gestures. No advice engine — just structure that turns a fight into a
 * conversation.
 */
final class Repair
{
    /**
     * The five steps. key => [label, prompt, placeholder]
     * The key is also the column name in repair_reflections.
     */
    public const STEPS = [
        'what_happened' => [
            'What happened?',
            'Describe it plainly, from your side — no blame, just the facts as you saw them.',
            'We were talking about the weekend and it turned into…',
        ],
        'how_felt' => [
            'How did you feel?',
            'Name the feelings underneath, not just "angry". Hurt? Unseen? Anxious?',
            'I felt dismissed, and a bit alone…',
        ],
        'what_needed' => [
            'What did you need?',
            'What would have helped in that moment?',
            'I needed you to just hear me before fixing it…',
        ],
        'wish_understood' => [
            'What do you wish your partner understood?',
            'The thing you most want them to really get.',
            'That I wasn\'t attacking you — I was scared…',
        ],
        'do_differently' => [
            'What can you do differently?',
            'Your part — one small thing you could change next time.',
            'I could take a breath and say I need a minute…',
        ],
    ];

    public const STEP_KEYS = ['what_happened', 'how_felt', 'what_needed', 'wish_understood', 'do_differently'];

    /** The warm gestures. key => [emoji, label] */
    public const RESPONSES = [
        'understand'  => ['💙', 'I understand'],
        'sorry'       => ['🙏', "I'm sorry"],
        'talk'        => ['💬', "Let's talk"],
        'need_time'   => ['🌙', 'I need some time'],
        'start_again' => ['❤️', "Let's start again"],
    ];

    public static function response(?string $key): array
    {
        return self::RESPONSES[$key] ?? ['•', (string) $key];
    }

    /** How many of the five steps a reflection has filled in. */
    public static function completion(?array $reflection): int
    {
        if (!$reflection) {
            return 0;
        }
        $done = 0;
        foreach (self::STEP_KEYS as $key) {
            if (trim((string) ($reflection[$key] ?? '')) !== '') {
                $done++;
            }
        }
        return $done;
    }
}
