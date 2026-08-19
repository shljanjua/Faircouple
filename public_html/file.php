<?php
declare(strict_types=1);

/**
 * Serves an uploaded file.
 *
 * Photos, chat images and booking documents live outside the web root. This is
 * the only way to read one, and it re-checks the session and couple membership
 * on every single request.
 */

require __DIR__ . '/app/bootstrap.php';

$bucket = (string) ($_GET['b'] ?? '');
$path   = (string) ($_GET['p'] ?? '');

if (!Storage::isBucket($bucket)) {
    http_response_code(404);
    exit('Not found.');
}

$absolute = Storage::resolve($bucket, $path);
if ($absolute === null || !is_file($absolute)) {
    http_response_code(404);
    exit('Not found.');
}

// Branding, blog covers and avatars are public. Everything else is not.
if (!in_array($bucket, Storage::PUBLIC_BUCKETS, true)) {
    $user = Auth::user();

    if ($user === null) {
        http_response_code(404);
        exit('Not found.');
    }

    if (!Auth::isAdmin()) {
        $coupleId = Storage::coupleFromPath($path);
        $allowed = $coupleId !== null && Db::one(
            'SELECT id FROM couple_members WHERE couple_id = ? AND user_id = ? AND removed_at IS NULL LIMIT 1',
            [$coupleId, $user['id']]
        ) !== null;

        if (!$allowed) {
            http_response_code(404);
            exit('Not found.');
        }
    }
}

$download = isset($_GET['download']) ? basename($path) : '';

Response::file(
    $absolute,
    Storage::mimeForPath($path),
    $download,
    in_array($bucket, Storage::PUBLIC_BUCKETS, true)
);
