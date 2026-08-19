<?php
declare(strict_types=1);

/** Plan limits, the human labels for them, and the upgrade prompts. */
final class Plans
{
    /** Every limit the app understands, with the free-plan value. */
    public const FREE_LIMITS = [
        'couples'             => 1,
        'emotion_logs'        => 90,
        'messages'            => 200,
        'checklists'          => 1,
        'budgets'             => 1,
        'trips'               => 1,
        'itineraries'         => 1,
        'gifts'               => 5,
        'documents'           => 5,
        'storage_mb'          => 100,
        'history_months'      => 1,
        'exports'             => 0,
        'itinerary_generator' => false,
        'advanced_reports'    => false,
        'priority_support'    => false,
        'remove_ads'          => false,
        'custom_categories'   => false,
    ];

    public const LABELS = [
        'couples'             => 'relationship spaces',
        'emotion_logs'        => 'emotion entries this month',
        'messages'            => 'messages this month',
        'checklists'          => 'checklists',
        'budgets'             => 'budgets',
        'trips'               => 'trips',
        'itineraries'         => 'itineraries',
        'gifts'               => 'gift ideas',
        'documents'           => 'vault documents',
        'storage_mb'          => 'MB of storage',
        'history_months'      => 'months of history',
        'exports'             => 'exports',
        'itinerary_generator' => 'the itinerary generator',
        'advanced_reports'    => 'advanced fairness reports',
        'priority_support'    => 'priority support',
        'remove_ads'          => 'the ad-free experience',
        'custom_categories'   => 'custom fairness categories',
    ];

    /** Fills any gaps in a plan's stored limits with the free-plan value. */
    public static function mergeLimits(array $limits): array
    {
        $merged = self::FREE_LIMITS;
        foreach ($limits as $key => $value) {
            if (array_key_exists($key, self::FREE_LIMITS)) {
                $merged[$key] = $value;
            }
        }
        return $merged;
    }

    public static function freeEntitlements(): array
    {
        $plan = Db::one('SELECT id, slug, name, tier, limits FROM plans WHERE is_free = 1 AND is_active = 1 LIMIT 1');

        return [
            'plan' => [
                'slug' => $plan['slug'] ?? 'free',
                'name' => $plan['name'] ?? 'Starter',
                'tier' => (int) ($plan['tier'] ?? 0),
            ],
            'limits'       => $plan ? self::mergeLimits(Str::json($plan['limits'])) : self::FREE_LIMITS,
            'subscription' => null,
            'is_paid'      => false,
        ];
    }

    /** -1 means unlimited. Booleans are simple on/off features. */
    public static function reached(array $limits, string $key, int $current): bool
    {
        $limit = $limits[$key] ?? 0;
        if (is_bool($limit)) {
            return !$limit;
        }
        if ((int) $limit === -1) {
            return false;
        }
        return $current >= (int) $limit;
    }

    public static function allows(array $limits, string $key): bool
    {
        $limit = $limits[$key] ?? false;
        return is_bool($limit) ? $limit : ((int) $limit !== 0);
    }

    public static function upgradeMessage(string $key): string
    {
        $label = self::LABELS[$key] ?? $key;
        return "You have reached your plan's limit for {$label}. Upgrade to keep going.";
    }

    /** Renders a limit for display: `Unlimited`, `Included`, or the number. */
    public static function describe($limit): string
    {
        if (is_bool($limit)) {
            return $limit ? 'Included' : 'Not included';
        }
        return (int) $limit === -1 ? 'Unlimited' : number_format((int) $limit);
    }

    /**
     * Checks a limit against a live count and returns an error string, or null.
     * Pass the extra WHERE fragment to scope the count (e.g. to this month).
     */
    public static function check(string $key, string $table, string $extraWhere = '', array $extraParams = []): ?string
    {
        $entitlements = Auth::entitlements();
        $limit = $entitlements['limits'][$key] ?? 0;

        if (is_bool($limit)) {
            return $limit ? null : self::upgradeMessage($key);
        }
        if ((int) $limit === -1) {
            return null;
        }

        $coupleId = Auth::coupleId();
        if (!$coupleId) {
            return null;
        }

        $where = 'couple_id = ?' . ($extraWhere !== '' ? ' AND ' . $extraWhere : '');
        $count = Db::count($table, $where, array_merge([$coupleId], $extraParams));

        return $count >= (int) $limit ? self::upgradeMessage($key) : null;
    }

    /** Bytes already used across photos and the document vault. */
    public static function storageUsed(string $coupleId): int
    {
        $media = (int) Db::value('SELECT COALESCE(SUM(size_bytes),0) FROM media_assets WHERE couple_id = ?', [$coupleId], 0);
        $docs  = (int) Db::value('SELECT COALESCE(SUM(file_size),0) FROM travel_documents WHERE couple_id = ?', [$coupleId], 0);
        return $media + $docs;
    }

    /** Returns an error string when an upload would exceed the plan quota. */
    public static function storageProblem(string $coupleId, int $incomingBytes): ?string
    {
        $quotaMb = Auth::entitlements()['limits']['storage_mb'] ?? 100;
        if ((int) $quotaMb === -1) {
            return null;
        }

        $used = self::storageUsed($coupleId);
        if ($used + $incomingBytes <= ((int) $quotaMb) * 1024 * 1024) {
            return null;
        }

        $usedMb = (int) round($used / 1048576);
        return "Storage full — {$usedMb} MB of {$quotaMb} MB used. Upgrade your plan or delete some files.";
    }

    /** Active plans with their prices, for the pricing page and admin. */
    public static function active(): array
    {
        $plans = Db::all('SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order ASC, tier ASC');
        if ($plans === []) {
            return [];
        }

        $ids = array_column($plans, 'id');
        $prices = Db::all(
            'SELECT * FROM plan_prices WHERE is_active = 1 AND plan_id IN (' . Db::placeholders($ids) . ')',
            $ids
        );

        foreach ($plans as &$plan) {
            $plan['features'] = Str::json($plan['features']);
            $plan['limits']   = self::mergeLimits(Str::json($plan['limits']));
            $plan['prices']   = array_values(array_filter(
                $prices,
                static fn ($price) => $price['plan_id'] === $plan['id']
            ));
        }

        return $plans;
    }

    /** Finds the price row for a plan in a given currency and interval. */
    public static function price(array $plan, string $currency, string $interval): ?array
    {
        foreach ($plan['prices'] ?? [] as $price) {
            if ($price['currency'] === $currency && $price['billing_interval'] === $interval) {
                return $price;
            }
        }
        return null;
    }
}
