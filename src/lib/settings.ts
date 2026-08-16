import 'server-only';
import { cache } from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { DEFAULT_SETTINGS, type SettingsMap } from '@/lib/settings-utils';

export {
  DEFAULT_SETTINGS,
  settingString,
  settingBool,
  settingNumber,
  type SettingsMap,
} from '@/lib/settings-utils';

/**
 * Public settings — safe for anonymous rendering. Cached per request.
 */
export const getPublicSettings = cache(async (): Promise<SettingsMap> => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from('public_settings').select('key, value');
    if (error || !data) return { ...DEFAULT_SETTINGS };
    const map: SettingsMap = { ...DEFAULT_SETTINGS };
    for (const row of data) map[row.key as string] = (row as any).value;
    return map;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
});

/**
 * Every setting including secrets (SMTP, gateway keys). Server-only, and the
 * caller must already have verified the requester is an admin.
 */
export async function getAllSettings(): Promise<SettingsMap> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from('site_settings').select('key, value');
    const map: SettingsMap = { ...DEFAULT_SETTINGS };
    for (const row of data ?? []) map[row.key as string] = (row as any).value;
    return map;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function getSetting<T = any>(key: string, fallback?: T): Promise<T> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  if (!data) return (fallback ?? DEFAULT_SETTINGS[key]) as T;
  return (data as any).value as T;
}

export async function setSettings(values: SettingsMap, updatedBy?: string) {
  const supabase = createAdminClient();
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value,
    updated_by: updatedBy ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}
