'use server';

import { revalidatePath } from 'next/cache';
import { execute, query, queryOne, uuid, nowSql, parseJson } from '@/lib/db';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { notifyUser } from '@/lib/audit';
import { limitReached, upgradeMessage, type LimitKey } from '@/lib/plans';
import type { ActionResult } from '@/app/actions/couple';

type SpaceResult =
  | { ok: false; error: string }
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
      context: NonNullable<Awaited<ReturnType<typeof getCoupleContext>>>;
    };

async function requireSpace(): Promise<SpaceResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!context) return { ok: false, error: 'Create your relationship space first.' };
  return { ok: true, user, context };
}

/**
 * Counts existing rows for the couple and compares them with the plan limit.
 * `extraWhere` is appended to the WHERE clause so callers can scope a limit to
 * the current month, to live rows only, and so on.
 */
async function checkLimit(
  key: LimitKey,
  table: string,
  coupleId: string,
  extraWhere = '',
  extraParams: unknown[] = []
): Promise<string | null> {
  const entitlements = await getEntitlements();
  const value = entitlements.limits[key];
  if (typeof value === 'boolean') return value ? null : upgradeMessage(key);
  if (value === -1) return null;

  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM ${table} WHERE couple_id = ?${extraWhere}`,
    [coupleId, ...extraParams]
  );

  const count = Number(row?.total ?? 0);
  return limitReached(entitlements.limits, key, count) ? upgradeMessage(key) : null;
}

function startOfMonthSql() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/* ------------------------------------------------------------------ Emotions */

export async function logEmotionAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const limitError = await checkLimit(
    'emotion_logs',
    'emotion_logs',
    context.couple.id,
    ' AND logged_at >= ?',
    [startOfMonthSql()]
  );
  if (limitError) return { ok: false, error: limitError };

  const scope = String(formData.get('scope') ?? 'self') as 'self' | 'partner' | 'relationship';
  const emotionSlug = String(formData.get('emotion_slug') ?? '').trim();
  if (!emotionSlug) return { ok: false, error: 'Pick an emotion first.' };

  const isPrivate = formData.get('is_private') === 'on' || formData.get('is_private') === 'true';
  const tags = String(formData.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const result = await execute(
    `INSERT INTO emotion_logs
       (id, couple_id, user_id, about_user_id, scope, emotion_slug, intensity, mood_score, energy,
        trigger_text, need_text, note, tags, is_private, shared_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      context.couple.id,
      user.id,
      scope === 'partner' ? (context.partner?.user_id ?? null) : null,
      scope,
      emotionSlug,
      Number(formData.get('intensity') ?? 5),
      formData.get('mood_score') ? Number(formData.get('mood_score')) : null,
      formData.get('energy') ? Number(formData.get('energy')) : null,
      String(formData.get('trigger') ?? '').trim() || null,
      String(formData.get('need') ?? '').trim() || null,
      String(formData.get('note') ?? '').trim() || null,
      JSON.stringify(tags),
      isPrivate,
      isPrivate ? null : nowSql(),
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not log that emotion.' };

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

  const result = await execute(
    `UPDATE emotion_logs SET acknowledged_by = ?, acknowledged_at = ?
      WHERE id = ? AND couple_id = ?`,
    [space.user.id, nowSql(), emotionId, space.context.couple.id]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not acknowledge.' };
  revalidatePath('/dashboard/emotions');
  return { ok: true, message: 'Acknowledged.' };
}

export async function deleteEmotionAction(emotionId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const result = await execute(
    `DELETE FROM emotion_logs WHERE id = ? AND user_id = ? AND couple_id = ?`,
    [emotionId, space.user.id, space.context.couple.id]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete.' };
  revalidatePath('/dashboard/emotions');
  return { ok: true, message: 'Deleted.' };
}

/* ----------------------------------------------------------------- Check-ins */

export async function saveCheckinAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const result = await execute(
    `INSERT INTO daily_checkins
       (id, couple_id, user_id, checkin_date, day_rating, connection,
        gratitude, highlight, challenge, need_from_partner)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       day_rating        = VALUES(day_rating),
       connection        = VALUES(connection),
       gratitude         = VALUES(gratitude),
       highlight         = VALUES(highlight),
       challenge         = VALUES(challenge),
       need_from_partner = VALUES(need_from_partner)`,
    [
      uuid(),
      context.couple.id,
      user.id,
      String(formData.get('checkin_date') ?? new Date().toISOString().slice(0, 10)),
      Number(formData.get('day_rating') ?? 5),
      Number(formData.get('connection') ?? 5),
      String(formData.get('gratitude') ?? '').trim() || null,
      String(formData.get('highlight') ?? '').trim() || null,
      String(formData.get('challenge') ?? '').trim() || null,
      String(formData.get('need_from_partner') ?? '').trim() || null,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save your check-in.' };

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

/** Confirms a checklist belongs to the caller's space before touching it. */
async function ownsChecklist(checklistId: string, coupleId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM checklists WHERE id = ? AND couple_id = ? LIMIT 1`,
    [checklistId, coupleId]
  );
  return Boolean(row);
}

async function ownsChecklistItem(itemId: string, coupleId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT i.id FROM checklist_items i
       JOIN checklists l ON l.id = i.checklist_id
      WHERE i.id = ? AND l.couple_id = ? LIMIT 1`,
    [itemId, coupleId]
  );
  return Boolean(row);
}

export async function createChecklistAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const limitError = await checkLimit(
    'checklists',
    'checklists',
    context.couple.id,
    ' AND archived_at IS NULL'
  );
  if (limitError) return { ok: false, error: limitError };

  const templateId = String(formData.get('template_id') ?? '') || null;

  let title = String(formData.get('title') ?? '').trim();
  let category = String(formData.get('category') ?? 'relationship');
  let emoji = String(formData.get('emoji') ?? '') || null;
  let items: any[] = [];

  if (templateId) {
    const template = await queryOne<any>(
      `SELECT * FROM checklist_templates WHERE id = ? LIMIT 1`,
      [templateId]
    );
    if (template) {
      title = title || template.name;
      category = template.category;
      emoji = template.emoji;
      items = parseJson<any[]>(template.items, []);
    }
  }

  if (!title) return { ok: false, error: 'Give the checklist a name.' };

  const checklistId = uuid();
  const created = await execute(
    `INSERT INTO checklists
       (id, couple_id, trip_id, template_id, title, category, emoji, description, due_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      checklistId,
      context.couple.id,
      String(formData.get('trip_id') ?? '') || null,
      templateId,
      title,
      category,
      emoji,
      String(formData.get('description') ?? '').trim() || null,
      String(formData.get('due_date') ?? '') || null,
      user.id,
    ]
  );

  if (!created.ok) return { ok: false, error: created.error ?? 'Could not create the checklist.' };

  for (const [index, item] of items.entries()) {
    await execute(
      `INSERT INTO checklist_items (id, checklist_id, title, category, priority, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        checklistId,
        item.name ?? item.title ?? 'Item',
        item.category ?? null,
        item.essential ? 'high' : 'normal',
        index,
      ]
    );
  }

  revalidatePath('/dashboard/checklists');
  return { ok: true, message: 'Checklist created.', data: checklistId };
}

export async function addChecklistItemAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const checklistId = String(formData.get('checklist_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!checklistId || !title) return { ok: false, error: 'Missing item title.' };
  if (!(await ownsChecklist(checklistId, space.context.couple.id))) {
    return { ok: false, error: 'Checklist not found.' };
  }

  const result = await execute(
    `INSERT INTO checklist_items
       (id, checklist_id, title, category, quantity, assigned_to, priority, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      checklistId,
      title,
      String(formData.get('category') ?? '') || null,
      Number(formData.get('quantity') ?? 1),
      String(formData.get('assigned_to') ?? '') || null,
      String(formData.get('priority') ?? 'normal'),
      String(formData.get('due_date') ?? '') || null,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not add the item.' };
  revalidatePath('/dashboard/checklists');
  return { ok: true };
}

export async function toggleChecklistItemAction(
  itemId: string,
  done: boolean
): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  if (!(await ownsChecklistItem(itemId, space.context.couple.id))) {
    return { ok: false, error: 'Item not found.' };
  }

  const result = await execute(
    `UPDATE checklist_items SET is_done = ?, done_by = ?, done_at = ? WHERE id = ?`,
    [done, done ? space.user.id : null, done ? nowSql() : null, itemId]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not update the item.' };
  revalidatePath('/dashboard/checklists');
  return { ok: true };
}

export async function deleteChecklistItemAction(itemId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  if (!(await ownsChecklistItem(itemId, space.context.couple.id))) {
    return { ok: false, error: 'Item not found.' };
  }

  const result = await execute(`DELETE FROM checklist_items WHERE id = ?`, [itemId]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the item.' };
  revalidatePath('/dashboard/checklists');
  return { ok: true };
}

export async function deleteChecklistAction(checklistId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const result = await execute(`DELETE FROM checklists WHERE id = ? AND couple_id = ?`, [
    checklistId,
    space.context.couple.id,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the checklist.' };
  revalidatePath('/dashboard/checklists');
  return { ok: true, message: 'Checklist deleted.' };
}

/* -------------------------------------------------------------------- Gifts */

export async function saveGiftAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const giftId = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { ok: false, error: 'Give the gift a name.' };

  if (!giftId) {
    const limitError = await checkLimit('gifts', 'gifts', context.couple.id);
    if (limitError) return { ok: false, error: limitError };
  }

  const values = [
    String(formData.get('to_user') ?? '') || context.partner?.user_id || null,
    title,
    String(formData.get('description') ?? '').trim() || null,
    String(formData.get('occasion') ?? 'other'),
    String(formData.get('status') ?? 'idea'),
    formData.get('amount') ? Math.round(Number(formData.get('amount')) * 100) : null,
    String(formData.get('currency') ?? context.couple.currency),
    String(formData.get('url') ?? '').trim() || null,
    String(formData.get('store') ?? '').trim() || null,
    String(formData.get('occasion_date') ?? '') || null,
    formData.get('is_surprise') !== 'false',
  ];

  const result = giftId
    ? await execute(
        `UPDATE gifts
            SET to_user = ?, title = ?, description = ?, occasion = ?, status = ?,
                amount_cents = ?, currency = ?, url = ?, store = ?, occasion_date = ?, is_surprise = ?
          WHERE id = ? AND couple_id = ?`,
        [...values, giftId, context.couple.id]
      )
    : await execute(
        `INSERT INTO gifts
           (id, couple_id, from_user, to_user, title, description, occasion, status,
            amount_cents, currency, url, store, occasion_date, is_surprise, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), context.couple.id, user.id, ...values, user.id]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the gift.' };
  revalidatePath('/dashboard/gifts');
  return { ok: true, message: 'Gift saved.' };
}

export async function deleteGiftAction(giftId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const result = await execute(`DELETE FROM gifts WHERE id = ? AND couple_id = ?`, [
    giftId,
    space.context.couple.id,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the gift.' };
  revalidatePath('/dashboard/gifts');
  return { ok: true, message: 'Deleted.' };
}

export async function saveWishlistItemAction(formData: FormData): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };
  const { user, context } = space;

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { ok: false, error: 'Give the item a name.' };

  const result = await execute(
    `INSERT INTO wishlist_items
       (id, couple_id, user_id, title, description, url, price_cents, currency, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      context.couple.id,
      user.id,
      title,
      String(formData.get('description') ?? '').trim() || null,
      String(formData.get('url') ?? '').trim() || null,
      formData.get('price') ? Math.round(Number(formData.get('price')) * 100) : null,
      context.couple.currency,
      String(formData.get('priority') ?? 'normal'),
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the item.' };
  revalidatePath('/dashboard/gifts');
  return { ok: true, message: 'Added to your wishlist.' };
}

/* --------------------------------------------------------------- Messaging */

/**
 * Sends a chat message through the server so the plan's monthly message limit
 * is enforced where it cannot be bypassed. The client polls for new messages,
 * so the partner sees it within a couple of seconds.
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

  const conversation = await queryOne<{ id: string }>(
    `SELECT id FROM conversations WHERE id = ? AND couple_id = ? LIMIT 1`,
    [conversationId, context.couple.id]
  );
  if (!conversation) return { ok: false, error: 'No conversation found.' };

  const limitError = await checkLimit(
    'messages',
    'messages',
    context.couple.id,
    ' AND sender_id = ? AND created_at >= ?',
    [user.id, startOfMonthSql()]
  );
  if (limitError) return { ok: false, error: limitError };

  const messageId = uuid();
  const result = await execute(
    `INSERT INTO messages
       (id, conversation_id, couple_id, sender_id, body, message_type,
        attachment_path, attachment_name, attachment_size, attachment_mime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      messageId,
      conversationId,
      context.couple.id,
      user.id,
      messageType === 'text' ? body : null,
      messageType,
      attachmentPath,
      String(formData.get('attachment_name') ?? '') || null,
      formData.get('attachment_size') ? Number(formData.get('attachment_size')) : null,
      String(formData.get('attachment_mime') ?? '') || null,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not send the message.' };

  await execute(
    `UPDATE conversations SET last_message_at = ?, last_message_preview = ? WHERE id = ?`,
    [nowSql(), (body || 'Photo').slice(0, 120), conversationId]
  );

  const message = await queryOne<any>(`SELECT * FROM messages WHERE id = ? LIMIT 1`, [messageId]);

  return { ok: true, data: message };
}

/** Returns messages newer than the client's newest known id, for polling. */
export async function fetchMessagesAction(
  conversationId: string,
  afterIso: string | null
): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const conversation = await queryOne<{ id: string }>(
    `SELECT id FROM conversations WHERE id = ? AND couple_id = ? LIMIT 1`,
    [conversationId, space.context.couple.id]
  );
  if (!conversation) return { ok: false, error: 'No conversation found.' };

  const rows = afterIso
    ? await query<any>(
        `SELECT * FROM messages
          WHERE conversation_id = ? AND deleted_at IS NULL AND created_at > ?
          ORDER BY created_at ASC LIMIT 200`,
        [conversationId, afterIso.slice(0, 19).replace('T', ' ')]
      )
    : await query<any>(
        `SELECT * FROM messages
          WHERE conversation_id = ? AND deleted_at IS NULL
          ORDER BY created_at ASC LIMIT 200`,
        [conversationId]
      );

  return { ok: true, data: rows };
}

/** Soft-deletes one of the caller's own messages. */
export async function deleteMessageAction(messageId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const result = await execute(
    `UPDATE messages SET deleted_at = ? WHERE id = ? AND sender_id = ? AND couple_id = ?`,
    [nowSql(), messageId, space.user.id, space.context.couple.id]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the message.' };
  return { ok: true };
}

/** Toggles the caller's reaction emoji on a message. */
export async function reactToMessageAction(
  messageId: string,
  emoji: string
): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  const message = await queryOne<{ reactions: unknown }>(
    `SELECT reactions FROM messages WHERE id = ? AND couple_id = ? LIMIT 1`,
    [messageId, space.context.couple.id]
  );
  if (!message) return { ok: false, error: 'Message not found.' };

  const reactions = parseJson<Record<string, string[]>>(message.reactions, {});
  const users = new Set(reactions[emoji] ?? []);

  if (users.has(space.user.id)) users.delete(space.user.id);
  else users.add(space.user.id);

  if (users.size) reactions[emoji] = Array.from(users);
  else delete reactions[emoji];

  const result = await execute(`UPDATE messages SET reactions = ? WHERE id = ?`, [
    JSON.stringify(reactions),
    messageId,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the reaction.' };
  return { ok: true, data: reactions };
}

/** Marks the partner's messages in a conversation as read. */
export async function markConversationReadAction(conversationId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.ok) return { ok: false, error: space.error };

  await execute(
    `UPDATE messages SET read_at = ?
      WHERE conversation_id = ? AND couple_id = ? AND sender_id <> ? AND read_at IS NULL`,
    [nowSql(), conversationId, space.context.couple.id, space.user.id]
  );

  return { ok: true };
}
