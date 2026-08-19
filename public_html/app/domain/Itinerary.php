<?php
declare(strict_types=1);

/**
 * The itinerary generator.
 *
 * Builds a day-by-day plan from a destination's attractions. It is
 * deterministic: the same inputs always produce the same plan, so both
 * partners can regenerate it and see exactly the same days.
 */
final class Itinerary
{
    private const PACE = [
        'relaxed'  => ['activities' => 2, 'start_hour' => 10, 'gap' => 90],
        'balanced' => ['activities' => 3, 'start_hour' => 9,  'gap' => 60],
        'packed'   => ['activities' => 5, 'start_hour' => 8,  'gap' => 30],
    ];

    /**
     * A generated day has to stay inside one calendar day. Without these an
     * over-full day pushes the clock past midnight, the times wrap around and
     * dinner lands at 02:30 in front of the morning.
     */
    private const LAST_ACTIVITY_START = 20 * 60; // 20:00
    private const LATEST_DINNER       = 21 * 60; // 21:00

    /**
     * A trip can be longer than the destination has catalogued attractions and
     * highlights. Rather than repeat the same three entries on every remaining
     * day, the plan offers deliberately open time — which is what a long stay
     * actually wants, and is honest about there being nothing else booked.
     */
    private const OPEN_DAY = [
        'Open time — coffee, a market, no plan',
        'Wander a neighbourhood you have not seen yet',
        'Day trip — pick somewhere an hour or two out',
        'Shopping and gifts to take home',
        'Revisit your favourite spot so far, properly this time',
        'Deliberately nothing booked',
        'Something one of you has wanted to do all trip',
    ];

    private const INTEREST_CATEGORIES = [
        'romance'    => ['romantic', 'sightseeing', 'nature'],
        'culture'    => ['museum', 'religious', 'sightseeing'],
        'food'       => ['food', 'shopping'],
        'nature'     => ['nature', 'beach'],
        'adventure'  => ['adventure', 'nature'],
        'nightlife'  => ['nightlife', 'food'],
        'shopping'   => ['shopping'],
        'relaxation' => ['beach', 'nature'],
        'family'     => ['family', 'sightseeing'],
    ];

    public const INTERESTS = [
        ['value' => 'romance',    'label' => 'Romance',           'emoji' => '💕'],
        ['value' => 'culture',    'label' => 'Culture & history', 'emoji' => '🏛️'],
        ['value' => 'food',       'label' => 'Food & wine',       'emoji' => '🍷'],
        ['value' => 'nature',     'label' => 'Nature',            'emoji' => '🌿'],
        ['value' => 'adventure',  'label' => 'Adventure',         'emoji' => '🧗'],
        ['value' => 'nightlife',  'label' => 'Nightlife',         'emoji' => '🌃'],
        ['value' => 'shopping',   'label' => 'Shopping',          'emoji' => '🛍️'],
        ['value' => 'relaxation', 'label' => 'Relaxation',        'emoji' => '🧘'],
    ];

    /**
     * @param array $options {
     *   destination: array, attractions: array, start_date: ?string, days: int,
     *   pace: string, interests: array, include_meals: bool, romantic: bool
     * }
     * @return array<int,array> One entry per day
     */
    public static function generate(array $options): array
    {
        $destination = $options['destination'];
        $days = max(1, min(21, (int) $options['days']));
        $pace = isset(self::PACE[$options['pace']]) ? $options['pace'] : 'balanced';
        $config = self::PACE[$pace];
        $interests = $options['interests'] ?? [];
        $includeMeals = $options['include_meals'] ?? true;
        $romantic = $options['romantic'] ?? true;

        $ranked = $options['attractions'];
        usort(
            $ranked,
            static fn ($a, $b) => self::score($b, $interests, $romantic) <=> self::score($a, $interests, $romantic)
        );

        $highlights = array_values(array_filter(Str::json($destination['highlights'] ?? null)));
        $location = $destination['city'] ?: $destination['name'];
        $dailyCost = (int) ($destination['avg_daily_cost_usd'] ?? 120);

        $plan = [];
        $cursor = 0;
        $fallbackCursor = 0;
        $openCursor = 0;

        for ($dayIndex = 0; $dayIndex < $days; $dayIndex++) {
            $items = [];
            $clock = $config['start_hour'] * 60;
            $isFirst = $dayIndex === 0;
            $isLast = $dayIndex === $days - 1 && $days > 1;

            if ($isFirst) {
                $items[] = [
                    '_at'              => max(0, ($config['start_hour'] - 1) * 60),
                    'start_time'       => self::clock(max(0, ($config['start_hour'] - 1) * 60)),
                    'end_time'         => self::clock($config['start_hour'] * 60),
                    'title'            => 'Arrival & hotel check-in',
                    'item_type'        => 'hotel',
                    'location'         => $location,
                    'description'      => 'Drop the bags, sort local currency and a data eSIM, then start slowly.',
                    'duration_minutes' => 60,
                    'cost_cents'       => null,
                    'attraction_id'    => null,
                ];
            }

            $activityCount = $isLast ? max(1, $config['activities'] - 1) : $config['activities'];

            for ($slot = 0; $slot < $activityCount; $slot++) {
                // Never start something new so late that the day spills over.
                if ($clock > self::LAST_ACTIVITY_START) {
                    break;
                }

                $attraction = self::pick($ranked, $cursor, $clock);

                if ($attraction !== null) {
                    $duration = (int) ($attraction['duration_minutes'] ?? 120);
                    $items[] = [
                        '_at'              => $clock,
                        'start_time'       => self::clock($clock),
                        'end_time'         => self::clock($clock + $duration),
                        'title'            => $attraction['name'],
                        'item_type'        => 'activity',
                        'location'         => $attraction['address'] ?: $attraction['name'],
                        'description'      => $attraction['description'] ?? null,
                        'duration_minutes' => $duration,
                        'cost_cents'       => $attraction['ticket_price_usd'] !== null
                            ? (int) round(((float) $attraction['ticket_price_usd']) * 100)
                            : null,
                        'attraction_id'    => $attraction['id'],
                    ];
                    $cursor++;
                    $clock += $duration + $config['gap'];
                } else {
                    // Once the real attractions run out the plan falls back to
                    // the destination's highlights. Walk forward to the first
                    // one that reads as the right time of day, so "at sunrise"
                    // does not land in the afternoon — then always advance past
                    // whatever was used, so later days get different entries.
                    $count = count($highlights);

                    if ($count > 0 && $fallbackCursor < $count) {
                        $chosen = $fallbackCursor;

                        for ($tries = 0; $tries < $count - $fallbackCursor; $tries++) {
                            $index = $fallbackCursor + $tries;
                            if (self::fitsClock(['name' => $highlights[$index]], $clock)) {
                                $chosen = $index;
                                break;
                            }
                        }

                        $title = $highlights[$chosen];
                        $fallbackCursor = $chosen + 1;
                    } else {
                        // Everything catalogued has been used — offer open time.
                        $title = self::OPEN_DAY[$openCursor % count(self::OPEN_DAY)];
                        $openCursor++;
                    }

                    $items[] = [
                        '_at'              => $clock,
                        'start_time'       => self::clock($clock),
                        'end_time'         => self::clock($clock + 150),
                        'title'            => $title,
                        'item_type'        => 'activity',
                        'location'         => $location,
                        'description'      => null,
                        'duration_minutes' => 150,
                        'cost_cents'       => null,
                        'attraction_id'    => null,
                    ];
                    $clock += 150 + $config['gap'];
                }

                // Lunch after the first block, once the clock has passed midday.
                if ($includeMeals && $slot === 0 && $clock >= 12 * 60) {
                    $items[] = [
                        '_at'              => $clock,
                        'start_time'       => self::clock($clock),
                        'end_time'         => self::clock($clock + 75),
                        'title'            => 'Lunch — a local spot away from the main square',
                        'item_type'        => 'meal',
                        'location'         => $location,
                        'description'      => null,
                        'duration_minutes' => 75,
                        'cost_cents'       => (int) round($dailyCost * 0.15 * 100),
                        'attraction_id'    => null,
                    ];
                    $clock += 90;
                }
            }

            if ($includeMeals) {
                $dinner = min(max($clock, 19 * 60), self::LATEST_DINNER);
                $items[] = [
                    '_at'              => $dinner,
                    'start_time'       => self::clock($dinner),
                    'end_time'         => self::clock($dinner + 105),
                    'title'            => $romantic ? 'Dinner — book the table with the view' : 'Dinner in the old town',
                    'item_type'        => 'meal',
                    'location'         => $location,
                    'description'      => null,
                    'duration_minutes' => 105,
                    'cost_cents'       => (int) round($dailyCost * 0.25 * 100),
                    'attraction_id'    => null,
                ];
            }

            if ($isLast) {
                $items[] = [
                    '_at'              => 16 * 60,
                    'start_time'       => self::clock(16 * 60),
                    'end_time'         => self::clock(19 * 60),
                    'title'            => 'Check-out, last-minute gifts & transfer',
                    'item_type'        => 'transport',
                    'location'         => $location,
                    'description'      => 'Leave three hours before an international departure.',
                    'duration_minutes' => 180,
                    'cost_cents'       => null,
                    'attraction_id'    => null,
                ];
            }

            // Sort on the real minute offset, not the formatted string, so an
            // item is never reordered by a wrapped clock face.
            usort($items, static fn ($a, $b) => $a['_at'] <=> $b['_at']);
            $items = array_map(static function (array $item): array {
                unset($item['_at']);
                return $item;
            }, $items);

            $plan[] = [
                'day_number' => $dayIndex + 1,
                'day_date'   => $options['start_date'] ? self::addDays($options['start_date'], $dayIndex) : null,
                'title'      => $isFirst
                    ? "Arrival in {$location}"
                    : ($isLast ? "Last morning in {$location}" : 'Day ' . ($dayIndex + 1) . " in {$location}"),
                'summary'    => self::summarise($items, $pace),
                'items'      => $items,
            ];
        }

        return $plan;
    }

    /** Total planned spend across every day, in cents. */
    public static function estimateCost(array $plan): int
    {
        $total = 0;
        foreach ($plan as $day) {
            foreach ($day['items'] as $item) {
                $total += (int) ($item['cost_cents'] ?? 0);
            }
        }
        return $total;
    }

    private static function score(array $attraction, array $interests, bool $romantic): float
    {
        $score = Str::bool($attraction['is_must_see'] ?? false) ? 40.0 : 10.0;

        if ($romantic && Str::bool($attraction['is_romantic'] ?? false)) {
            $score += 25;
        }

        $score += ((float) ($attraction['rating'] ?? 4.5)) * 4;

        $wanted = [];
        foreach ($interests as $interest) {
            foreach (self::INTEREST_CATEGORIES[$interest] ?? [$interest] as $category) {
                $wanted[$category] = true;
            }
        }

        if (isset($wanted[$attraction['category'] ?? ''])) {
            $score += 30;
        }

        return $score;
    }

    /**
     * When something is worth doing. Uses the attraction's own `best_time`
     * when an admin has filled it in, and otherwise reads the name — a
     * "Sunrise Trek" at 15:00 or a "Dinner Cruise" at 08:00 makes the whole
     * plan look wrong even when the arithmetic is right.
     *
     * @return 'morning'|'evening'|'any'
     */
    private static function timeOfDay(array $attraction): string
    {
        $haystack = strtolower(
            (string) ($attraction['best_time'] ?? '') . ' ' . (string) ($attraction['name'] ?? '')
        );

        foreach (['sunrise', 'dawn', 'breakfast', 'early morning', 'morning'] as $needle) {
            if (str_contains($haystack, $needle)) {
                return 'morning';
            }
        }

        foreach (['sunset', 'dinner', 'night', 'evening', 'golden hour', 'after dark', 'nightlife'] as $needle) {
            if (str_contains($haystack, $needle)) {
                return 'evening';
            }
        }

        return 'any';
    }

    /** True when an attraction suits the time the day has reached. */
    private static function fitsClock(array $attraction, int $clock): bool
    {
        return match (self::timeOfDay($attraction)) {
            'morning' => $clock < 11 * 60,
            'evening' => $clock >= 16 * 60,
            default   => true,
        };
    }

    /**
     * Picks the next attraction that suits the current time, pulling a
     * better-fitting one forward out of the ranked list when the head of the
     * queue does not fit. Falls back to the head so nothing is ever skipped.
     */
    private static function pick(array &$ranked, int $cursor, int $clock): ?array
    {
        if (!isset($ranked[$cursor])) {
            return null;
        }

        if (self::fitsClock($ranked[$cursor], $clock)) {
            return $ranked[$cursor];
        }

        $limit = min(count($ranked), $cursor + 8);
        for ($i = $cursor + 1; $i < $limit; $i++) {
            if (self::fitsClock($ranked[$i], $clock)) {
                // Move it to the head of the remaining queue, keeping the rest
                // of the ranking intact so the plan stays deterministic.
                $better = $ranked[$i];
                array_splice($ranked, $i, 1);
                array_splice($ranked, $cursor, 0, [$better]);
                return $better;
            }
        }

        return $ranked[$cursor];
    }

    private static function clock(int $minutes): string
    {
        $hours = intdiv($minutes, 60) % 24;
        return sprintf('%02d:%02d', $hours, $minutes % 60);
    }

    private static function addDays(string $date, int $days): string
    {
        $timestamp = strtotime($date . ' +' . $days . ' days');
        return $timestamp ? date('Y-m-d', $timestamp) : $date;
    }

    private static function summarise(array $items, string $pace): string
    {
        $activities = [];
        foreach ($items as $item) {
            if ($item['item_type'] === 'activity') {
                $activities[] = $item['title'];
            }
        }

        if ($activities === []) {
            return 'A free day — keep it open.';
        }

        $word = match ($pace) {
            'relaxed' => 'A slow day',
            'packed'  => 'A full day',
            default   => 'A steady day',
        };

        $shown = array_slice($activities, 0, 3);
        return $word . ': ' . implode(', ', $shown) . (count($activities) > 3 ? ' and more' : '') . '.';
    }

    /** Persists a generated plan, replacing any previous generated itinerary. */
    public static function save(string $tripId, string $coupleId, array $trip, array $destination, array $plan, string $pace, array $interests): string
    {
        Db::delete('itineraries', 'trip_id = ? AND generated_by = "generator"', [$tripId]);

        $itineraryId = Str::uuid();
        Db::insert('itineraries', [
            'id'               => $itineraryId,
            'trip_id'          => $tripId,
            'couple_id'        => $coupleId,
            'title'            => $destination['name'] . ' — ' . count($plan) . ' days',
            'pace'             => $pace,
            'interests'        => json_encode(array_values($interests)),
            'generated_by'     => 'generator',
            'total_cost_cents' => self::estimateCost($plan),
            'currency'         => $trip['currency'] ?? 'USD',
            'is_primary'       => 1,
        ]);

        foreach ($plan as $day) {
            $dayId = Str::uuid();
            Db::insert('itinerary_days', [
                'id'           => $dayId,
                'itinerary_id' => $itineraryId,
                'day_number'   => $day['day_number'],
                'day_date'     => $day['day_date'],
                'title'        => $day['title'],
                'summary'      => $day['summary'],
            ]);

            foreach ($day['items'] as $index => $item) {
                Db::insert('itinerary_items', [
                    'day_id'           => $dayId,
                    'attraction_id'    => $item['attraction_id'],
                    'start_time'       => $item['start_time'],
                    'end_time'         => $item['end_time'],
                    'title'            => $item['title'],
                    'item_type'        => $item['item_type'],
                    'location'         => $item['location'],
                    'description'      => $item['description'],
                    'duration_minutes' => $item['duration_minutes'],
                    'cost_cents'       => $item['cost_cents'],
                    'currency'         => $trip['currency'] ?? 'USD',
                    'sort_order'       => $index,
                ]);
            }
        }

        return $itineraryId;
    }
}
