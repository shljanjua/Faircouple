import 'server-only';
import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';

/**
 * MySQL connection pool (Hostinger).
 *
 * Hostinger gives you the host, database and user in hPanel → Databases →
 * Management. Set them in the environment:
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
 *
 * The pool is cached on globalThis so Next.js hot-reloads and serverless
 * warm starts reuse a single set of connections instead of exhausting the
 * account's connection limit.
 */

const globalForDb = globalThis as unknown as { __fcPool?: Pool };

export const DB_CONFIGURED = Boolean(
  process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER
);

function createPool(): Pool {
  return mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE || 'u237845628_Faircouple',
    user: process.env.MYSQL_USER || 'u237845628_Faircouple',
    password: process.env.MYSQL_PASSWORD || '',
    waitForConnections: true,
    // Hostinger shared MySQL allows a modest number of concurrent connections.
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 8),
    maxIdle: 4,
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: ['DATE'],
    supportBigNumbers: true,
    bigNumberStrings: false,
    namedPlaceholders: false,
    ...(process.env.MYSQL_SSL === 'true'
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });
}

export function getPool(): Pool {
  if (!globalForDb.__fcPool) {
    globalForDb.__fcPool = createPool();
  }
  return globalForDb.__fcPool;
}

/**
 * MySQL cannot bind LIMIT/OFFSET as prepared-statement parameters reliably
 * across driver versions, so build that fragment from coerced integers. Both
 * values go through Number(), which makes injection impossible.
 */
export function limitOffset(limit: number, offset = 0): string {
  const take = Math.max(1, Math.min(1000, Math.trunc(Number(limit) || 1)));
  const skip = Math.max(0, Math.trunc(Number(offset) || 0));
  return skip > 0 ? `LIMIT ${take} OFFSET ${skip}` : `LIMIT ${take}`;
}

/** Runs a SELECT and returns typed rows. Never throws on a dead database. */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!DB_CONFIGURED) {
    warnUnconfigured();
    return [];
  }
  try {
    const [rows] = await getPool().execute<RowDataPacket[]>(sql, normalize(params));
    return rows as unknown as T[];
  } catch (error) {
    logDbError(sql, error);
    return [];
  }
}

/** Runs a SELECT expected to match at most one row. */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export interface WriteResult {
  ok: boolean;
  error?: string;
  insertId?: string;
  affectedRows: number;
}

/** Runs an INSERT/UPDATE/DELETE and reports failure instead of throwing. */
export async function execute(sql: string, params: any[] = []): Promise<WriteResult> {
  if (!DB_CONFIGURED) {
    warnUnconfigured();
    return { ok: false, error: DB_UNCONFIGURED_MESSAGE, affectedRows: 0 };
  }
  try {
    const [result] = await getPool().execute<ResultSetHeader>(sql, normalize(params));
    return {
      ok: true,
      affectedRows: result.affectedRows,
      insertId: result.insertId ? String(result.insertId) : undefined,
    };
  } catch (error) {
    logDbError(sql, error);
    return { ok: false, error: friendlyError(error), affectedRows: 0 };
  }
}

/** Runs several statements atomically. Rolls back on any failure. */
export async function transaction<T>(
  handler: (connection: PoolConnection) => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let connection: PoolConnection | null = null;
  try {
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    const data = await handler(connection);
    await connection.commit();
    return { ok: true, data };
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    logDbError('transaction', error);
    return { ok: false, error: friendlyError(error) };
  } finally {
    connection?.release();
  }
}

/** Counts rows matching a WHERE clause. */
export async function count(
  table: string,
  where: string,
  params: any[] = []
): Promise<number> {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM \`${table}\` WHERE ${where}`,
    params
  );
  return Number(row?.total ?? 0);
}

/** Generates a v4 UUID for CHAR(36) primary keys. */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * MySQL rejects `undefined` parameters and cannot bind Date objects reliably
 * across drivers, so normalise everything before it reaches the driver.
 */
function normalize(params: any[]): any[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

/** MySQL JSON columns come back as strings on some driver versions. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

/** Formats a JS Date (or ISO string) for a MySQL DATETIME column. */
export function toMysqlDateTime(value?: string | Date | null): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function nowSql(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('ER_DUP_ENTRY')) return 'That record already exists.';
  if (message.includes('ER_NO_REFERENCED_ROW')) return 'A linked record is missing.';
  if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
    return 'Could not reach the database. Check the MySQL credentials and remote access.';
  }
  if (message.includes("doesn't exist")) {
    return 'A database table is missing — import database/faircouples-mysql.sql first.';
  }
  return message;
}

const DB_UNCONFIGURED_MESSAGE =
  'The database is not configured. Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD.';

let warnedUnconfigured = false;

/** Warns once per process instead of on every query during a build. */
function warnUnconfigured() {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  console.warn(`[db] ${DB_UNCONFIGURED_MESSAGE}`);
}

function logDbError(sql: string, error: unknown) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[db]', (error as Error)?.message);
  } else {
    console.error('[db]', sql.slice(0, 160).replace(/\s+/g, ' '), '→', (error as Error)?.message);
  }
}
