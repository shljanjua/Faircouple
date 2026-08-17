<?php
declare(strict_types=1);

/** A tiny status endpoint for uptime monitors. Reveals nothing sensitive. */

$tablesReady = Db::one('SHOW TABLES LIKE "profiles"') !== null;

Response::json([
    'ok'       => $tablesReady,
    'app'      => 'faircouples',
    'php'      => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
    'database' => $tablesReady ? 'ready' : 'not imported',
    'time'     => Str::now(),
], $tablesReady ? 200 : 503);
