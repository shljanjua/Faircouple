<?php
declare(strict_types=1);

/** Renders a PHP template inside a layout. */
final class View
{
    private static array $shared = [];

    public static function share(string $key, $value): void
    {
        self::$shared[$key] = $value;
    }

    /** Renders a view and prints it wrapped in a layout. */
    public static function render(string $view, array $data = [], string $layout = 'layouts/public', array $meta = []): void
    {
        if ($meta !== []) {
            Seo::set($meta);
        }

        $content = self::capture($view, $data);

        if ($layout === '') {
            echo $content;
            return;
        }

        echo self::capture($layout, $data + ['content' => $content]);
    }

    private static array $stack = [];

    /**
     * Starts an inline page. Everything echoed until View::end() becomes the
     * layout's `$content`, so a page can hold its logic and its markup in one
     * readable file.
     */
    public static function begin(string $layout = 'layouts/public', array $meta = [], array $data = []): void
    {
        if ($meta !== []) {
            Seo::set($meta);
        }
        self::$stack[] = ['layout' => $layout, 'data' => $data];
        ob_start();
    }

    public static function end(): void
    {
        $frame = array_pop(self::$stack);
        $content = (string) ob_get_clean();

        if ($frame === null || $frame['layout'] === '') {
            echo $content;
            return;
        }

        echo self::capture($frame['layout'], $frame['data'] + ['content' => $content]);
    }

    /** Renders a view to a string. */
    public static function capture(string $view, array $data = []): string
    {
        $path = self::path($view);
        if (!is_file($path)) {
            throw new RuntimeException("View not found: {$view}");
        }

        extract(self::$shared, EXTR_SKIP);
        extract($data, EXTR_OVERWRITE);

        ob_start();
        include $path;
        return (string) ob_get_clean();
    }

    /** Includes a partial from inside another template. */
    public static function partial(string $view, array $data = []): void
    {
        echo self::capture($view, $data);
    }

    private static function path(string $view): string
    {
        $view = str_replace(['..', "\0"], '', $view);
        return APP_PATH . '/views/' . trim($view, '/') . '.php';
    }

    /* --------------------------------------------------- Template shorthands */

    /** Escaped output. Used as `<?= View::e($value) ?>` in templates. */
    public static function e($value): string
    {
        return Str::e($value);
    }

    /** Marks a nav item as current. */
    public static function active(string $prefix, string $class = 'is-active'): string
    {
        $path = Request::path();
        $match = $prefix === '/' ? $path === '/' : str_starts_with($path, $prefix);
        return $match ? $class : '';
    }

    /** `<option>` list helper. */
    public static function options(array $options, $selected = null, bool $useKeys = true): string
    {
        $html = '';
        foreach ($options as $key => $label) {
            $value = $useKeys ? (string) $key : (string) $label;
            $isSelected = (string) $selected === $value ? ' selected' : '';
            $html .= '<option value="' . Str::e($value) . '"' . $isSelected . '>' . Str::e($label) . '</option>';
        }
        return $html;
    }

    /** A pill/badge. */
    public static function badge(string $label, string $tone = 'default'): string
    {
        return '<span class="badge badge-' . Str::e($tone) . '">' . Str::e($label) . '</span>';
    }

    /** An inline SVG icon from the sprite. */
    public static function icon(string $name, string $class = 'icon'): string
    {
        return '<svg class="' . Str::e($class) . '" aria-hidden="true" focusable="false">'
            . '<use href="/assets/img/icons.svg#' . Str::e($name) . '"></use></svg>';
    }

    /** Avatar image or coloured initials. */
    public static function avatar(?string $url, ?string $name, int $size = 40): string
    {
        $style = 'width:' . $size . 'px;height:' . $size . 'px;font-size:' . max(11, (int) round($size * 0.36)) . 'px';

        if ($url) {
            return '<img class="avatar" style="' . $style . '" src="' . Str::e($url) . '" alt="'
                . Str::e($name ?? 'Member') . '" loading="lazy" width="' . $size . '" height="' . $size . '">';
        }

        return '<span class="avatar avatar-initials" style="' . $style . '" aria-hidden="true">'
            . Str::e(Str::initials($name)) . '</span>';
    }

    /** Progress bar used for scores and quotas. */
    public static function meter(float $value, float $max = 100, string $tone = 'primary'): string
    {
        $percent = $max > 0 ? Str::clamp(($value / $max) * 100, 0, 100) : 0;
        return '<span class="meter"><span class="meter-fill meter-' . Str::e($tone)
            . '" style="width:' . number_format($percent, 1, '.', '') . '%"></span></span>';
    }
}
