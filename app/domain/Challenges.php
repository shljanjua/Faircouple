<?php
declare(strict_types=1);

/**
 * Couple Challenges — short, guided programmes that build connection a day at
 * a time. The catalogue lives here in code; a couple's progress lives in the
 * couple_challenges / challenge_days tables.
 */
final class Challenges
{
    /**
     * key => [emoji, title, blurb, days[]]
     * Each day is a single, doable prompt.
     */
    public const CATALOG = [
        'connection-7' => [
            'emoji' => '❤️',
            'title' => '7-Day Connection Challenge',
            'blurb' => 'One small, deliberate act of closeness every day for a week.',
            'days'  => [
                'Tell them one specific thing you appreciate about them.',
                'Have a 20-minute, phone-free conversation.',
                'Send a surprise message in the middle of the day.',
                'Share a favourite memory of the two of you.',
                'Plan your next date — actually put it on the calendar.',
                "Tell them something you've never said out loud.",
                'Write each other a short love letter and swap.',
            ],
        ],
        'gratitude-5' => [
            'emoji' => '🌷',
            'title' => '5-Day Gratitude Challenge',
            'blurb' => 'Notice the good on purpose, and say it.',
            'days'  => [
                'Thank them for something small they do every day.',
                'Tell them a way they made a hard time easier.',
                'Appreciate something about who they are, not what they do.',
                'Thank them for something from early in your relationship.',
                'Write down three things you are grateful for about them.',
            ],
        ],
        'reconnect-10' => [
            'emoji' => '🔥',
            'title' => '10-Day Reconnect',
            'blurb' => 'For when life got busy and you want to find each other again.',
            'days'  => [
                'Ask: "How are you, really?" — and just listen.',
                'Recreate something from your first date.',
                'Put both phones in another room for one evening.',
                'Share one thing you each need more of right now.',
                'Do one chore that is usually the other person\'s.',
                'Take a photo together and save it to Our Story.',
                'Talk about a shared dream for the next year.',
                'Give a 60-second, uninterrupted compliment each.',
                'Cook or order a meal you both loved once.',
                'Name one thing you are proud of about your relationship.',
            ],
        ],
        'deep-talk-14' => [
            'emoji' => '💬',
            'title' => '14-Day Deep Talk',
            'blurb' => 'Two weeks of questions that take you past small talk.',
            'days'  => [
                'What made you feel loved this week?',
                'What is something you are afraid to ask me for?',
                'When do you feel closest to me?',
                'What does a perfect ordinary day together look like?',
                'What is one thing you want to do before you turn 40?',
                'How do you most like to be comforted when upset?',
                'What is a moment you were proud of me?',
                'What do you wish we did more of?',
                'What is something you learned from a past relationship?',
                'What does "home" mean to you?',
                'What is a fear you have about us, honestly?',
                'What do you want people to say about our relationship?',
                'What is one way I could love you better?',
                'Where do you hope we are in five years?',
            ],
        ],
        'longdistance-7' => [
            'emoji' => '🌎',
            'title' => '7-Day Long-Distance Closeness',
            'blurb' => 'Feel close across the miles, one day at a time.',
            'days'  => [
                'Send a good-morning voice note before anything else.',
                'Watch the same film at the same time tonight.',
                'Share three photos from your day, as it happens.',
                'Add a song to a shared playlist and tell them why.',
                'Plan one thing for your next visit together.',
                'Write an "Open when you miss me" letter.',
                'Have a proper video date — dress up, no multitasking.',
            ],
        ],
    ];

    public static function all(): array
    {
        return self::CATALOG;
    }

    public static function get(?string $key): ?array
    {
        return self::CATALOG[$key] ?? null;
    }

    public static function exists(?string $key): bool
    {
        return $key !== null && isset(self::CATALOG[$key]);
    }

    /** The prompt for a given 1-based day of a challenge, if it exists. */
    public static function dayTask(string $key, int $day): ?string
    {
        $challenge = self::get($key);
        return $challenge['days'][$day - 1] ?? null;
    }
}
