<?php
declare(strict_types=1);

/**
 * Love vs Attraction, and the eight-dimension compatibility radar.
 *
 * Attraction is measured in peaks — intensity, novelty, chemistry.
 * Love is measured in averages — consistency, effort, repair, direction.
 * Each question loads onto one axis, and the verdict compares the two.
 */
final class Assessment
{
    public const LIKERT = [
        1 => 'Never',
        2 => 'Rarely',
        3 => 'Sometimes',
        4 => 'Often',
        5 => 'Always',
    ];

    /** @return array<int,array{id:string,axis:string,text:string,helper:?string}> */
    public static function questions(): array
    {
        return [
            ['id' => 'boring_tuesday', 'axis' => 'love', 'text' => 'We enjoy each other on an ordinary day with nothing planned.', 'helper' => 'Attraction needs stimulation. Love survives a quiet Tuesday.'],
            ['id' => 'inconvenient', 'axis' => 'love', 'text' => 'They show up for me when it is inconvenient for them.', 'helper' => null],
            ['id' => 'effort_mutual', 'axis' => 'love', 'text' => 'Effort between us is mutual — neither of us is always the one trying.', 'helper' => null],
            ['id' => 'repair', 'axis' => 'love', 'text' => 'After an argument we repair, rather than one of us going silent or winning.', 'helper' => null],
            ['id' => 'unimpressive', 'axis' => 'love', 'text' => 'I can be tired, wrong or unimpressive around them without performing.', 'helper' => null],
            ['id' => 'concrete_future', 'axis' => 'love', 'text' => 'We make concrete plans together — dates, money, cities, timelines.', 'helper' => null],
            ['id' => 'bad_news', 'axis' => 'love', 'text' => 'When I bring bad news, they ask a second question instead of changing the subject.', 'helper' => null],
            ['id' => 'respect_boundaries', 'axis' => 'love', 'text' => 'They respect my time with friends, hobbies and family without making it a problem.', 'helper' => null],
            ['id' => 'consistency', 'axis' => 'love', 'text' => 'Their behaviour is consistent — what they say and what they do match.', 'helper' => null],
            ['id' => 'support_ambition', 'axis' => 'love', 'text' => 'They actively support my ambitions, even when it costs them time.', 'helper' => null],

            ['id' => 'physical_pull', 'axis' => 'attraction', 'text' => 'The physical pull between us is intense.', 'helper' => null],
            ['id' => 'novelty_needed', 'axis' => 'attraction', 'text' => 'Things feel flat unless something new or exciting is happening.', 'helper' => null],
            ['id' => 'overthink_messages', 'axis' => 'attraction', 'text' => 'I re-read their messages and analyse their tone.', 'helper' => null],
            ['id' => 'chase', 'axis' => 'attraction', 'text' => 'Part of the excitement is not being sure where I stand.', 'helper' => null],
            ['id' => 'jealousy', 'axis' => 'attraction', 'text' => 'I feel jealous or possessive more often than secure.', 'helper' => null],
            ['id' => 'idealise', 'axis' => 'attraction', 'text' => 'I find it hard to name anything genuinely annoying about them.', 'helper' => null],
            ['id' => 'highs_lows', 'axis' => 'attraction', 'text' => 'Our relationship swings between very high highs and very low lows.', 'helper' => null],
            ['id' => 'appearance_first', 'axis' => 'attraction', 'text' => 'What I value most about them is how they look, or how they make me feel in public.', 'helper' => null],
            ['id' => 'avoid_hard_talks', 'axis' => 'attraction', 'text' => 'We avoid difficult conversations to keep the mood good.', 'helper' => null],
            ['id' => 'fear_ending', 'axis' => 'attraction', 'text' => 'I stay partly because I fear how it would feel to lose the intensity.', 'helper' => null],
        ];
    }

    /**
     * @param array<string,int> $answers question id => 1–5
     * @return array{love:int,attraction:int,difference:int,key:string,verdict:string,summary:string,guidance:array}
     */
    public static function score(array $answers): array
    {
        $questions = self::questions();

        $collect = static function (string $axis) use ($questions, $answers): array {
            $values = [];
            $total = 0;

            foreach ($questions as $question) {
                if ($question['axis'] !== $axis) {
                    continue;
                }
                $total++;
                $raw = $answers[$question['id']] ?? null;
                if (is_numeric($raw) && (int) $raw >= 1 && (int) $raw <= 5) {
                    $values[] = (int) $raw;
                }
            }

            if ($values === []) {
                return ['score' => 0, 'answered' => 0, 'total' => $total];
            }

            // A 1–5 Likert average mapped onto 0–100.
            $mean = array_sum($values) / count($values);
            return [
                'score'    => (int) round((($mean - 1) / 4) * 100),
                'answered' => count($values),
                'total'    => $total,
            ];
        };

        $love = $collect('love');
        $attraction = $collect('attraction');

        $loveScore = $love['score'];
        $attractionScore = $attraction['score'];
        $difference = $loveScore - $attractionScore;
        $answeredRatio = ($love['answered'] + $attraction['answered']) / max(1, count($questions));

        if ($answeredRatio < 0.6) {
            return [
                'love'        => $loveScore,
                'attraction'  => $attractionScore,
                'difference'  => $difference,
                'key'         => 'early',
                'verdict'     => 'Not enough answers yet',
                'summary'     => 'Answer at least 12 questions for a meaningful result.',
                'guidance'    => ['Finish the assessment, then ask your partner to take it independently.'],
            ];
        }

        if ($loveScore >= 70 && $attractionScore >= 60) {
            return self::result($loveScore, $attractionScore, $difference, 'love_with_spark',
                'Love — with the spark intact',
                'Your answers describe consistency and chemistry together. This is the healthiest combination: the intensity is real, and it is sitting on top of reliable behaviour.',
                [
                    'Keep the weekly check-in — this is exactly the state that quietly erodes without maintenance.',
                    'Protect novelty deliberately: plan something new each month rather than waiting for it.',
                    'Watch the fairness balance index. Strong couples usually break on effort, not on feeling.',
                ]
            );
        }

        if ($loveScore >= 70) {
            return self::result($loveScore, $attractionScore, $difference, 'love',
                'Love — built on consistency',
                'The structure is there: mutual effort, repair after conflict, real plans. Attraction scores lower, which usually means comfort has replaced intensity rather than that something is wrong.',
                [
                    'Reintroduce novelty on purpose — new places, new activities, phone-free dates.',
                    'Say the appreciation out loud. Long-term couples assume it is understood; it is not.',
                    'Book physical time the way you book everything else.',
                ]
            );
        }

        if ($attractionScore >= 70 && $loveScore < 50) {
            return self::result($loveScore, $attractionScore, $difference, 'infatuation',
                'Attraction — not yet love',
                'High intensity, low consistency. The highs and lows, the jealousy, the avoided conversations — these are the signature of infatuation rather than a stable bond.',
                [
                    'Test it against a boring week: how does it feel with nothing exciting happening?',
                    'Have one difficult conversation you have been avoiding, and watch what happens next.',
                    'Track effort for six weeks. Infatuation shows spikes and collapses; love shows a stable line.',
                ]
            );
        }

        if ($attractionScore > $loveScore + 10) {
            return self::result($loveScore, $attractionScore, $difference, 'attraction_led',
                'Attraction-led',
                'Chemistry is currently carrying more weight than structure. That is normal early on — it becomes a problem only if it stays that way past the first year.',
                [
                    'Make one concrete plan together with a date attached.',
                    'Notice who initiates repair after conflict. If it is always the same person, that is the imbalance.',
                    'Ask your partner to take this assessment independently, then compare.',
                ]
            );
        }

        if (abs($difference) <= 10) {
            return self::result($loveScore, $attractionScore, $difference, 'balanced',
                'Balanced — early but promising',
                'Love and attraction are scoring similarly. The foundation is forming; consistency over the next few months is what decides which way it settles.',
                [
                    'Start the weekly fairness ritual now — habits are cheap to build early.',
                    'Watch the deal-breaker area carefully; it is the one that never improves on its own.',
                    'Re-take this in eight weeks and compare the two results.',
                ]
            );
        }

        return self::result($loveScore, $attractionScore, $difference, 'early',
            'Unclear — more data needed',
            'Your answers do not lean strongly either way. That usually means the relationship is new, or that it is in a flat period.',
            [
                'Log emotions daily for four weeks, then re-take this.',
                'Ask your partner to take it separately — the gap between your two results is the most useful number.',
            ]
        );
    }

    private static function result(int $love, int $attraction, int $difference, string $key, string $verdict, string $summary, array $guidance): array
    {
        return compact('love', 'attraction', 'difference', 'key', 'verdict', 'summary', 'guidance');
    }

    /* ------------------------------------------------------- Compatibility */

    /** @return array<int,array{key:string,label:string,emoji:string,question:string}> */
    public static function dimensions(): array
    {
        return [
            ['key' => 'emotional',    'label' => 'Emotional',     'emoji' => '🤝', 'question' => 'How understood do you feel by your partner right now?'],
            ['key' => 'communication','label' => 'Communication', 'emoji' => '💬', 'question' => 'How easily can you raise a hard subject?'],
            ['key' => 'trust',        'label' => 'Trust',         'emoji' => '🧠', 'question' => 'How secure do you feel about their loyalty and honesty?'],
            ['key' => 'financial',    'label' => 'Financial',     'emoji' => '💸', 'question' => 'How fair does the money side feel to you?'],
            ['key' => 'intimacy',     'label' => 'Affection',     'emoji' => '💕', 'question' => 'How satisfied are you with affection and closeness?'],
            ['key' => 'lifestyle',    'label' => 'Lifestyle',     'emoji' => '🏡', 'question' => 'How well do your daily routines and habits fit together?'],
            ['key' => 'future_goals', 'label' => 'Future',        'emoji' => '🎯', 'question' => 'How aligned are you on where this is going?'],
            ['key' => 'conflict',     'label' => 'Conflict',      'emoji' => '⚖️', 'question' => 'How well do you repair after a disagreement?'],
        ];
    }

    /**
     * @param array<string,int> $mine   dimension key => 1–10
     * @param array<string,int>|null $theirs
     */
    public static function compatibility(array $mine, ?array $theirs): array
    {
        $dimensions = [];

        foreach (self::dimensions() as $dimension) {
            $a = (float) ($mine[$dimension['key']] ?? 0);
            $b = isset($theirs[$dimension['key']]) ? (float) $theirs[$dimension['key']] : null;
            $combined = $b === null ? $a : ($a + $b) / 2;

            $dimensions[] = $dimension + [
                'mine'   => $a,
                'theirs' => $b,
                'score'  => (int) round(($combined / 10) * 100),
                'gap'    => $b === null ? null : abs($a - $b),
            ];
        }

        $withData = array_values(array_filter($dimensions, static fn ($d) => $d['mine'] > 0));
        $overall = $withData === []
            ? 0
            : (int) round(array_sum(array_column($withData, 'score')) / count($withData));

        $gaps = array_values(array_filter($dimensions, static fn ($d) => $d['gap'] !== null));
        usort($gaps, static fn ($x, $y) => $y['gap'] <=> $x['gap']);

        return [
            'overall'     => $overall,
            'dimensions'  => $dimensions,
            'biggest_gap' => $gaps[0] ?? null,
        ];
    }
}
