<?php
declare(strict_types=1);

/** Small string, date and formatting helpers used across every page. */
final class Str
{
    public static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    public static function token(int $bytes = 32): string
    {
        return bin2hex(random_bytes($bytes));
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /** HTML-escapes a value for output. */
    public static function e($value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public static function slug(string $value): string
    {
        $value = trim($value);
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
            if ($converted !== false) {
                $value = $converted;
            }
        }
        $value = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $value) ?? '');
        return trim($value, '-') ?: 'item';
    }

    public static function excerpt(?string $text, int $length = 160): string
    {
        $clean = trim(preg_replace('/\s+/', ' ', strip_tags((string) $text)) ?? '');
        if ($clean === '' || mb_strlen($clean) <= $length) {
            return $clean;
        }
        return mb_substr($clean, 0, $length - 1) . '…';
    }

    public static function initials(?string $name, string $fallback = '?'): string
    {
        $name = trim((string) $name);
        if ($name === '') {
            return $fallback;
        }
        $parts = preg_split('/\s+/', $name) ?: [];
        $first = mb_substr($parts[0] ?? '', 0, 1);
        $last = count($parts) > 1 ? mb_substr((string) end($parts), 0, 1) : '';
        return mb_strtoupper($first . $last);
    }

    /** JSON columns come back as strings; this always hands back an array. */
    public static function json($value, array $fallback = []): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || $value === '') {
            return $fallback;
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : $fallback;
    }

    public static function bool($value): bool
    {
        return $value === 1 || $value === '1' || $value === true || $value === 'on' || $value === 'true';
    }

    public static function date(?string $value, string $format = 'j M Y'): string
    {
        if (!$value) {
            return '—';
        }
        $timestamp = strtotime($value);
        return $timestamp ? date($format, $timestamp) : '—';
    }

    public static function dateTime(?string $value): string
    {
        return self::date($value, 'j M Y, H:i');
    }

    public static function timeAgo(?string $value): string
    {
        if (!$value) {
            return '—';
        }
        $timestamp = strtotime($value);
        if (!$timestamp) {
            return '—';
        }

        $seconds = time() - $timestamp;
        if ($seconds < 0) {
            return self::date($value);
        }
        if ($seconds < 60) {
            return 'just now';
        }

        $units = [
            ['year', 31536000],
            ['month', 2592000],
            ['week', 604800],
            ['day', 86400],
            ['hour', 3600],
            ['minute', 60],
        ];

        foreach ($units as [$label, $length]) {
            if ($seconds >= $length) {
                $count = (int) floor($seconds / $length);
                return $count . ' ' . $label . ($count === 1 ? '' : 's') . ' ago';
            }
        }

        return 'just now';
    }

    /** Monday of the week a date falls in, as YYYY-MM-DD. */
    public static function weekStart(?string $date = null): string
    {
        $timestamp = $date ? (strtotime($date) ?: time()) : time();
        $weekday = (int) date('N', $timestamp);
        return date('Y-m-d', strtotime('-' . ($weekday - 1) . ' days', $timestamp));
    }

    public static function today(): string
    {
        return date('Y-m-d');
    }

    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }

    public static function inDays(int $days): string
    {
        return gmdate('Y-m-d H:i:s', time() + ($days * 86400));
    }

    public static function inHours(int $hours): string
    {
        return gmdate('Y-m-d H:i:s', time() + ($hours * 3600));
    }

    /**
     * Renders trusted Markdown-ish content (blog posts and CMS pages written in
     * the admin panel) as HTML. Everything is escaped first, so a stored page
     * can never inject a script tag.
     */
    public static function markdown(?string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", (string) $text);
        $lines = explode("\n", $text);
        $html = '';
        $listOpen = false;
        $paragraph = [];

        $inline = static function (string $line): string {
            $line = self::e($line);
            $line = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $line) ?? $line;
            $line = preg_replace('/(?<![\*\w])\*([^\*]+)\*(?!\*)/s', '<em>$1</em>', $line) ?? $line;
            $line = preg_replace('/`([^`]+)`/s', '<code>$1</code>', $line) ?? $line;
            $line = preg_replace(
                '/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/',
                '<a href="$2">$1</a>',
                $line
            ) ?? $line;
            return $line;
        };

        $flushParagraph = static function () use (&$paragraph, &$html, $inline): void {
            if ($paragraph !== []) {
                $html .= '<p>' . implode('<br>', array_map($inline, $paragraph)) . '</p>';
                $paragraph = [];
            }
        };

        foreach ($lines as $line) {
            $trimmed = trim($line);

            if ($trimmed === '') {
                $flushParagraph();
                if ($listOpen) {
                    $html .= '</ul>';
                    $listOpen = false;
                }
                continue;
            }

            if (preg_match('/^(#{1,4})\s+(.*)$/', $trimmed, $match)) {
                $flushParagraph();
                if ($listOpen) {
                    $html .= '</ul>';
                    $listOpen = false;
                }
                $level = min(6, strlen($match[1]) + 1);
                $html .= "<h{$level}>" . $inline($match[2]) . "</h{$level}>";
                continue;
            }

            if (preg_match('/^[-*]\s+(.*)$/', $trimmed, $match)) {
                $flushParagraph();
                if (!$listOpen) {
                    $html .= '<ul>';
                    $listOpen = true;
                }
                $html .= '<li>' . $inline($match[1]) . '</li>';
                continue;
            }

            if (preg_match('/^>\s?(.*)$/', $trimmed, $match)) {
                $flushParagraph();
                $html .= '<blockquote>' . $inline($match[1]) . '</blockquote>';
                continue;
            }

            if ($listOpen) {
                $html .= '</ul>';
                $listOpen = false;
            }

            $paragraph[] = $trimmed;
        }

        $flushParagraph();
        if ($listOpen) {
            $html .= '</ul>';
        }

        return $html;
    }

    /** Reading time in whole minutes, minimum one. */
    public static function readingMinutes(?string $text): int
    {
        $words = str_word_count(strip_tags((string) $text));
        return max(1, (int) ceil($words / 200));
    }

    public static function clamp(float $value, float $min, float $max): float
    {
        return max($min, min($max, $value));
    }
}
