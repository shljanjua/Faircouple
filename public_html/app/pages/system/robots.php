<?php
declare(strict_types=1);

$base = Config::siteUrl();
$blocked = Settings::bool('maintenance_mode', false) || Settings::bool('seo_block_indexing', false);

$lines = ['User-agent: *'];

if ($blocked) {
    $lines[] = 'Disallow: /';
} else {
    $lines[] = 'Allow: /';
    $lines[] = 'Disallow: /dashboard';
    $lines[] = 'Disallow: /admin';
    $lines[] = 'Disallow: /checkout';
    $lines[] = 'Disallow: /onboarding';
    $lines[] = 'Disallow: /invite/';
    $lines[] = 'Disallow: /join/';
    $lines[] = 'Disallow: /reset-password';
    $lines[] = 'Disallow: /verify-email';
    $lines[] = 'Disallow: /file.php';
    $lines[] = 'Disallow: /cron.php';
    $lines[] = 'Disallow: /*?currency=';
    $lines[] = 'Disallow: /*?page=';
}

$lines[] = '';
$lines[] = '# Slow the aggressive crawlers down a little.';
$lines[] = 'User-agent: AhrefsBot';
$lines[] = 'Crawl-delay: 10';
$lines[] = '';
$lines[] = 'User-agent: SemrushBot';
$lines[] = 'Crawl-delay: 10';
$lines[] = '';
$lines[] = 'Sitemap: ' . $base . '/sitemap.xml';

Response::text(implode("\n", $lines) . "\n");
