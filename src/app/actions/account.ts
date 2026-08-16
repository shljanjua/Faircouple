'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { execute, query, queryOne, nowSql } from '@/lib/db';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { normalizeCurrency } from '@/lib/currency';
import { SESSION_COOKIE } from '@/lib/session';
import { fileUrl, deleteFile } from '@/lib/storage';
import type { ActionResult } from '@/app/actions/couple';

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const currency = formData.get('currency');

  const result = await execute(
    `UPDATE profiles
        SET full_name = ?, display_name = ?, phone = ?, bio = ?, date_of_birth = ?, gender = ?,
            country_code = ?, timezone = ?, locale = ?, currency = ?
      WHERE id = ?`,
    [
      String(formData.get('full_name') ?? '').trim() || null,
      String(formData.get('display_name') ?? '').trim() || null,
      String(formData.get('phone') ?? '').trim() || null,
      String(formData.get('bio') ?? '').trim() || null,
      String(formData.get('date_of_birth') ?? '') || null,
      String(formData.get('gender') ?? '') || null,
      String(formData.get('country_code') ?? '').toUpperCase() || null,
      String(formData.get('timezone') ?? user.profile.timezone),
      String(formData.get('locale') ?? 'en'),
      currency ? normalizeCurrency(String(currency)) : user.profile.currency,
      user.id,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save your profile.' };

  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Profile updated.' };
}

export async function updateNotificationPrefsAction(
  prefs: Record<string, boolean>
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const result = await execute(`UPDATE profiles SET notification_prefs = ? WHERE id = ?`, [
    JSON.stringify(prefs),
    user.id,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save your preferences.' };
  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Preferences saved.' };
}

/** Points the profile at a freshly uploaded avatar in the `avatars` bucket. */
export async function updateAvatarAction(path: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!path.startsWith(`${user.id}/`)) {
    return { ok: false, error: 'That file does not belong to your account.' };
  }

  const previous = user.profile.avatar_url;

  const result = await execute(`UPDATE profiles SET avatar_url = ? WHERE id = ?`, [
    fileUrl('avatars', path),
    user.id,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not update your photo.' };

  // Clean up the file the old avatar URL pointed at.
  if (previous?.startsWith('/api/files/avatars/')) {
    const oldPath = decodeURIComponent(previous.replace('/api/files/avatars/', ''));
    if (oldPath !== path) await deleteFile('avatars', oldPath);
  }

  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Photo updated.' };
}

/** Exports everything the signed-in user has entered (GDPR portability). */
export async function exportMyDataAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const coupleId = context?.couple.id ?? null;
  const forCouple = async (table: string) =>
    coupleId ? query<any>(`SELECT * FROM ${table} WHERE couple_id = ?`, [coupleId]) : [];

  const [emotions, fairness, checkins, assessments, expenses, gifts, trips, documents] =
    await Promise.all([
      query<any>(`SELECT * FROM emotion_logs WHERE user_id = ?`, [user.id]),
      query<any>(`SELECT * FROM fairness_entries WHERE user_id = ?`, [user.id]),
      query<any>(`SELECT * FROM daily_checkins WHERE user_id = ?`, [user.id]),
      query<any>(`SELECT * FROM assessments WHERE user_id = ?`, [user.id]),
      forCouple('expenses'),
      forCouple('gifts'),
      forCouple('trips'),
      forCouple('travel_documents'),
    ]);

  return {
    ok: true,
    data: {
      exported_at: new Date().toISOString(),
      profile: user.profile,
      couple: context?.couple ?? null,
      emotion_logs: emotions,
      fairness_entries: fairness,
      daily_checkins: checkins,
      assessments,
      expenses,
      gifts,
      trips,
      travel_documents: documents,
    },
  };
}

/**
 * Deletes the signed-in user's account. Private entries are removed, shared
 * rows are detached so the other partner keeps their own history intact, and
 * the login row is disabled straight away.
 */
export async function deleteMyAccountAction(confirmation: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (confirmation.trim().toUpperCase() !== 'DELETE') {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  await execute(`DELETE FROM emotion_logs WHERE user_id = ? AND is_private = 1`, [user.id]);
  await execute(`DELETE FROM fairness_entries WHERE user_id = ? AND is_private = 1`, [user.id]);

  await execute(`UPDATE couple_members SET removed_at = ? WHERE user_id = ? AND removed_at IS NULL`, [
    nowSql(),
    user.id,
  ]);

  const deletedAt = nowSql();
  await execute(`UPDATE profiles SET status = 'pending_deletion', deleted_at = ? WHERE id = ?`, [
    deletedAt,
    user.id,
  ]);

  // Disable the login immediately and drop every active session.
  await execute(`UPDATE users SET disabled_at = ? WHERE id = ?`, [deletedAt, user.id]);
  await execute(`DELETE FROM sessions WHERE user_id = ?`, [user.id]);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'account.delete',
    entityType: 'profile',
    entityId: user.id,
    summary: 'User requested account deletion',
  });

  cookies().delete(SESSION_COOKIE);

  return {
    ok: true,
    message:
      'Your account has been closed. Sign-in is disabled and the remaining data is purged within 30 days.',
  };
}

/** Cancels a pending deletion while the 30-day window is still open. */
export async function restoreMyAccountAction(email: string): Promise<ActionResult> {
  const profile = await queryOne<{ id: string }>(
    `SELECT id FROM profiles WHERE email = ? AND status = 'pending_deletion' LIMIT 1`,
    [email.trim().toLowerCase()]
  );
  if (!profile) return { ok: false, error: 'No account is pending deletion for that address.' };

  await execute(`UPDATE profiles SET status = 'active', deleted_at = NULL WHERE id = ?`, [
    profile.id,
  ]);
  await execute(`UPDATE users SET disabled_at = NULL WHERE id = ?`, [profile.id]);

  return { ok: true, message: 'Account restored. You can sign in again.' };
}
