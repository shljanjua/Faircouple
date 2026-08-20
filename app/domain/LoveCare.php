<?php
declare(strict_types=1);

/**
 * The emotional layer that sits on top of the fairness engine: the daily
 * feeling and need, little love notes, "Open when…" letters, the Our Story
 * timeline, gratitude and the shared bucket list.
 *
 * This class is pure configuration and read helpers; each page writes its own
 * rows. Everything is couple-scoped by the caller.
 */
final class LoveCare
{
    /** How are you feeling? key => [emoji, label] */
    public const FEELINGS = [
        'happy'     => ['😊', 'Happy'],
        'loved'     => ['🥰', 'Loved'],
        'peaceful'  => ['😌', 'Peaceful'],
        'romantic'  => ['😍', 'Romantic'],
        'grateful'  => ['❤️', 'Grateful'],
        'playful'   => ['😄', 'Playful'],
        'tired'     => ['😴', 'Tired'],
        'stressed'  => ['😣', 'Stressed'],
        'sad'       => ['😔', 'Sad'],
        'missing'   => ['💭', 'Missing you'],
        'need_hug'  => ['🤗', 'Need a hug'],
        'anxious'   => ['😟', 'Anxious'],
    ];

    /** What do you need from each other today? */
    public const NEEDS = [
        'attention'    => ['💗', 'A little attention'],
        'conversation' => ['💬', 'A conversation'],
        'hug'          => ['🫂', 'A hug'],
        'encouragement'=> ['💪', 'Encouragement'],
        'romance'      => ['🌹', 'Romance'],
        'help'         => ['🤝', 'Help'],
        'space'        => ['🌙', 'A little space'],
        'nothing'      => ['✨', "Nothing — I'm good"],
    ];

    /** Send a little love — one-tap affection. */
    public const NOTE_TYPES = [
        'i_love_you'   => ['❤️', 'I love you'],
        'i_miss_you'   => ['🤗', 'I miss you'],
        'proud_of_you' => ['🥰', "I'm proud of you"],
        'kiss'         => ['😘', 'Sending you a kiss'],
        'thank_you'    => ['🌷', 'Thank you'],
        'need_hug'     => ['🫂', 'You need a hug'],
        'youre_special'=> ['✨', "You're special"],
        'here_for_you' => ['💪', "I'm here for you"],
        'thinking'     => ['💭', 'Thinking about you'],
    ];

    /** Open when… occasions. */
    public const OCCASIONS = [
        'bad_day'      => ['🌧️', "you're having a bad day"],
        'miss_me'      => ['💭', 'you miss me'],
        'angry'        => ['💢', "you're angry with me"],
        'alone'        => ['🫂', 'you feel alone'],
        'cant_sleep'   => ['🌙', "you can't sleep"],
        'motivation'   => ['💪', 'you need motivation'],
        'need_love'    => ['❤️', 'you need to know I love you'],
        'argument'     => ['💙', 'we had an argument'],
        'smile'        => ['🌈', 'you need a reason to smile'],
        'birthday'     => ['🎂', "it's your birthday"],
        'anniversary'  => ['💍', "it's our anniversary"],
        'need_hug'     => ['🤗', 'you need a hug'],
        'giving_up'    => ['🕯️', 'you feel like giving up'],
        'remember_us'  => ['📸', 'you want to remember us'],
    ];

    /** Bucket-list categories. */
    public const BUCKET_CATEGORIES = [
        'travel'     => ['✈️', 'Travel'],
        'experience' => ['🎉', 'Experiences'],
        'home'       => ['🏡', 'Home & life'],
        'romance'    => ['💕', 'Romance'],
        'adventure'  => ['🏔️', 'Adventure'],
        'growth'     => ['🌱', 'Growth'],
        'family'     => ['👪', 'Family'],
        'other'      => ['⭐', 'Other'],
    ];

    /** Evocative starters shown when the bucket list is empty. */
    public const BUCKET_SUGGESTIONS = [
        ['🌅', 'Watch the sunrise together',   'experience'],
        ['🗼', 'Visit Paris',                  'travel'],
        ['🍳', 'Learn to cook together',       'home'],
        ['🚗', 'Take a road trip',             'travel'],
        ['🏡', 'Build our dream home',         'home'],
        ['🏖️', 'Have a beach dinner',          'romance'],
        ['🏔️', 'See the northern lights',      'adventure'],
        ['📸', 'Take 100 photos together',     'romance'],
    ];

    /** [emoji, label] for a key from any of the maps above, with a safe fallback. */
    public static function lookup(array $map, ?string $key): array
    {
        return $map[$key] ?? ['•', ucfirst(str_replace('_', ' ', (string) $key))];
    }

    public static function feeling(?string $key): array { return self::lookup(self::FEELINGS, $key); }
    public static function need(?string $key): array    { return self::lookup(self::NEEDS, $key); }
    public static function noteType(?string $key): array { return self::lookup(self::NOTE_TYPES, $key); }
    public static function occasion(?string $key): array { return self::lookup(self::OCCASIONS, $key); }

    /**
     * The connection streak: how many consecutive days (ending today or
     * yesterday) at least one partner recorded a feeling. Yesterday still
     * counts so the streak is not "lost" before the couple opens the app.
     */
    public static function streak(string $coupleId): int
    {
        $rows = Db::all(
            'SELECT DISTINCT mood_date FROM love_moods
              WHERE couple_id = ? ORDER BY mood_date DESC LIMIT 400',
            [$coupleId]
        );
        if ($rows === []) {
            return 0;
        }

        $days = array_map(static fn ($r) => (string) $r['mood_date'], $rows);
        $today = new DateTimeImmutable('today');
        $yesterday = $today->modify('-1 day')->format('Y-m-d');

        // The streak may end today or yesterday; anything older is broken.
        if ($days[0] !== $today->format('Y-m-d') && $days[0] !== $yesterday) {
            return 0;
        }

        $streak = 0;
        $cursor = new DateTimeImmutable($days[0]);
        $set = array_flip($days);
        while (isset($set[$cursor->format('Y-m-d')])) {
            $streak++;
            $cursor = $cursor->modify('-1 day');
        }

        return $streak;
    }

    /**
     * A gentle "relationship weather" derived from the most recent fairness
     * report's balance index, so the emotional layer reflects the analytics
     * without exposing a bare number. Falls back to a warm default.
     *
     * @return array{emoji:string,label:string,tone:string}
     */
    public static function weather(string $coupleId): array
    {
        $balance = Db::value(
            'SELECT balance_index FROM fairness_reports
              WHERE couple_id = ? ORDER BY period_start DESC LIMIT 1',
            [$coupleId]
        );

        if ($balance === null) {
            return ['emoji' => '🌤️', 'label' => 'A fresh start', 'tone' => 'primary'];
        }

        $balance = (float) $balance;
        return match (true) {
            $balance >= 80 => ['emoji' => '☀️', 'label' => 'Warm & connected', 'tone' => 'success'],
            $balance >= 65 => ['emoji' => '🌈', 'label' => 'Growing stronger', 'tone' => 'success'],
            $balance >= 50 => ['emoji' => '🌤️', 'label' => 'A little distant',  'tone' => 'primary'],
            $balance >= 35 => ['emoji' => '🌥️', 'label' => 'Needs attention',   'tone' => 'warning'],
            default        => ['emoji' => '🌧️', 'label' => 'Reach for each other', 'tone' => 'danger'],
        };
    }

    /**
     * Relationship milestones — a warm, non-childish progress picture. Each
     * metric shows the couple's current count and the next milestone to reach,
     * with tiers that grow gently rather than gamifying the relationship.
     *
     * @return array<int,array{key:string,emoji:string,label:string,count:int,next:?int,prev:int,maxed:bool}>
     */
    public static function milestones(string $coupleId): array
    {
        $metrics = [
            ['streak',       '❤️',  'days connected',        self::streak($coupleId),                                         [7, 14, 30, 50, 100, 180, 365]],
            ['conversations','💬',  'messages exchanged',    Db::count('messages', 'couple_id = ?', [$coupleId]),             [10, 25, 50, 100, 250, 500]],
            ['appreciation', '💗',  'little love notes',     Db::count('love_notes', 'couple_id = ?', [$coupleId]),           [10, 25, 50, 100, 250]],
            ['gratitude',    '🌷',  'gratitude moments',     Db::count('gratitude_notes', 'couple_id = ?', [$coupleId]),      [5, 10, 30, 50, 100]],
            ['memories',     '📸',  'memories in your story',Db::count('story_milestones', 'couple_id = ?', [$coupleId]),     [5, 10, 25, 50, 100]],
            ['trips',        '✈️',  'trips planned',         Db::count('trips', 'couple_id = ?', [$coupleId]),                [1, 3, 5, 10, 20]],
            ['letters',      '💌',  'letters written',       Db::count('open_when_letters', 'couple_id = ?', [$coupleId]),    [3, 5, 10, 25, 50]],
        ];

        $out = [];
        foreach ($metrics as [$key, $emoji, $label, $count, $tiers]) {
            $count = (int) $count;
            $next = null;
            $prev = 0;
            foreach ($tiers as $tier) {
                if ($count < $tier) { $next = $tier; break; }
                $prev = $tier;
            }
            $out[] = [
                'key'   => $key,
                'emoji' => $emoji,
                'label' => $label,
                'count' => $count,
                'next'  => $next,
                'prev'  => $prev,
                'maxed' => $next === null,
            ];
        }

        return $out;
    }

    /** Small counters for the hub header. */
    public static function counts(string $coupleId): array
    {
        return [
            'memories'      => Db::count('story_milestones', 'couple_id = ?', [$coupleId]),
            'gratitude'     => Db::count('gratitude_notes', 'couple_id = ?', [$coupleId]),
            'letters'       => Db::count('open_when_letters', 'couple_id = ?', [$coupleId]),
            'notes'         => Db::count('love_notes', 'couple_id = ?', [$coupleId]),
            'bucket_done'   => Db::count('bucket_list_items', 'couple_id = ? AND is_done = 1', [$coupleId]),
            'bucket_total'  => Db::count('bucket_list_items', 'couple_id = ?', [$coupleId]),
        ];
    }
}
