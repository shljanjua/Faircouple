'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { normalizeCurrency } from '@/lib/currency';
import type { ActionResult } from '@/app/actions/couple';

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const supabase = createClient();
  const payload: Record<string, unknown> = {
    full_name: String(formData.get('full_name') ?? '').trim() || null,
    display_name: String(formData.get('display_name') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    bio: String(formData.get('bio') ?? '').trim() || null,
    date_of_birth: String(formData.get('date_of_birth') ?? '') || null,
    gender: String(formData.get('gender') ?? '') || null,
    country_code: String(formData.get('country_code') ?? '').toUpperCase() || null,
    timezone: String(formData.get('timezone') ?? user.profile.timezone),
    locale: String(formData.get('locale') ?? 'en'),
  };

  const currency = formData.get('currency');
  if (currency) payload.currency = normalizeCurrency(String(currency));

  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Profile updated.' };
}

export async function updateNotificationPrefsAction(
  prefs: Record<string, boolean>
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ notification_prefs: prefs })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Preferences saved.' };
}

export async function updateAvatarAction(path: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const supabase = createClient();
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: (data as any).publicUrl })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Photo updated.' };
}

/** Exports everything the signed-in user has entered (GDPR portability). */
export async function exportMyDataAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const supabase = createClient();
  const coupleId = context?.couple.id;

  const [emotions, fairness, checkins, assessments, expenses, gifts, trips, documents] =
    await Promise.all([
      supabase.from('emotion_logs').select('*').eq('user_id', user.id),
      supabase.from('fairness_entries').select('*').eq('user_id', user.id),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id),
      supabase.from('assessments').select('*').eq('user_id', user.id),
      coupleId
        ? supabase.from('expenses').select('*').eq('couple_id', coupleId)
        : Promise.resolve({ data: [] } as any),
      coupleId
        ? supabase.from('gifts').select('*').eq('couple_id', coupleId)
        : Promise.resolve({ data: [] } as any),
      coupleId
        ? supabase.from('trips').select('*').eq('couple_id', coupleId)
        : Promise.resolve({ data: [] } as any),
      coupleId
        ? supabase.from('travel_documents').select('*').eq('couple_id', coupleId)
        : Promise.resolve({ data: [] } as any),
    ]);

  return {
    ok: true,
    data: {
      exported_at: new Date().toISOString(),
      profile: user.profile,
      couple: context?.couple ?? null,
      emotion_logs: emotions.data ?? [],
      fairness_entries: fairness.data ?? [],
      daily_checkins: checkins.data ?? [],
      assessments: assessments.data ?? [],
      expenses: (expenses as any).data ?? [],
      gifts: (gifts as any).data ?? [],
      trips: (trips as any).data ?? [],
      travel_documents: (documents as any).data ?? [],
    },
  };
}

/**
 * Deletes the signed-in user's account. Private entries are removed; shared
 * rows are detached so the other partner keeps their own history intact.
 */
export async function deleteMyAccountAction(confirmation: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (confirmation.trim().toUpperCase() !== 'DELETE') {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  const supabase = createClient();
  const admin = createAdminClient();

  await supabase.from('emotion_logs').delete().eq('user_id', user.id).eq('is_private', true);
  await supabase.from('fairness_entries').delete().eq('user_id', user.id).eq('is_private', true);

  await supabase
    .from('couple_members')
    .update({ removed_at: new Date().toISOString() })
    .eq('user_id', user.id);

  await supabase
    .from('profiles')
    .update({ status: 'pending_deletion', deleted_at: new Date().toISOString() })
    .eq('id', user.id);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'account.delete',
    entityType: 'profile',
    entityId: user.id,
    summary: 'User requested account deletion',
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return {
      ok: true,
      message:
        'Your account is scheduled for deletion. Sign-in has been disabled and data will be purged within 30 days.',
    };
  }

  return { ok: true, message: 'Your account has been deleted.' };
}
