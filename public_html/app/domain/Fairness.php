<?php
declare(strict_types=1);

/**
 * The fairness engine.
 *
 * Each partner scores themselves and the other, independently, on ten areas.
 * This turns those two sets of entries into a balance index, a weighted overall
 * score, the perception gaps between the two sides, and plain-language
 * insights. Nothing here writes to the database.
 */
final class Fairness
{
    public const RISK_META = [
        'healthy'  => ['label' => 'Healthy',  'tone' => 'success', 'description' => 'Balanced effort and consistent scoring from both sides.'],
        'watch'    => ['label' => 'Watch',    'tone' => 'warning', 'description' => 'Minor imbalance — worth one conversation this week.'],
        'strained' => ['label' => 'Strained', 'tone' => 'warning', 'description' => 'Effort is meaningfully one-sided over this period.'],
        'critical' => ['label' => 'Critical', 'tone' => 'danger',  'description' => 'Serious imbalance, or a deal-breaker area scoring low.'],
    ];

    /* ------------------------------------------------------------- Utilities */

    private static function round(float $value, int $places = 1): float
    {
        return round($value, $places);
    }

    /** @param array<int,float> $values */
    private static function avg(array $values): float
    {
        $values = array_values(array_filter($values, static fn ($v) => $v !== null));
        return $values === [] ? 0.0 : array_sum($values) / count($values);
    }

    /** Effort on a 0–100 scale: effort_self when given, otherwise self_score × 10. */
    private static function effortOf(?array $entry): ?float
    {
        if ($entry === null) {
            return null;
        }
        if ($entry['effort_self'] !== null && $entry['effort_self'] !== '') {
            return (float) $entry['effort_self'];
        }
        if ($entry['self_score'] !== null && $entry['self_score'] !== '') {
            return ((float) $entry['self_score']) * 10;
        }
        return null;
    }

    /** Averages a column across a member's entries, ignoring blanks and zeros. */
    private static function averageColumn(array $entries, string $column): float
    {
        $values = [];
        foreach ($entries as $entry) {
            $value = $entry[$column] ?? null;
            if ($value !== null && $value !== '' && (float) $value > 0) {
                $values[] = (float) $value;
            }
        }
        return self::round(self::avg($values));
    }

    /* ---------------------------------------------------------------- Report */

    /**
     * @param array $categories Rows from `fairness_categories`
     * @param array $entries    Rows from `fairness_entries` for one period
     * @param array $memberA    ['user_id' => …, 'name' => …]
     * @param array|null $memberB
     */
    public static function report(string $period, array $categories, array $entries, array $memberA, ?array $memberB): array
    {
        $entriesA = array_values(array_filter($entries, static fn ($e) => $e['user_id'] === $memberA['user_id']));
        $entriesB = $memberB
            ? array_values(array_filter($entries, static fn ($e) => $e['user_id'] === $memberB['user_id']))
            : [];

        $a = self::memberScores($entriesA, $memberA);
        $b = self::memberScores($entriesB, $memberB ?? ['user_id' => '', 'name' => 'Partner B']);

        $breakdown = [];
        foreach ($categories as $category) {
            $breakdown[] = self::categoryBreakdown($category, $entriesA, $entriesB);
        }

        // Weighted overall score across the categories that have any data.
        $weightSum = 0.0;
        $weighted = 0.0;
        foreach ($breakdown as $row) {
            if ($row['score'] !== null) {
                $weightSum += $row['weight'];
                $weighted += $row['score'] * $row['weight'];
            }
        }
        $overall = $weightSum > 0 ? self::round($weighted / $weightSum) : 0.0;

        $totalEffort = $a['effort'] + $b['effort'];
        $balance = $totalEffort > 0
            ? self::round(max(0, 100 - (abs($a['effort'] - $b['effort']) / $totalEffort) * 200))
            : 0.0;

        $expected = count($categories) * ($memberB ? 2 : 1);
        $completeness = $expected > 0
            ? (int) round(((count($entriesA) + count($entriesB)) / $expected) * 100)
            : 0;

        $respectDelta = self::round(abs($a['respect'] - $b['respect']));
        $loyaltyDelta = self::round(abs($a['loyalty'] - $b['loyalty']));

        $risk = self::risk($overall, $balance, $breakdown, $completeness);

        return [
            'period'        => $period,
            'overall_score' => $overall,
            'balance_index' => $balance,
            'effort_a'      => $a['effort'],
            'effort_b'      => $b['effort'],
            'respect_delta' => $respectDelta,
            'loyalty_delta' => $loyaltyDelta,
            'risk_level'    => $risk,
            'verdict'       => self::verdict($risk, $balance, $a, $b, $completeness),
            'completeness'  => $completeness,
            'categories'    => $breakdown,
            'insights'      => self::insights($breakdown, $a, $b, $balance, $respectDelta, $loyaltyDelta, $completeness),
            'member_a'      => $a,
            'member_b'      => $b,
        ];
    }

    private static function memberScores(array $entries, array $member): array
    {
        $efforts = [];
        foreach ($entries as $entry) {
            $effort = self::effortOf($entry);
            if ($effort !== null) {
                $efforts[] = $effort;
            }
        }

        return [
            'user_id'      => $member['user_id'] ?? '',
            'name'         => $member['name'] ?? 'Partner',
            'effort'       => self::round(self::avg($efforts)),
            'self_score'   => self::averageColumn($entries, 'self_score'),
            'partner_score'=> self::averageColumn($entries, 'partner_score'),
            'respect'      => self::averageColumn($entries, 'respect_score'),
            'loyalty'      => self::averageColumn($entries, 'loyalty_score'),
            'satisfaction' => self::averageColumn($entries, 'satisfaction'),
            'entries'      => count($entries),
        ];
    }

    private static function categoryBreakdown(array $category, array $entriesA, array $entriesB): array
    {
        $find = static function (array $list, string $categoryId): ?array {
            foreach ($list as $entry) {
                if ($entry['category_id'] === $categoryId) {
                    return $entry;
                }
            }
            return null;
        };

        $ea = $find($entriesA, $category['id']);
        $eb = $find($entriesB, $category['id']);

        $effortA = self::effortOf($ea);
        $effortB = self::effortOf($eb);

        // Agreement compares how I rated myself with how my partner rated me.
        $agreementValues = [];
        if ($ea && $eb && $ea['self_score'] !== null && $eb['partner_score'] !== null) {
            $agreementValues[] = 10 - abs((float) $ea['self_score'] - (float) $eb['partner_score']);
        }
        if ($ea && $eb && $eb['self_score'] !== null && $ea['partner_score'] !== null) {
            $agreementValues[] = 10 - abs((float) $eb['self_score'] - (float) $ea['partner_score']);
        }

        $scoreValues = [];
        foreach ([[$ea, 'self_score'], [$ea, 'partner_score'], [$eb, 'self_score'], [$eb, 'partner_score']] as [$entry, $column]) {
            if ($entry !== null && $entry[$column] !== null && $entry[$column] !== '') {
                $scoreValues[] = (float) $entry[$column];
            }
        }

        $gap = ($effortA !== null && $effortB !== null) ? abs($effortA - $effortB) : 0.0;

        $status = 'missing';
        if ($effortA !== null && $effortB !== null) {
            $status = $gap <= 15 ? 'balanced' : ($effortA > $effortB ? 'tilted_a' : 'tilted_b');
        }

        return [
            'category_id'    => $category['id'],
            'slug'           => $category['slug'],
            'name'           => $category['name'],
            'emoji'          => $category['emoji'],
            'fair_rule'      => $category['fair_rule'],
            'weight'         => (float) ($category['weight'] ?? 1),
            'is_dealbreaker' => Str::bool($category['is_dealbreaker'] ?? false),
            'a'              => ['self' => $ea['self_score'] ?? null, 'partner' => $ea['partner_score'] ?? null, 'effort' => $effortA],
            'b'              => ['self' => $eb['self_score'] ?? null, 'partner' => $eb['partner_score'] ?? null, 'effort' => $effortB],
            'gap'            => self::round($gap),
            'agreement'      => $agreementValues === [] ? null : self::round(self::avg($agreementValues) * 10),
            'score'          => $scoreValues === [] ? null : self::round(self::avg($scoreValues) * 10),
            'status'         => $status,
            'note_a'         => $ea['note'] ?? null,
            'note_b'         => $eb['note'] ?? null,
            'partner_note_a' => $ea['partner_note'] ?? null,
            'partner_note_b' => $eb['partner_note'] ?? null,
        ];
    }

    private static function risk(float $overall, float $balance, array $breakdown, int $completeness): string
    {
        if ($completeness < 20) {
            return 'watch';
        }

        foreach ($breakdown as $row) {
            if ($row['is_dealbreaker'] && $row['score'] !== null && $row['score'] < 60) {
                return 'critical';
            }
        }

        if ($balance >= 80 && $overall >= 70) {
            return 'healthy';
        }
        if ($balance >= 60 && $overall >= 55) {
            return 'watch';
        }
        if ($balance >= 40 || $overall >= 40) {
            return 'strained';
        }
        return 'critical';
    }

    private static function verdict(string $risk, float $balance, array $a, array $b, int $completeness): string
    {
        if ($completeness < 20) {
            return 'Not enough entries yet. Both partners need to complete their own side before the report means anything.';
        }

        $heavier = $a['effort'] > $b['effort'] ? $a['name'] : $b['name'];
        $lighter = $a['effort'] > $b['effort'] ? $b['name'] : $a['name'];

        return match ($risk) {
            'healthy'  => "Effort is balanced ({$balance}/100) and you are both scoring the relationship consistently. Keep the weekly ritual — this is what stable looks like.",
            'watch'    => "Mostly balanced, but {$heavier} is carrying slightly more than {$lighter} this period. One conversation now prevents a pattern later.",
            'strained' => "Effort is meaningfully one-sided: {$heavier} is doing noticeably more than {$lighter}. Over time this is the pattern that turns into resentment.",
            default    => 'This period shows a serious imbalance or a deal-breaker score. Address it directly — and if abuse, manipulation or repeated dishonesty is involved, seek outside support.',
        };
    }

    private static function insights(
        array $breakdown,
        array $a,
        array $b,
        float $balance,
        float $respectDelta,
        float $loyaltyDelta,
        int $completeness
    ): array {
        $insights = [];

        if ($completeness < 100) {
            $insights[] = [
                'tone'   => $completeness < 50 ? 'warning' : 'neutral',
                'title'  => "{$completeness}% of entries completed",
                'detail' => 'A fairness report only works when both partners answer independently. Missing categories are left out of the score.',
            ];
        }

        if ($balance >= 85) {
            $difference = number_format(abs($a['effort'] - $b['effort']), 0);
            $insights[] = [
                'tone'   => 'positive',
                'title'  => 'Effort is close to even',
                'detail' => "{$a['name']} and {$b['name']} are within {$difference} points of each other. That is what a fair week looks like.",
            ];
        }

        $tilted = array_values(array_filter(
            $breakdown,
            static fn ($row) => in_array($row['status'], ['tilted_a', 'tilted_b'], true)
        ));
        usort($tilted, static fn ($x, $y) => $y['gap'] <=> $x['gap']);

        foreach (array_slice($tilted, 0, 3) as $row) {
            $heavier = $row['status'] === 'tilted_a' ? $a['name'] : $b['name'];
            $lighter = $row['status'] === 'tilted_a' ? $b['name'] : $a['name'];
            $gap = number_format($row['gap'], 0);

            $insights[] = [
                'tone'     => $row['gap'] > 35 ? 'warning' : 'neutral',
                'title'    => trim(($row['emoji'] ?? '') . ' ' . $row['name']) . ": {$gap}-point gap",
                'detail'   => "{$heavier} is putting in more here than {$lighter}. Fair rule: {$row['fair_rule']}",
                'category' => $row['slug'],
            ];
        }

        $disagreements = array_values(array_filter(
            $breakdown,
            static fn ($row) => $row['agreement'] !== null && $row['agreement'] < 60
        ));
        usort($disagreements, static fn ($x, $y) => $x['agreement'] <=> $y['agreement']);

        foreach (array_slice($disagreements, 0, 2) as $row) {
            $insights[] = [
                'tone'     => 'warning',
                'title'    => "You see {$row['name']} differently",
                'detail'   => 'One of you rated this far higher than the other rated them. That gap in perception is usually the real argument.',
                'category' => $row['slug'],
            ];
        }

        if ($respectDelta >= 3) {
            $insights[] = [
                'tone'   => 'warning',
                'title'  => 'Respect is not symmetrical',
                'detail' => 'Respect scores differ by ' . number_format($respectDelta, 1) . ' points. Fair rule: freedom and respect should be equal — not one controlling the other.',
            ];
        }

        if ($loyaltyDelta >= 3) {
            $insights[] = [
                'tone'   => 'critical',
                'title'  => 'Loyalty scores diverge',
                'detail' => 'Trust is built by both and broken by one, but it affects both. Talk about what changed before it compounds.',
            ];
        }

        foreach ($breakdown as $row) {
            if ($row['is_dealbreaker'] && $row['score'] !== null && $row['score'] < 70) {
                $insights[] = [
                    'tone'     => 'critical',
                    'title'    => 'Deal breaker flagged',
                    'detail'   => 'Abuse, manipulation and repeated dishonesty are non-negotiable, and they apply equally to both partners. If you are in danger, contact your local emergency service.',
                    'category' => $row['slug'],
                ];
                break;
            }
        }

        $scored = array_values(array_filter($breakdown, static fn ($row) => $row['score'] !== null));
        usort($scored, static fn ($x, $y) => $y['score'] <=> $x['score']);

        if ($scored !== [] && $scored[0]['score'] >= 80) {
            $insights[] = [
                'tone'     => 'positive',
                'title'    => trim(($scored[0]['emoji'] ?? '') . ' ' . $scored[0]['name']) . ' is your strongest area',
                'detail'   => 'Protect this one — it is usually what carries a relationship through the weaker areas.',
                'category' => $scored[0]['slug'],
            ];
        }

        return $insights;
    }

    /* ----------------------------------------------------------------- Trend */

    /** Effort and balance per period, for the trend chart. */
    public static function trend(array $entries, string $memberAId, ?string $memberBId): array
    {
        $buckets = [];

        foreach ($entries as $entry) {
            $effort = self::effortOf($entry);
            if ($effort === null) {
                continue;
            }

            $period = (string) $entry['period'];
            $buckets[$period] ??= ['a' => [], 'b' => []];

            if ($entry['user_id'] === $memberAId) {
                $buckets[$period]['a'][] = $effort;
            } elseif ($memberBId !== null && $entry['user_id'] === $memberBId) {
                $buckets[$period]['b'][] = $effort;
            }
        }

        ksort($buckets);

        $series = [];
        foreach ($buckets as $period => $bucket) {
            $effortA = self::round(self::avg($bucket['a']));
            $effortB = self::round(self::avg($bucket['b']));
            $total = $effortA + $effortB;

            $series[] = [
                'period'   => $period,
                'label'    => date('j M', strtotime($period)),
                'effort_a' => $effortA,
                'effort_b' => $effortB,
                'balance'  => $total > 0 ? self::round(max(0, 100 - (abs($effortA - $effortB) / $total) * 200)) : 0.0,
            ];
        }

        return $series;
    }

    /** Stores the computed report so history survives a plan downgrade. */
    public static function snapshot(string $coupleId, array $report): void
    {
        Db::run(
            'INSERT INTO fairness_reports
               (id, couple_id, period, period_type, overall_score, balance_index, effort_a, effort_b,
                respect_delta, loyalty_delta, verdict, risk_level, breakdown, insights, generated_at)
             VALUES (?, ?, ?, "week", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE
               overall_score = VALUES(overall_score),
               balance_index = VALUES(balance_index),
               effort_a      = VALUES(effort_a),
               effort_b      = VALUES(effort_b),
               respect_delta = VALUES(respect_delta),
               loyalty_delta = VALUES(loyalty_delta),
               verdict       = VALUES(verdict),
               risk_level    = VALUES(risk_level),
               breakdown     = VALUES(breakdown),
               insights      = VALUES(insights),
               generated_at  = UTC_TIMESTAMP()',
            [
                Str::uuid(),
                $coupleId,
                $report['period'],
                $report['overall_score'],
                $report['balance_index'],
                $report['effort_a'],
                $report['effort_b'],
                $report['respect_delta'],
                $report['loyalty_delta'],
                $report['verdict'],
                $report['risk_level'],
                json_encode($report['categories'], JSON_UNESCAPED_UNICODE),
                json_encode($report['insights'], JSON_UNESCAPED_UNICODE),
            ]
        );
    }
}
