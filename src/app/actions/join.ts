'use server';

import { revalidatePath } from 'next/cache';
import { execute, query, queryOne, uuid, nowSql } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import type { ActionResult } from '@/app/actions/couple';

/** Joins a space using its short invite code (an alternative to an email token). */
export async function joinByCodeAction(code: string, displayRole: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Sign in first.' };

  const couple = await queryOne<{ id: string; name: string | null }>(
    `SELECT id, name FROM couples WHERE invite_code = ? LIMIT 1`,
    [code.toUpperCase()]
  );
  if (!couple) return { ok: false, error: 'That code does not match any space.' };

  const members = await query<{ user_id: string }>(
    `SELECT user_id FROM couple_members WHERE couple_id = ? AND removed_at IS NULL`,
    [couple.id]
  );

  if (members.some((member) => member.user_id === user.id)) {
    return { ok: true, message: 'You are already a member of this space.' };
  }
  if (members.length >= 2) {
    return { ok: false, error: 'This space already has two members.' };
  }

  const joined = await execute(
    `INSERT INTO couple_members (id, couple_id, user_id, member_role, display_role)
     VALUES (?, ?, ?, 'partner', ?)
     ON DUPLICATE KEY UPDATE removed_at = NULL, removed_by = NULL, display_role = VALUES(display_role)`,
    [uuid(), couple.id, user.id, displayRole || 'Partner B']
  );
  if (!joined.ok) return { ok: false, error: joined.error ?? 'Could not join the space.' };

  await execute(`UPDATE couples SET status = 'active' WHERE id = ?`, [couple.id]);
  await execute(`UPDATE profiles SET onboarded_at = ? WHERE id = ?`, [nowSql(), user.id]);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'couple.join',
    entityType: 'couple',
    entityId: couple.id,
    summary: 'Joined via invite code',
  });

  revalidatePath('/dashboard');
  return { ok: true, message: 'You are in.' };
}
