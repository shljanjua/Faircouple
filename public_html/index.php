<?php
declare(strict_types=1);

/**
 * FairCouples — front controller.
 *
 * Every request that is not a real file on disk arrives here (see .htaccess).
 */

require __DIR__ . '/app/bootstrap.php';

// Before anything else: if config.php has not been filled in, or the database
// is unreachable, show the setup page instead of a broken site.
if (Config::needsSetup() || !Db::isReachable()) {
    require APP_PATH . '/pages/system/setup.php';
    exit;
}

// Stored redirects (Admin -> SEO) are applied inside Router::dispatch(), which
// runs them before the route table so a redirect can move a URL the CMS
// catch-all would otherwise answer.

// Maintenance mode hides the public site from everybody except admins.
if (Settings::inMaintenance() && !str_starts_with(Request::path(), '/signin') && !str_starts_with(Request::path(), '/admin')) {
    http_response_code(503);
    header('Retry-After: 3600');
    View::render('errors/maintenance', [], 'layouts/bare', ['title' => 'Back shortly', 'no_index' => true]);
    exit;
}

/** @var Router $router */
$router = require APP_PATH . '/routes.php';
$router->dispatch();
