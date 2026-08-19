<?php
declare(strict_types=1);

/**
 * On-page SEO: titles, meta, canonicals, Open Graph, Twitter cards and the
 * JSON-LD blocks. Per-route overrides come from the `seo_meta` table, which the
 * admin panel edits.
 */
final class Seo
{
    private static array $meta = [];
    private static array $schemas = [];

    /**
     * @param array{
     *   title?:string, description?:string, keywords?:array|string, image?:string,
     *   canonical?:string, no_index?:bool, type?:string, published?:string, modified?:string
     * } $meta
     */
    public static function set(array $meta): void
    {
        self::$meta = $meta + self::$meta;
    }

    public static function schema(array $schema): void
    {
        self::$schemas[] = $schema;
    }

    /** Merges the database override for the current path over the page values. */
    private static function resolved(): array
    {
        $path = Request::path();
        $override = Db::one('SELECT * FROM seo_meta WHERE path = ? LIMIT 1', [$path]);

        $siteName = Settings::text('site_name', 'FairCouples');
        $title = self::$meta['title'] ?? null;
        $description = self::$meta['description'] ?? null;
        $keywords = self::$meta['keywords'] ?? [];
        $image = self::$meta['image'] ?? null;
        $canonical = self::$meta['canonical'] ?? null;
        $robots = !empty(self::$meta['no_index']) ? 'noindex,nofollow' : null;

        if ($override) {
            $title = $override['title'] ?: $title;
            $description = $override['description'] ?: $description;
            $keywords = Str::json($override['keywords'], is_array($keywords) ? $keywords : []);
            $image = $override['og_image'] ?: $image;
            $canonical = $override['canonical_url'] ?: $canonical;
            $robots = $robots ?? ($override['robots'] ?: null);
        }

        if (is_string($keywords)) {
            $keywords = array_filter(array_map('trim', explode(',', $keywords)));
        }
        if ($keywords === []) {
            $keywords = Settings::list('seo_keywords', []);
        }

        $fullTitle = $title
            ? ($title === $siteName ? $title : $title . ' | ' . $siteName)
            : $siteName . ' — ' . Settings::text('site_tagline', 'Fair love, measured.');

        return [
            'title'       => $fullTitle,
            'short_title' => $title ?: $siteName,
            'description' => $description ?: Settings::text('site_description'),
            'keywords'    => array_slice(array_values($keywords), 0, 20),
            'image'       => $image ?: Settings::text('seo_default_og_image', Config::siteUrl('/assets/img/og-default.png')),
            'canonical'   => $canonical ?: Config::siteUrl($path === '/' ? '' : $path),
            'robots'      => $robots ?: 'index,follow,max-image-preview:large,max-snippet:-1',
            'type'        => self::$meta['type'] ?? 'website',
            'published'   => self::$meta['published'] ?? null,
            'modified'    => self::$meta['modified'] ?? null,
        ];
    }

    public static function title(): string
    {
        return self::resolved()['title'];
    }

    /** Prints every tag that belongs in <head>. */
    public static function renderHead(): string
    {
        $meta = self::resolved();
        $siteName = Settings::text('site_name', 'FairCouples');
        $twitter = Settings::text('seo_twitter_handle');

        $out = [];
        $out[] = '<title>' . Str::e($meta['title']) . '</title>';
        $out[] = '<meta name="description" content="' . Str::e($meta['description']) . '">';

        if ($meta['keywords'] !== []) {
            $out[] = '<meta name="keywords" content="' . Str::e(implode(', ', $meta['keywords'])) . '">';
        }

        $out[] = '<meta name="robots" content="' . Str::e($meta['robots']) . '">';
        $out[] = '<link rel="canonical" href="' . Str::e($meta['canonical']) . '">';

        $out[] = '<meta property="og:type" content="' . Str::e($meta['type']) . '">';
        $out[] = '<meta property="og:site_name" content="' . Str::e($siteName) . '">';
        $out[] = '<meta property="og:title" content="' . Str::e($meta['short_title']) . '">';
        $out[] = '<meta property="og:description" content="' . Str::e($meta['description']) . '">';
        $out[] = '<meta property="og:url" content="' . Str::e($meta['canonical']) . '">';
        $out[] = '<meta property="og:locale" content="en_GB">';

        if ($meta['image']) {
            $out[] = '<meta property="og:image" content="' . Str::e($meta['image']) . '">';
            $out[] = '<meta property="og:image:width" content="1200">';
            $out[] = '<meta property="og:image:height" content="630">';
        }

        if ($meta['published']) {
            $out[] = '<meta property="article:published_time" content="' . Str::e(date('c', strtotime($meta['published']))) . '">';
        }
        if ($meta['modified']) {
            $out[] = '<meta property="article:modified_time" content="' . Str::e(date('c', strtotime($meta['modified']))) . '">';
        }

        $out[] = '<meta name="twitter:card" content="summary_large_image">';
        $out[] = '<meta name="twitter:title" content="' . Str::e($meta['short_title']) . '">';
        $out[] = '<meta name="twitter:description" content="' . Str::e($meta['description']) . '">';
        if ($meta['image']) {
            $out[] = '<meta name="twitter:image" content="' . Str::e($meta['image']) . '">';
        }
        if ($twitter !== '') {
            $out[] = '<meta name="twitter:site" content="' . Str::e($twitter) . '">';
        }

        $verification = Settings::text('seo_google_verification');
        if ($verification !== '') {
            $out[] = '<meta name="google-site-verification" content="' . Str::e($verification) . '">';
        }
        $bing = Settings::text('seo_bing_verification');
        if ($bing !== '') {
            $out[] = '<meta name="msvalidate.01" content="' . Str::e($bing) . '">';
        }
        $pinterest = Settings::text('seo_pinterest_verification');
        if ($pinterest !== '') {
            $out[] = '<meta name="p:domain_verify" content="' . Str::e($pinterest) . '">';
        }
        $yandex = Settings::text('seo_yandex_verification');
        if ($yandex !== '') {
            $out[] = '<meta name="yandex-verification" content="' . Str::e($yandex) . '">';
        }

        return implode("\n  ", $out);
    }

    /** Prints the JSON-LD blocks queued for this page. */
    public static function renderSchemas(): string
    {
        $blocks = array_merge([self::organisation(), self::website()], self::$schemas);
        $out = '';

        foreach ($blocks as $block) {
            $json = json_encode(
                $block,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP
            );
            if ($json !== false) {
                $out .= '<script type="application/ld+json">' . $json . '</script>' . "\n";
            }
        }

        return $out;
    }

    /* ---------------------------------------------------------- Schema types */

    public static function organisation(): array
    {
        $sameAs = array_values(array_filter([
            Settings::text('social_twitter'),
            Settings::text('social_instagram'),
            Settings::text('social_facebook'),
            Settings::text('social_pinterest'),
            Settings::text('social_linkedin'),
        ]));

        return [
            '@context'    => 'https://schema.org',
            '@type'       => 'Organization',
            '@id'         => Config::siteUrl('/#organization'),
            'name'        => Settings::text('site_name', 'FairCouples'),
            'url'         => Config::siteUrl(),
            'description' => Settings::text('site_description'),
            'email'       => Settings::text('support_email'),
            'logo'        => [
                '@type' => 'ImageObject',
                'url'   => Config::siteUrl('/assets/img/logo.svg'),
            ],
            'sameAs'      => $sameAs,
        ];
    }

    public static function website(): array
    {
        return [
            '@context'        => 'https://schema.org',
            '@type'           => 'WebSite',
            '@id'             => Config::siteUrl('/#website'),
            'name'            => Settings::text('site_name', 'FairCouples'),
            'url'             => Config::siteUrl(),
            'publisher'       => ['@id' => Config::siteUrl('/#organization')],
            'inLanguage'      => 'en',
            'potentialAction' => [
                '@type'       => 'SearchAction',
                'target'      => ['@type' => 'EntryPoint', 'urlTemplate' => Config::siteUrl('/blog?q={search_term_string}')],
                'query-input' => 'required name=search_term_string',
            ],
        ];
    }

    public static function breadcrumbs(array $trail): void
    {
        $items = [];
        foreach (array_values($trail) as $index => $crumb) {
            $items[] = [
                '@type'    => 'ListItem',
                'position' => $index + 1,
                'name'     => $crumb['name'],
                'item'     => Config::siteUrl($crumb['url']),
            ];
        }

        self::schema([
            '@context'        => 'https://schema.org',
            '@type'           => 'BreadcrumbList',
            'itemListElement' => $items,
        ]);
    }

    public static function faq(array $faqs): void
    {
        if ($faqs === []) {
            return;
        }

        $items = [];
        foreach ($faqs as $faq) {
            $items[] = [
                '@type'          => 'Question',
                'name'           => $faq['question'],
                'acceptedAnswer' => ['@type' => 'Answer', 'text' => $faq['answer']],
            ];
        }

        self::schema(['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => $items]);
    }

    public static function article(array $post): void
    {
        self::schema([
            '@context'         => 'https://schema.org',
            '@type'            => 'BlogPosting',
            'headline'         => $post['title'],
            'description'      => $post['excerpt'] ?? '',
            'image'            => $post['cover_image'] ?? Settings::text('seo_default_og_image'),
            'datePublished'    => $post['published_at'] ? date('c', strtotime($post['published_at'])) : null,
            'dateModified'     => $post['updated_at'] ? date('c', strtotime($post['updated_at'])) : null,
            'author'           => ['@type' => 'Person', 'name' => $post['author_name'] ?: 'FairCouples Team'],
            'publisher'        => ['@id' => Config::siteUrl('/#organization')],
            'mainEntityOfPage' => Config::siteUrl('/blog/' . $post['slug']),
            'wordCount'        => str_word_count(strip_tags((string) ($post['content'] ?? ''))),
        ]);
    }

    public static function product(array $plan, array $prices): void
    {
        $offers = [];
        foreach ($prices as $price) {
            $offers[] = [
                '@type'         => 'Offer',
                'price'         => number_format(((int) $price['amount_cents']) / 100, 2, '.', ''),
                'priceCurrency' => $price['currency'],
                'availability'  => 'https://schema.org/InStock',
                'url'           => Config::siteUrl('/pricing'),
            ];
        }

        self::schema([
            '@context'    => 'https://schema.org',
            '@type'       => 'Product',
            'name'        => Settings::text('site_name', 'FairCouples') . ' ' . $plan['name'],
            'description' => $plan['tagline'] ?? $plan['description'] ?? '',
            'brand'       => ['@type' => 'Brand', 'name' => Settings::text('site_name', 'FairCouples')],
            'offers'      => $offers,
        ]);
    }

    public static function softwareApplication(): void
    {
        self::schema([
            '@context'           => 'https://schema.org',
            '@type'              => 'SoftwareApplication',
            'name'               => Settings::text('site_name', 'FairCouples'),
            'applicationCategory' => 'LifestyleApplication',
            'operatingSystem'    => 'Web',
            'description'        => Settings::text('site_description'),
            'offers'             => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD'],
        ]);
    }

    /**
     * Testimonials as Review + AggregateRating on the product itself, which is
     * what earns a star rating in results. Google ignores review markup with no
     * rating, so anything unrated is skipped rather than emitted half-formed.
     *
     * @param array<int,array> $testimonials Rows from `testimonials`
     */
    public static function reviews(array $testimonials): void
    {
        $reviews = [];
        $total = 0;

        foreach ($testimonials as $testimonial) {
            $rating = (int) ($testimonial['rating'] ?? 0);
            $quote = trim((string) ($testimonial['quote'] ?? ''));

            if ($rating < 1 || $rating > 5 || $quote === '') {
                continue;
            }

            $reviews[] = [
                '@type'         => 'Review',
                'reviewRating'  => [
                    '@type'       => 'Rating',
                    'ratingValue' => (string) $rating,
                    'bestRating'  => '5',
                    'worstRating' => '1',
                ],
                'author'        => [
                    '@type' => 'Person',
                    'name'  => (string) ($testimonial['author_name'] ?? 'A member'),
                ],
                'reviewBody'    => $quote,
                'datePublished' => substr((string) ($testimonial['created_at'] ?? ''), 0, 10) ?: null,
            ];

            $total += $rating;
        }

        if ($reviews === []) {
            return;
        }

        $count = count($reviews);

        self::schema([
            '@context'        => 'https://schema.org',
            '@type'           => 'Product',
            'name'            => Settings::text('site_name', 'FairCouples'),
            'description'     => Settings::text('site_description'),
            'brand'           => ['@type' => 'Brand', 'name' => Settings::text('site_name', 'FairCouples')],
            'aggregateRating' => [
                '@type'       => 'AggregateRating',
                'ratingValue' => number_format($total / $count, 1, '.', ''),
                'reviewCount' => (string) $count,
                'bestRating'  => '5',
                'worstRating' => '1',
            ],
            'review'          => $reviews,
        ]);
    }

    public static function touristDestination(array $destination, ?array $country): void
    {
        self::schema([
            '@context'    => 'https://schema.org',
            '@type'       => 'TouristDestination',
            'name'        => $destination['name'],
            'description' => $destination['summary'] ?? '',
            'image'       => $destination['hero_image'] ?? null,
            'url'         => Config::siteUrl('/destinations/' . $destination['slug']),
            'address'     => [
                '@type'          => 'PostalAddress',
                'addressLocality' => $destination['city'] ?? $destination['name'],
                'addressCountry' => $country['code'] ?? $destination['country_code'],
            ],
            'geo' => $destination['latitude'] ? [
                '@type'     => 'GeoCoordinates',
                'latitude'  => (float) $destination['latitude'],
                'longitude' => (float) $destination['longitude'],
            ] : null,
        ]);
    }

    public static function howTo(string $name, string $description, array $steps): void
    {
        $items = [];
        foreach (array_values($steps) as $index => $step) {
            $items[] = [
                '@type'    => 'HowToStep',
                'position' => $index + 1,
                'name'     => $step['name'],
                'text'     => $step['text'],
            ];
        }

        self::schema([
            '@context'    => 'https://schema.org',
            '@type'       => 'HowTo',
            'name'        => $name,
            'description' => $description,
            'step'        => $items,
        ]);
    }
}
