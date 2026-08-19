<?php
declare(strict_types=1);

/**
 * Loads the application. Included by index.php, file.php, cron.php and the
 * webhook endpoints — everything that needs the database or a session.
 */

define('APP_PATH', __DIR__);
define('PUBLIC_PATH', dirname(__DIR__));

// ---------------------------------------------------------------- Autoloading
spl_autoload_register(static function (string $class): void {
    foreach (['core', 'domain', 'services'] as $folder) {
        $file = APP_PATH . '/' . $folder . '/' . $class . '.php';
        if (is_file($file)) {
            require_once $file;
            return;
        }
    }
});

require_once APP_PATH . '/core/Config.php';

// --------------------------------------------------------------- Configuration
// config.php is NOT in version control, so a deploy never overwrites your
// credentials. On the very first run it is created from config.example.php;
// after that git leaves your edited copy untouched on every future deploy.
$configFile = APP_PATH . '/config.php';
if (!is_file($configFile) && is_file(APP_PATH . '/config.example.php')) {
    @copy(APP_PATH . '/config.example.php', $configFile);
}
Config::load($configFile);

date_default_timezone_set((string) Config::get('timezone', 'UTC'));
mb_internal_encoding('UTF-8');

if (Config::isDev()) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
}

// PHP's own session files should not be world-readable on shared hosting.
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_httponly', '1');

// ------------------------------------------------------------------- Security
header_remove('X-Powered-By');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

// ------------------------------------------------------------------- Runtime
Auth::start();

/**
 * Renders a friendly page instead of a white screen, and never leaks a stack
 * trace to a visitor in production.
 */
set_exception_handler(static function (Throwable $e): void {
    error_log('[faircouples] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());

    if (!headers_sent()) {
        http_response_code(500);
    }

    if (Config::isDev()) {
        echo '<pre style="padding:24px;font:14px/1.6 ui-monospace,monospace">';
        echo Str::e($e->getMessage()) . "\n\n";
        echo Str::e($e->getTraceAsString());
        echo '</pre>';
        return;
    }

    try {
        View::render('errors/500', [], 'layouts/public', ['title' => 'Something went wrong', 'no_index' => true]);
    } catch (Throwable $ignored) {
        echo '<h1>Something went wrong</h1><p>Please try again in a moment.</p>';
    }
});
