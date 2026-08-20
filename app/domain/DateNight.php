<?php
declare(strict_types=1);

/**
 * The date-night generator. Given a mood, a place, a budget and how long you
 * have, it assembles a coherent little plan from tagged building blocks. It is
 * deterministic (same inputs → same plan) with a nonce so "another idea"
 * reliably varies it.
 */
final class DateNight
{
    /** key => [emoji, label] */
    public const MOODS = [
        'romantic'  => ['💕', 'Romantic'],
        'fun'       => ['😂', 'Fun'],
        'quiet'     => ['🌙', 'Quiet'],
        'passionate'=> ['🔥', 'Passionate'],
        'creative'  => ['🎨', 'Creative'],
        'outdoor'   => ['🌳', 'Outdoor'],
        'adventure' => ['🧭', 'Adventure'],
    ];

    public const LOCATIONS = [
        'home' => '🏠 At home',
        'out'  => '🌆 Out',
    ];

    /**
     * The building-block library. Each idea declares which phase it fills, which
     * moods it suits ('any' = all), where it works ('home', 'out' or 'any') and
     * a rough cost tier (0 free … 3 premium).
     *
     * @var array<int,array{emoji:string,text:string,phase:string,moods:array|string,loc:string,cost:int}>
     */
    private const IDEAS = [
        // ---- openers -------------------------------------------------------
        ['emoji'=>'🎵','text'=>'Build a shared playlist and let it set the mood','phase'=>'open','moods'=>'any','loc'=>'any','cost'=>0],
        ['emoji'=>'🕯️','text'=>'Dim the lights and light a candle','phase'=>'open','moods'=>['romantic','quiet','passionate'],'loc'=>'home','cost'=>0],
        ['emoji'=>'📵','text'=>'Both phones away for the whole date','phase'=>'open','moods'=>['quiet','romantic','creative'],'loc'=>'any','cost'=>0],
        ['emoji'=>'👗','text'=>'Actually dress up for each other','phase'=>'open','moods'=>['romantic','passionate','fun'],'loc'=>'out','cost'=>0],
        ['emoji'=>'🎒','text'=>'Pack a small bag and head out with no fixed plan','phase'=>'open','moods'=>['adventure','outdoor','fun'],'loc'=>'out','cost'=>0],

        // ---- main activities ----------------------------------------------
        ['emoji'=>'🍳','text'=>'Cook a new recipe together, one dish each','phase'=>'main','moods'=>['creative','fun','quiet'],'loc'=>'home','cost'=>1],
        ['emoji'=>'🎬','text'=>'Pick a film neither of you has seen','phase'=>'main','moods'=>['quiet','romantic','fun'],'loc'=>'home','cost'=>0],
        ['emoji'=>'🧩','text'=>'Play a two-player game — cards, a puzzle, a quiz','phase'=>'main','moods'=>['fun','creative'],'loc'=>'home','cost'=>0],
        ['emoji'=>'💃','text'=>'Slow-dance in the kitchen to one whole song','phase'=>'main','moods'=>['romantic','passionate'],'loc'=>'home','cost'=>0],
        ['emoji'=>'🎨','text'=>'Draw each other — badly, on purpose','phase'=>'main','moods'=>['creative','fun'],'loc'=>'home','cost'=>0],
        ['emoji'=>'🛁','text'=>'Run a bath, no rush, just talk','phase'=>'main','moods'=>['quiet','passionate','romantic'],'loc'=>'home','cost'=>0],
        ['emoji'=>'🌆','text'=>'Wander a part of town you never go to','phase'=>'main','moods'=>['adventure','outdoor','creative'],'loc'=>'out','cost'=>0],
        ['emoji'=>'🚶','text'=>'Take a long walk somewhere green','phase'=>'main','moods'=>['outdoor','quiet','romantic'],'loc'=>'out','cost'=>0],
        ['emoji'=>'🎡','text'=>'Find one touristy thing in your own city and do it','phase'=>'main','moods'=>['fun','adventure'],'loc'=>'out','cost'=>1],
        ['emoji'=>'🖼️','text'=>'Visit a gallery, museum or market','phase'=>'main','moods'=>['creative','quiet','romantic'],'loc'=>'out','cost'=>1],
        ['emoji'=>'🎳','text'=>'Do something a bit silly — bowling, mini-golf, arcade','phase'=>'main','moods'=>['fun','adventure'],'loc'=>'out','cost'=>2],
        ['emoji'=>'🌅','text'=>'Chase a sunrise or sunset with a view','phase'=>'main','moods'=>['romantic','outdoor','adventure'],'loc'=>'out','cost'=>0],
        ['emoji'=>'🧗','text'=>'Try something neither of you has done before','phase'=>'main','moods'=>['adventure','fun'],'loc'=>'out','cost'=>2],

        // ---- food / treat --------------------------------------------------
        ['emoji'=>'🍿','text'=>'Make a snack board from whatever\'s in the cupboard','phase'=>'eat','moods'=>'any','loc'=>'home','cost'=>0],
        ['emoji'=>'🍝','text'=>'Cook a proper dinner together','phase'=>'eat','moods'=>['romantic','creative','quiet'],'loc'=>'home','cost'=>1],
        ['emoji'=>'🍫','text'=>'Share one indulgent dessert, two spoons','phase'=>'eat','moods'=>['romantic','passionate'],'loc'=>'any','cost'=>1],
        ['emoji'=>'🥡','text'=>'Order in from a place you both love','phase'=>'eat','moods'=>['fun','quiet'],'loc'=>'home','cost'=>2],
        ['emoji'=>'🧺','text'=>'Have a picnic — a rug, some snacks, outside','phase'=>'eat','moods'=>['outdoor','romantic'],'loc'=>'out','cost'=>1],
        ['emoji'=>'🍸','text'=>'Find a cosy bar or café for one drink','phase'=>'eat','moods'=>['romantic','fun','quiet'],'loc'=>'out','cost'=>2],
        ['emoji'=>'🍽️','text'=>'Book a table somewhere you\'ve been meaning to try','phase'=>'eat','moods'=>['romantic','passionate'],'loc'=>'out','cost'=>3],

        // ---- closers -------------------------------------------------------
        ['emoji'=>'💬','text'=>'Ask each other: what was your favourite bit of today?','phase'=>'close','moods'=>'any','loc'=>'any','cost'=>0],
        ['emoji'=>'📸','text'=>'Take one photo together and save it to Our Story','phase'=>'close','moods'=>'any','loc'=>'any','cost'=>0],
        ['emoji'=>'🌟','text'=>'Each name one thing you appreciated tonight','phase'=>'close','moods'=>['quiet','romantic'],'loc'=>'any','cost'=>0],
        ['emoji'=>'🫂','text'=>'End with a long hug — no rush','phase'=>'close','moods'=>['romantic','passionate','quiet'],'loc'=>'any','cost'=>0],
    ];

    public static function costTier(int $budget): int
    {
        return match (true) {
            $budget <= 0  => 0,
            $budget <= 30 => 1,
            $budget <= 80 => 2,
            default       => 3,
        };
    }

    /**
     * @return array<int,array{emoji:string,text:string}>
     */
    public static function generate(string $mood, string $location, int $budget, int $minutes, int $nonce = 0): array
    {
        $mood = isset(self::MOODS[$mood]) ? $mood : 'romantic';
        $location = $location === 'out' ? 'out' : 'home';
        $tier = self::costTier($budget);
        $mains = $minutes >= 150 ? 3 : ($minutes >= 90 ? 2 : 1);

        $seed = crc32($mood . '|' . $location . '|' . $tier . '|' . $mains . '|' . $nonce);

        $pick = function (string $phase, int $salt, array $exclude = []) use ($mood, $location, $tier, $seed) {
            $candidates = [];
            foreach (self::IDEAS as $idea) {
                if ($idea['phase'] !== $phase) { continue; }
                if ($idea['loc'] !== 'any' && $idea['loc'] !== $location) { continue; }
                if ($idea['moods'] !== 'any' && !in_array($mood, (array) $idea['moods'], true)) { continue; }
                if ($idea['cost'] > $tier) { continue; }
                if (in_array($idea['text'], $exclude, true)) { continue; }
                $candidates[] = $idea;
            }
            // Relax the mood filter if nothing matched, so a plan is always produced.
            if ($candidates === []) {
                foreach (self::IDEAS as $idea) {
                    if ($idea['phase'] !== $phase) { continue; }
                    if ($idea['loc'] !== 'any' && $idea['loc'] !== $location) { continue; }
                    if ($idea['cost'] > $tier) { continue; }
                    if (in_array($idea['text'], $exclude, true)) { continue; }
                    $candidates[] = $idea;
                }
            }
            if ($candidates === []) {
                return null;
            }
            $idx = ($seed ^ $salt) % count($candidates);
            return $candidates[$idx];
        };

        $plan = [];
        $used = [];

        foreach (['open' => 11, 'main' => 23] as $phase => $salt) {
            $count = $phase === 'main' ? $mains : 1;
            for ($i = 0; $i < $count; $i++) {
                $idea = $pick($phase, $salt + $i * 7, $used);
                if ($idea) {
                    $plan[] = ['emoji' => $idea['emoji'], 'text' => $idea['text']];
                    $used[] = $idea['text'];
                }
            }
        }
        foreach (['eat' => 41, 'close' => 53] as $phase => $salt) {
            $idea = $pick($phase, $salt, $used);
            if ($idea) {
                $plan[] = ['emoji' => $idea['emoji'], 'text' => $idea['text']];
                $used[] = $idea['text'];
            }
        }

        return $plan;
    }

    /** A short human title for a generated plan. */
    public static function title(string $mood, string $location): string
    {
        $moodLabel = self::MOODS[$mood][1] ?? 'Date';
        return $moodLabel . ($location === 'home' ? ' night in' : ' night out');
    }
}
