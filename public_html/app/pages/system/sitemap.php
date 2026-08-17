<?php
declare(strict_types=1);

/**
 * The sitemap. /sitemap.xml is an index that points at three child sitemaps,
 * so it keeps working as the blog and travel catalogue grow.
 */

$path = Request::path();
$base = Config::siteUrl();

$url = static function (string $loc, ?string $lastmod, string $changefreq, string $priority): string {
    $xml = '  <url>' . "\n";
    $xml .= '    <loc>' . htmlspecialchars($loc, ENT_XML1) . '</loc>' . "\n";
    if ($lastmod) {
        $timestamp = strtotime($lastmod);
        if ($timestamp) {
            $xml .= '    <lastmod>' . date('Y-m-d', $timestamp) . '</lastmod>' . "\n";
        }
    }
    $xml .= '    <changefreq>' . $changefreq . '</changefreq>' . "\n";
    $xml .= '    <priority>' . $priority . '</priority>' . "\n";
    return $xml . '  </url>' . "\n";
};

/* ------------------------------------------------------------------- Index */

if ($path === '/sitemap.xml') {
    $today = date('Y-m-d');
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

    foreach (['sitemap-pages.xml', 'sitemap-blog.xml', 'sitemap-travel.xml'] as $child) {
        $xml .= '  <sitemap><loc>' . htmlspecialchars($base . '/' . $child, ENT_XML1) . '</loc>'
             . '<lastmod>' . $today . '</lastmod></sitemap>' . "\n";
    }

    Response::xml($xml . '</sitemapindex>');
}

/* ------------------------------------------------------------------ Children */

$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

if ($path === '/sitemap-pages.xml') {
    $static = [
        ['/', 'daily', '1.0'],
        ['/features', 'weekly', '0.9'],
        ['/fairness', 'monthly', '0.8'],
        ['/pricing', 'weekly', '0.9'],
        ['/checklists', 'monthly', '0.7'],
        ['/love-or-attraction', 'monthly', '0.8'],
        ['/faq', 'monthly', '0.7'],
        ['/contact', 'monthly', '0.5'],
        ['/blog', 'daily', '0.7'],
        ['/destinations', 'weekly', '0.9'],
        ['/countries', 'weekly', '0.7'],
        ['/signup', 'monthly', '0.6'],
    ];

    foreach ($static as [$loc, $frequency, $priority]) {
        $xml .= $url($base . ($loc === '/' ? '' : $loc), null, $frequency, $priority);
    }

    foreach (Db::all('SELECT slug, updated_at FROM pages WHERE status = "published" AND no_index = 0') as $page) {
        $xml .= $url($base . '/' . $page['slug'], $page['updated_at'], 'monthly', '0.5');
    }
}

if ($path === '/sitemap-blog.xml') {
    $posts = Db::all(
        'SELECT slug, updated_at, published_at FROM blog_posts
          WHERE status = "published" AND no_index = 0 AND published_at <= UTC_TIMESTAMP()
          ORDER BY published_at DESC LIMIT 5000'
    );

    foreach ($posts as $post) {
        $xml .= $url($base . '/blog/' . $post['slug'], $post['updated_at'] ?: $post['published_at'], 'monthly', '0.7');
    }
}

if ($path === '/sitemap-travel.xml') {
    $destinations = Db::all('SELECT slug, updated_at FROM destinations WHERE is_active = 1 ORDER BY popularity DESC LIMIT 5000');
    foreach ($destinations as $destination) {
        $xml .= $url($base . '/destinations/' . $destination['slug'], $destination['updated_at'], 'weekly', '0.8');
    }

    foreach (Db::all('SELECT slug FROM countries WHERE is_active = 1') as $country) {
        $xml .= $url($base . '/countries/' . $country['slug'], null, 'weekly', '0.6');
    }
}

Response::xml($xml . '</urlset>');
