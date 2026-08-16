'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { notifyUser } from '@/lib/audit';
import { limitReached, upgradeMessage, type LimitKey } from '@/lib/plans';
import type { ActionResult } from '@/app/actions/couple';

type SpaceResult =
  | { ok: false; error: string }
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>; context: NonNullable<Awaited<ReturnType<typeof getCoupleContext>>> };

async function requireSpace(): Promise<SpaceResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!context) return { ok: false, error: 'Create your relationship space first.' };
  return { ok: true, user, context };
}

async function checkLimit(
  key: LimitKey,
  table: string,
  coupleId: string,
  extraFilter?: (query: any) => any
): Promise<string | null> {
  const entitlements = await getEntitlements();
  const value = entitlements.limits[key];
  if (typeof value === 'boolean') return value ? null : upgradeMessage(key);
  if (value === -1) return null;

  const supabase = createClient();
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('couple_id', coupleId);
  if (extraFilter) query = extraFilter(query);

  const { count } = await query;
  return limitReached(entitlements.limits, key, count ?? 0) ? upgradeMessage(key) : null;
}

/* ------------------------------------------------------------------ Emotions */

export async function logEmotionAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const limitError = await checkLimit('emotion_logs', 'emotion_logs', context.couple.id, (q) =>
    q.gte('logged_at', startOfMonth.toISOString())
  );
  if (limitError) return { ok: false, error: limitError };

  const scope = String(formData.get('scope') ?? 'self') as 'self' | 'partner' | 'relationship';
  const emotionSlug = String(formData.get('emotion_slug') ?? '').trim();
  if (!emotionSlug) return { ok: false, error: 'Pick an emotion first.' };

  const isPrivate = formData.get('is_private') === 'on' || formData.get('is_private') === 'true';

  const supabase = createClient();
  const { error } = await supabase.from('emotion_logs').insert({
    couple_id: context.couple.id,
    user_id: user.id,
    about_user_id: scope === 'partner' ? (context.partner?.user_id ?? null) : null,
    scope,
    emotion_slug: emotionSlug,
    intensity: Number(formData.get('intensity') ?? 5),
    mood_score: formData.get('mood_score') ? Number(formData.get('mood_score')) : null,
    energy: formData.get('energy') ? Number(formData.get('energy')) : null,
    trigger: String(formData.get('trigger') ?? '').trim() || null,
    need: String(formData.get('need') ?? '').trim() || null,
    note: String(formData.get('note') ?? '').trim() || null,
    tags: String(formData.get('tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    is_private: isPrivate,
    shared_at: isPrivate ? null : new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };

  if (!isPrivate && context.partner) {
    await notifyUser({
      userId: context.partner.user_id,
      coupleId: context.couple.id,
      type: 'emotion',
      title: `${user.profile.full_name ?? 'Your partner'} shared how they feel`,
      body: scope === 'partner' ? 'It is about you — read it before replying.' : undefined,
      link: '/dashboard/emotions',
      emoji: '💗',
    });
  }

  revalidatePath('/dashboard/emotions');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Logged.' };
}

export async function acknowledgeEmotionAction(emotionId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const supabase = createClient();
  const { error } = await supabase
    .from('emotion_logs')
    .update({ acknowledged_by: space.user.id, acknowledged_at: new Date().toISOString() })
    .eq('id', emotionId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/emotions');
  return { ok: true, message: 'Acknowledged.' };
}

export async function deleteEmotionAction(emotionId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const supabase = createClient();
  const { error } = await supabase
    .from('emotion_logs')
    .delete()
    .eq('id', emotionId)
    .eq('user_id', space.user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/emotions');
  return { ok: true, message: 'Deleted.' };
}

/* ----------------------------------------------------------------- Check-ins */

export async function saveCheckinAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const supabase = createClient();
  const { error } = await supabase.from('daily_checkins').upsert(
    {
      couple_id: context.couple.id,
      user_id: user.id,
      checkin_date: String(formData.get('checkin_date') ?? new Date().toISOString().slice(0, 10)),
      day_rating: Number(formData.get('day_rating') ?? 5),
      connection: Number(formData.get('connection') ?? 5),
      gratitude: String(formData.get('gratitude') ?? '').trim() || null,
      highlight: String(formData.get('highlight') ?? '').trim() || null,
      challenge: String(formData.get('challenge') ?? '').trim() || null,
      need_from_partner: String(formData.get('need_from_partner') ?? '').trim() || null,
    },
    { onConflict: 'couple_id,user_id,checkin_date' }
  );

  if (error) return { ok: false, error: error.message };

  if (context.partner) {
    await notifyUser({
      userId: context.partner.user_id,
      coupleId: context.couple.id,
      type: 'checkin',
      title: `${user.profile.full_name ?? 'Your partner'} checked in today`,
      link: '/dashboard/checkin',
      emoji: '📅',
    });
  }

  revalidatePath('/dashboard/checkin');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Check-in saved.' };
}

/* --------------------------------------------------------------- Checklists */

export async function createChecklistAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const limitError = await checkLimit('checklists', 'checklists', context.couple.id, (q) =>
    q.is('archived_at', null)
  );
  if (limitError) return { ok: false, error: limitError };

  const templateId = String(formData.get('template_id') ?? '') || null;
  const supabase = createClient();

  let title = String(formData.get('title') ?? '').trim();
  let category = String(formData.get('category') ?? 'relationship');
  let emoji = String(formData.get('emoji') ?? '') || null;
  let items: any[] = [];

  if (templateId) {
    const { data: template } = await supabase
      .from('checklist_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();
    if (template) {
      title = title || (template as any).name;
      category = (template as any).category;
      emoji = (template as any).emoji;
      items = Array.isArray((template as any).items) ? (template as any).items : [];
    }
  }

  if (!title) return { ok: false, error: 'Give the checklist a name.' };

  const { data: checklist, error } = await supabase
    .from('checklists')
    .insert({
      couple_id: context.couple.id,
      trip_id: String(formData.get('trip_id') ?? '') || null,
      template_id: templateId,
      title,
      category,
      emoji,
      description: String(formData.get('description') ?? '').trim() || null,
      due_date: String(formData.get('due_date') ?? '') || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  if (items.length) {
    await supabase.from('checklist_items').insert(
      items.map((item, index) => ({
        checklist_id: (checklist as any).id,
        title: item.name ?? item.title ?? 'Item',
        category: item.category ?? null,
        priority: item.essential ? 'high' : 'normal',
        sort_order: index,
      }))
    );
  }

  revalidatePath('/dashboard/checklists');
  return { ok: true, message: 'Checklist created.', data: (checklist as any).id };
}

export async function addChecklistItemAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const checklistId = String(formData.get('checklist_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!checklistId || !title) return { ok: false, error: 'Missing item title.' };

  const supabase = createClient();
  const { error } = await supabase.from('checklist_items').insert({
    checklist_id: checklistId,
    title,
    category: String(formData.get('category') ?? '') || null,
    quantity: Number(formData.get('quantity') ?? 1),
    assigned_to: String(formData.get('assigned_to') ?? '') || null,
    priority: String(formData.get('priority') ?? 'normal'),
    due_date: String(formData.get('due_date') ?? '') || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/checklists');
  return { ok: true };
}

export async function toggleChecklistItemAction(
  itemId: string,
  done: boolean
): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const supabase = createClient();
  const { error } = await supabase
    .from('checklist_items')
    .update({
      is_done: done,
      done_by: done ? space.user.id : null,
      done_at: done ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/checklists');
  return { ok: true };
}

export async function deleteChecklistItemAction(itemId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const supabase = createClient();
  const { error } = await supabase.from('checklist_items').delete().eq('id', itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/checklists');
  return { ok: true };
}

export async function deleteChecklistAction(checklistId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const supabase = createClient();
  const { error } = await supabase.from('checklists').delete().eq('id', checklistId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/checklists');
  return { ok: true, message: 'Checklist deleted.' };
}

/* -------------------------------------------------------------------- Gifts */

export async function saveGiftAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const giftId = String(formData.get('id') ?? '');

  if (!giftId) {
    const limitError = await checkLimit('gifts', 'gifts', context.couple.id);
    if (limitError) return { ok: false, error: limitError };
  }

  const payload = {
    couple_id: context.couple.id,
    from_user: user.id,
    to_user: String(formData.get('to_user') ?? '') || context.partner?.user_id || null,
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    occasion: String(formData.get('occasion') ?? 'other'),
    status: String(formData.get('status') ?? 'idea'),
    amount_cents: formData.get('amount')
      ? Math.round(Number(formData.get('amount')) * 100)
      : null,
    currency: String(formData.get('currency') ?? context.couple.currency),
    url: String(formData.get('url') ?? '').trim() || null,
    store: String(formData.get('store') ?? '').trim() || null,
    occasion_date: String(formData.get('occasion_date') ?? '') || null,
    is_surprise: formData.get('is_surprise') !== 'false',
    created_by: user.id,
  };

  if (!payload.title) return { ok: false, error: 'Give the gift a name.' };

  const supabase = createClient();
  const { error } = giftId
    ? await supabase.from('gifts').update(payload).eq('id', giftId)
    : await supabase.from('gifts').insert(payload);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/gifts');
  return { ok: true, message: 'Gift saved.' };
}

export async function deleteGiftAction(giftId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const supabase = createClient();
  const { error } = await supabase.from('gifts').delete().eq('id', giftId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/gifts');
  return { ok: true, message: 'Deleted.' };
}

export async function saveWishlistItemAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const supabase = createClient();
  const { error } = await supabase.from('wishlist_items').insert({
    couple_id: context.couple.id,
    user_id: user.id,
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    url: String(formData.get('url') ?? '').trim() || null,
    price_cents: formData.get('price') ? Math.round(Number(formData.get('price')) * 100) : null,
    currency: context.couple.currency,
    priority: String(formData.get('priority') ?? 'normal'),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/gifts');
  return { ok: true, message: 'Added to your wishlist.' };
}

/* --------------------------------------------------------------- Messaging */

/**
 * Sends a chat message through the server so the plan's monthly message limit
 * is enforced where it cannot be bypassed. The partner still receives it
 * instantly over the realtime channel.
 */
export async function sendMessageAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const conversationId = String(formData.get('conversation_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  const messageType = String(formData.get('message_type') ?? 'text');
  const attachmentPath = String(formData.get('attachment_path') ?? '') || null;

  if (!conversationId) return { ok: false, error: 'No conversation found.' };
  if (messageType === 'text' && !body) return { ok: false, error: 'Write something first.' };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const limitError = await checkLimit('messages', 'messages', context.couple.id, (q) =>
    q.gte('created_at', startOfMonth.toISOString()).eq('sender_id', space.user.id)
  );
  if (limitError) return { ok: false, error: limitError };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      couple_id: context.couple.id,
      sender_id: user.id,
      body: messageType === 'text' ? body : null,
      message_type: messageType,
      attachment_path: attachmentPath,
      attachment_name: String(formData.get('attachment_name') ?? '') || null,
      attachment_size: formData.get('attachment_size')
        ? Number(formData.get('attachment_size'))
        : null,
      attachment_mime: String(formData.get('attachment_mime') ?? '') || null,
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };

  await supabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: (body || 'Photo').slice(0, 120),
    })
    .eq('id', conversationId);

  return { ok: true, data };
}
