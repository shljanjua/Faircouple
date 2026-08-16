import 'server-only';
import { cache } from 'react';
import { query, execute, parseJson, nowSql } from '@/lib/db';
import { DEFAULT_SETTINGS, type SettingsMap } from '@/lib/settings-utils';

export {
  DEFAULT_SETTINGS,
  settingString,
  settingBool,
  settingNumber,
  type SettingsMap,
} from '@/lib/settings-utils';

function hydrate(rows: any[]): SettingsMap {
  const map: SettingsMap = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    map[row.setting_key] = parseJson(row.value, row.value);
  }
  return map;
}

/** Public settings — safe for anonymous rendering. Cached per request. */
export const getPublicSettings = cache(async (): Promise<SettingsMap> => {
  const rows = await query<any>(
    `SELECT setting_key, value FROM site_settings WHERE is_public = 1 AND is_secret = 0`
  );
  return hydrate(rows);
});

/**
 * Every setting including secrets (SMTP password, gateway keys). Server-only:
 * the caller must already have verified the requester is an admin before
 * putting any of this on screen.
 */
export const getAllSettings = cache(async (): Promise<SettingsMap> => {
  const rows = await query<any>(`SELECT setting_key, value FROM site_settings`);
  return hydrate(rows);
});

export async function getSetting<T = any>(key: string, fallback?: T): Promise<T> {
  const rows = await query<any>(`SELECT value FROM site_settings WHERE setting_key = ? LIMIT 1`, [
    key,
  ]);
  if (!rows.length) return (fallback ?? DEFAULT_SETTINGS[key]) as T;
  return parseJson(rows[0].value, fallback as T);
}

export async function setSettings(values: SettingsMap, updatedBy?: string) {
  for (const [key, value] of Object.entries(values)) {
    const result = await execute(
      `INSERT INTO site_settings (setting_key, value, updated_by, updated_at)
       VALUES (?, CAST(? AS JSON), ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
      [key, JSON.stringify(value ?? null), updatedBy ?? null, nowSql()]
    );
    if (!result.ok) throw new Error(result.error ?? `Could not save ${key}`);
  }
}
