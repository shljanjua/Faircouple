<?php
declare(strict_types=1);

/**
 * A very small PDO wrapper. One connection per request, prepared statements
 * everywhere, and read helpers that return plain arrays.
 */
final class Db
{
    private static ?PDO $pdo = null;
    private static ?string $lastError = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $config = Config::get('db');
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $config['host'],
            (int) $config['port'],
            $config['name'],
            $config['charset']
        );

        self::$pdo = new PDO($dsn, $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_STRINGIFY_FETCHES  => false,
        ]);

        self::$pdo->exec("SET time_zone = '+00:00'");

        return self::$pdo;
    }

    /** True when the database is reachable — used by the installer check. */
    public static function isReachable(): bool
    {
        try {
            self::pdo()->query('SELECT 1');
            return true;
        } catch (Throwable $e) {
            self::$lastError = $e->getMessage();
            return false;
        }
    }

    public static function lastError(): ?string
    {
        return self::$lastError;
    }

    /** @return array<int,array<string,mixed>> */
    public static function all(string $sql, array $params = []): array
    {
        try {
            $statement = self::pdo()->prepare($sql);
            $statement->execute(self::normalise($params));
            return $statement->fetchAll();
        } catch (Throwable $e) {
            self::report($sql, $e);
            return [];
        }
    }

    /** @return array<string,mixed>|null */
    public static function one(string $sql, array $params = []): ?array
    {
        $rows = self::all($sql, $params);
        return $rows[0] ?? null;
    }

    /** Returns the first column of the first row. */
    public static function value(string $sql, array $params = [], $fallback = null)
    {
        $row = self::one($sql, $params);
        if ($row === null) {
            return $fallback;
        }
        return array_values($row)[0] ?? $fallback;
    }

    public static function count(string $table, string $where = '1', array $params = []): int
    {
        return (int) self::value("SELECT COUNT(*) FROM `{$table}` WHERE {$where}", $params, 0);
    }

    /**
     * Runs an INSERT/UPDATE/DELETE.
     *
     * @return array{ok:bool,error:?string,rows:int}
     */
    public static function run(string $sql, array $params = []): array
    {
        try {
            $statement = self::pdo()->prepare($sql);
            $statement->execute(self::normalise($params));
            return ['ok' => true, 'error' => null, 'rows' => $statement->rowCount()];
        } catch (Throwable $e) {
            self::report($sql, $e);
            return ['ok' => false, 'error' => self::friendly($e), 'rows' => 0];
        }
    }

    /** Inserts a row from an associative array and returns its id. */
    public static function insert(string $table, array $data): ?string
    {
        if (!isset($data['id'])) {
            $data = ['id' => Str::uuid()] + $data;
        }

        $columns = array_keys($data);
        $sql = sprintf(
            'INSERT INTO `%s` (%s) VALUES (%s)',
            $table,
            '`' . implode('`, `', $columns) . '`',
            implode(', ', array_fill(0, count($columns), '?'))
        );

        $result = self::run($sql, array_values($data));
        return $result['ok'] ? (string) $data['id'] : null;
    }

    /** Updates a row by primary key. */
    public static function update(string $table, string $id, array $data, string $key = 'id'): bool
    {
        if ($data === []) {
            return true;
        }
        $sets = implode(', ', array_map(static fn ($c) => "`{$c}` = ?", array_keys($data)));
        $sql = "UPDATE `{$table}` SET {$sets} WHERE `{$key}` = ?";
        $params = array_values($data);
        $params[] = $id;
        return self::run($sql, $params)['ok'];
    }

    public static function delete(string $table, string $where, array $params = []): bool
    {
        return self::run("DELETE FROM `{$table}` WHERE {$where}", $params)['ok'];
    }

    /** Builds `IN (?, ?, ?)` placeholders for a list. */
    public static function placeholders(array $values): string
    {
        return implode(',', array_fill(0, max(1, count($values)), '?'));
    }

    public static function begin(): void
    {
        self::pdo()->beginTransaction();
    }

    public static function commit(): void
    {
        if (self::pdo()->inTransaction()) {
            self::pdo()->commit();
        }
    }

    public static function rollback(): void
    {
        if (self::pdo()->inTransaction()) {
            self::pdo()->rollBack();
        }
    }

    /**
     * PDO refuses booleans on some MySQL builds and cannot bind arrays or
     * DateTime objects, so everything is coerced before it reaches the driver.
     */
    private static function normalise(array $params): array
    {
        $out = [];
        foreach ($params as $key => $value) {
            if (is_bool($value)) {
                $out[$key] = $value ? 1 : 0;
            } elseif ($value instanceof DateTimeInterface) {
                $out[$key] = $value->format('Y-m-d H:i:s');
            } elseif (is_array($value)) {
                $out[$key] = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                $out[$key] = $value;
            }
        }
        return $out;
    }

    private static function friendly(Throwable $e): string
    {
        $message = $e->getMessage();
        if (str_contains($message, '1062')) {
            return 'That record already exists.';
        }
        if (str_contains($message, '1452')) {
            return 'A linked record is missing.';
        }
        if (str_contains($message, '1146')) {
            return 'A database table is missing — import database/mysql/faircouples-mysql.sql first.';
        }
        if (str_contains($message, '2002') || str_contains($message, '1045')) {
            return 'Could not reach the database. Check the credentials in app/config.php.';
        }
        return Config::isDev() ? $message : 'The database rejected that request.';
    }

    private static function report(string $sql, Throwable $e): void
    {
        self::$lastError = $e->getMessage();
        if (Config::isDev()) {
            error_log('[db] ' . substr(preg_replace('/\s+/', ' ', $sql), 0, 200) . ' -> ' . $e->getMessage());
        } else {
            error_log('[db] ' . $e->getMessage());
        }
    }
}
