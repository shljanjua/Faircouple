<?php
declare(strict_types=1);

/**
 * Local file storage.
 *
 * Files are written under `<bucket>/<couple_id>/<user_id>/<random>.<ext>` in a
 * directory that Apache refuses to serve. They come back only through
 * /file.php, which re-checks the session and couple membership every time.
 */
final class Storage
{
    public const BUCKETS = ['couple-media', 'documents', 'avatars', 'blog', 'site'];

    /** Buckets anybody may read (branding, blog covers, profile photos). */
    public const PUBLIC_BUCKETS = ['avatars', 'blog', 'site'];

    /** Buckets only an administrator may write to. */
    public const ADMIN_BUCKETS = ['blog', 'site'];

    private const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic'];

    private const DOCUMENT_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
    ];

    public static function rules(string $bucket): array
    {
        return match ($bucket) {
            'couple-media' => ['max' => 25 * 1048576, 'types' => [...self::IMAGE_TYPES, 'video/mp4', 'video/quicktime']],
            'documents'    => ['max' => 25 * 1048576, 'types' => [...self::DOCUMENT_TYPES, ...self::IMAGE_TYPES]],
            'avatars'      => ['max' => 5 * 1048576,  'types' => self::IMAGE_TYPES],
            default        => ['max' => 8 * 1048576,  'types' => [...self::IMAGE_TYPES, 'image/svg+xml', 'image/x-icon']],
        };
    }

    public static function isBucket(string $bucket): bool
    {
        return in_array($bucket, self::BUCKETS, true);
    }

    public static function root(): string
    {
        return rtrim(Config::uploadDir(), '/');
    }

    /**
     * Resolves a bucket-relative path to an absolute one, refusing traversal,
     * absolute paths and anything that escapes the upload root.
     */
    public static function resolve(string $bucket, string $relative): ?string
    {
        if (!self::isBucket($bucket)) {
            return null;
        }

        $relative = str_replace('\\', '/', $relative);
        $relative = ltrim($relative, '/');

        if ($relative === '' || str_contains($relative, '..') || str_contains($relative, "\0")) {
            return null;
        }

        foreach (explode('/', $relative) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return null;
            }
            if (!preg_match('/^[A-Za-z0-9._-]+$/', $segment)) {
                return null;
            }
        }

        return self::root() . '/' . $bucket . '/' . $relative;
    }

    /** `<couple_id>/<user_id>/<prefix>-<random>.<ext>` */
    public static function buildPath(?string $coupleId, string $userId, string $fileName, string $prefix = 'file'): string
    {
        $extension = strtolower((string) pathinfo($fileName, PATHINFO_EXTENSION));
        $extension = preg_replace('/[^a-z0-9]/', '', $extension) ?: 'bin';
        $extension = substr($extension, 0, 8);

        $unique = date('Ymd') . '-' . bin2hex(random_bytes(6));
        $prefix = preg_replace('/[^a-z0-9-]/', '', strtolower($prefix)) ?: 'file';

        $segments = array_filter([$coupleId, $userId, "{$prefix}-{$unique}.{$extension}"]);
        return implode('/', $segments);
    }

    /**
     * Validates and stores one uploaded file.
     *
     * @param array $file An entry from $_FILES
     * @return array{ok:bool,error?:string,path?:string,name?:string,mime?:string,size?:int}
     */
    public static function store(array $file, string $bucket, ?string $coupleId, string $userId, string $prefix = 'file'): array
    {
        if (!self::isBucket($bucket)) {
            return ['ok' => false, 'error' => 'Unknown upload area.'];
        }

        $errorCode = $file['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($errorCode !== UPLOAD_ERR_OK) {
            return ['ok' => false, 'error' => self::uploadError($errorCode)];
        }

        $tmp = (string) ($file['tmp_name'] ?? '');
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            return ['ok' => false, 'error' => 'That upload did not arrive correctly. Try again.'];
        }

        $size = (int) ($file['size'] ?? 0);
        $rules = self::rules($bucket);

        if ($size <= 0) {
            return ['ok' => false, 'error' => 'That file is empty.'];
        }
        if ($size > $rules['max']) {
            $mb = (int) round($rules['max'] / 1048576);
            return ['ok' => false, 'error' => "Files here must be under {$mb} MB."];
        }

        // Trust the sniffed type, never the browser-supplied one.
        $mime = self::detectMime($tmp);
        if (!in_array($mime, $rules['types'], true)) {
            return ['ok' => false, 'error' => 'That file type is not allowed here.'];
        }

        $originalName = (string) ($file['name'] ?? 'upload');
        $relative = self::buildPath($coupleId, $userId, $originalName, $prefix);
        $absolute = self::resolve($bucket, $relative);

        if ($absolute === null) {
            return ['ok' => false, 'error' => 'Could not build a safe file path.'];
        }

        $directory = dirname($absolute);
        if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
            return ['ok' => false, 'error' => 'The upload folder is not writable. Check UPLOAD permissions in File Manager.'];
        }

        if (!@move_uploaded_file($tmp, $absolute)) {
            return ['ok' => false, 'error' => 'Could not save the file to disk.'];
        }

        @chmod($absolute, 0644);

        return [
            'ok'   => true,
            'path' => $relative,
            'name' => mb_substr($originalName, 0, 200),
            'mime' => $mime,
            'size' => $size,
        ];
    }

    public static function delete(string $bucket, ?string $relative): bool
    {
        if (!$relative) {
            return false;
        }
        $absolute = self::resolve($bucket, $relative);
        if ($absolute === null || !is_file($absolute)) {
            return false;
        }
        return @unlink($absolute);
    }

    public static function exists(string $bucket, string $relative): bool
    {
        $absolute = self::resolve($bucket, $relative);
        return $absolute !== null && is_file($absolute);
    }

    /** The URL a browser uses to read a stored file. */
    public static function url(string $bucket, ?string $relative): string
    {
        if (!$relative) {
            return '';
        }
        return '/file.php?b=' . rawurlencode($bucket) . '&p=' . rawurlencode($relative);
    }

    /** The couple id encoded in a private path, used for the access check. */
    public static function coupleFromPath(string $relative): ?string
    {
        $first = explode('/', $relative)[0] ?? '';
        return preg_match('/^[0-9a-f-]{36}$/i', $first) ? $first : null;
    }

    public static function mimeForPath(string $relative): string
    {
        $extension = strtolower((string) pathinfo($relative, PATHINFO_EXTENSION));

        return match ($extension) {
            'png'  => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif'  => 'image/gif',
            'heic' => 'image/heic',
            'svg'  => 'image/svg+xml',
            'ico'  => 'image/x-icon',
            'mp4'  => 'video/mp4',
            'mov'  => 'video/quicktime',
            'pdf'  => 'application/pdf',
            'doc'  => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt'  => 'text/plain; charset=utf-8',
            default => 'application/octet-stream',
        };
    }

    private static function detectMime(string $path): string
    {
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $mime = finfo_file($finfo, $path);
                finfo_close($finfo);
                if (is_string($mime) && $mime !== '') {
                    return $mime;
                }
            }
        }

        $image = @getimagesize($path);
        if (is_array($image) && !empty($image['mime'])) {
            return (string) $image['mime'];
        }

        return 'application/octet-stream';
    }

    private static function uploadError(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'That file is larger than the server allows.',
            UPLOAD_ERR_PARTIAL   => 'The upload was interrupted. Try again.',
            UPLOAD_ERR_NO_FILE   => 'Choose a file first.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => 'The server could not write the file.',
            UPLOAD_ERR_EXTENSION => 'A server extension blocked that upload.',
            default              => 'That upload failed.',
        };
    }

    /** Creates the bucket folders on first run. */
    public static function ensureFolders(): void
    {
        foreach (self::BUCKETS as $bucket) {
            $path = self::root() . '/' . $bucket;
            if (!is_dir($path)) {
                @mkdir($path, 0755, true);
            }
        }
    }
}
