<?php
declare(strict_types=1);

/**
 * A tiny route table. Patterns use `{name}` for one segment; the captured
 * values are passed to the page file as `$params`.
 */
final class Router
{
    /** @var array<int,array{methods:array,pattern:string,handler:string}> */
    private array $routes = [];

    public function get(string $pattern, string $handler): void
    {
        $this->add(['GET'], $pattern, $handler);
    }

    public function post(string $pattern, string $handler): void
    {
        $this->add(['POST'], $pattern, $handler);
    }

    /** Most pages both render and accept their own form posts. */
    public function any(string $pattern, string $handler): void
    {
        $this->add(['GET', 'POST'], $pattern, $handler);
    }

    private function add(array $methods, string $pattern, string $handler): void
    {
        $this->routes[] = [
            'methods' => $methods,
            'pattern' => '/' . trim($pattern, '/'),
            'handler' => $handler,
        ];
    }

    /** Finds the page for the current request and runs it. */
    public function dispatch(): void
    {
        $path = Request::path();
        $method = Request::method();
        $methodMismatch = false;

        $this->applyRedirect($path, $method);

        foreach ($this->routes as $route) {
            $params = $this->match($route['pattern'], $path);
            if ($params === null) {
                continue;
            }

            if (!in_array($method, $route['methods'], true)) {
                $methodMismatch = true;
                continue;
            }

            $this->run($route['handler'], $params);
            return;
        }

        if ($methodMismatch) {
            http_response_code(405);
            header('Allow: GET, POST');
        }

        Response::notFound();
    }

    /**
     * Sends the 301/302 an admin created in Admin -> SEO, if this path has one.
     * It runs before route matching so a redirect can move a URL the CMS
     * catch-all would otherwise answer. Signed-in areas are skipped, and the
     * lookup is a single hit on the unique index on `redirects.source`.
     */
    private function applyRedirect(string $path, string $method): void
    {
        if ($method !== 'GET' || $path === '/') {
            return;
        }

        foreach (['/admin', '/dashboard', '/assets', '/checkout'] as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return;
            }
        }

        $redirect = Db::one(
            'SELECT id, destination, status_code FROM redirects
              WHERE source = ? AND is_active = 1 LIMIT 1',
            [$path]
        );

        if (!$redirect) {
            return;
        }

        $target = (string) $redirect['destination'];

        // Never bounce a visitor onto the page they are already on.
        if ($target === $path) {
            return;
        }

        Db::run('UPDATE redirects SET hits = hits + 1 WHERE id = ?', [$redirect['id']]);

        $status = (int) $redirect['status_code'] === 302 ? 302 : 301;
        Response::redirect($target, $status);
    }

    /** @return array<string,string>|null */
    private function match(string $pattern, string $path): ?array
    {
        if ($pattern === $path) {
            return [];
        }
        if (!str_contains($pattern, '{')) {
            return null;
        }

        $patternParts = explode('/', trim($pattern, '/'));
        $pathParts = explode('/', trim($path, '/'));

        if (count($patternParts) !== count($pathParts)) {
            return null;
        }

        $params = [];
        foreach ($patternParts as $index => $part) {
            $value = $pathParts[$index] ?? '';

            if (preg_match('/^\{(\w+)\}$/', $part, $matches)) {
                if ($value === '') {
                    return null;
                }
                $params[$matches[1]] = $value;
                continue;
            }

            if ($part !== $value) {
                return null;
            }
        }

        return $params;
    }

    /** @param array<string,string> $params */
    private function run(string $handler, array $params): void
    {
        $file = APP_PATH . '/pages/' . str_replace(['..', "\0"], '', $handler) . '.php';

        if (!is_file($file)) {
            throw new RuntimeException("Page not found: {$handler}");
        }

        // Every POST must carry a valid CSRF token.
        Csrf::check();

        require $file;
    }
}
