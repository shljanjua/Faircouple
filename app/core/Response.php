<?php
declare(strict_types=1);

/** Sends redirects, JSON, files and error pages. */
final class Response
{
    public static function redirect(string $path, int $status = 302): never
    {
        $url = str_starts_with($path, 'http') ? $path : Config::siteUrl($path);
        header('Location: ' . $url, true, $status);
        exit;
    }

    /** Redirects back to where the form was submitted from. */
    public static function back(string $fallback = '/'): never
    {
        $referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
        $host = (string) parse_url(Config::siteUrl(), PHP_URL_HOST);

        if ($referer !== '' && parse_url($referer, PHP_URL_HOST) === $host) {
            self::redirect($referer);
        }
        self::redirect($fallback);
    }

    public static function json(array $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function text(string $body, string $contentType = 'text/plain; charset=utf-8'): never
    {
        header('Content-Type: ' . $contentType);
        echo $body;
        exit;
    }

    public static function xml(string $body): never
    {
        self::text($body, 'application/xml; charset=utf-8');
    }

    /** Renders the 404 page and stops. */
    public static function notFound(string $message = 'That page does not exist.'): never
    {
        http_response_code(404);
        View::render('errors/404', ['message' => $message], 'layouts/public', [
            'title'    => 'Page not found',
            'no_index' => true,
        ]);
        exit;
    }

    public static function forbidden(string $message = 'You do not have access to that.'): never
    {
        http_response_code(403);
        View::render('errors/404', ['message' => $message], 'layouts/public', [
            'title'    => 'Not allowed',
            'no_index' => true,
        ]);
        exit;
    }

    /** Streams a stored file after the caller has already been authorised. */
    public static function file(string $absolutePath, string $contentType, string $downloadName = '', bool $public = false): never
    {
        $size = filesize($absolutePath);

        header('Content-Type: ' . $contentType);
        header('Content-Length: ' . ($size === false ? 0 : $size));
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: ' . ($public ? 'public, max-age=2592000' : 'private, no-store'));

        $disposition = $downloadName !== '' ? 'attachment; filename="' . rawurlencode($downloadName) . '"' : 'inline';
        header('Content-Disposition: ' . $disposition);

        readfile($absolutePath);
        exit;
    }

    /** Sends a generated file (CSV, JSON export) as a download. */
    public static function download(string $body, string $filename, string $contentType): never
    {
        header('Content-Type: ' . $contentType);
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($body));
        header('Cache-Control: no-store');
        echo $body;
        exit;
    }
}
