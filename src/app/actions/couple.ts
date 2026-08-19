'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { execute, query, queryOne, uuid, nowSql, toMysqlDateTime } from '@/lib/db';
import { getSessionUser, getCoupleContext, isAdminRole } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { recordAudit, notifyUser } from '@/lib/audit';
import { SITE_URL } from '@/lib/seo';

export type ActionResult = { ok: true; message?: string; data?: any } | { ok: false; error: string };

function inviteCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}

export async function createCoupleAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM couple_members WHERE user_id = ? AND removed_at IS NULL LIMIT 1`,
    [user.id]
  );
  if (existing) return { ok: false, error: 'You already belong to a relationship space.' };

  const coupleId = uuid();
  const name = String(formData.get('name') ?? '').trim() || 'Our space';
  const relationshipType = String(formData.get('relationship_type') ?? 'romantic');
  const displayRole = String(formData.get('display_role') ?? '').trim() || 'Partner A';
  const anniversary = String(formData.get('anniversary_date') ?? '').trim() || null;

  const created = await execute(
    `INSERT INTO couples (id, name, relationship_type, status, anniversary_date, invite_code, owner_id, currency, timezone)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    [
      coupleId,
      name,
      relationshipType,
      anniversary,
      inviteCode(),
      user.id,
      user.profile.currency,
      user.profile.timezone,
    ]
  );
  if (!created.ok) return { ok: false, error: created.error ?? 'Could not create the space.' };

  await execute(
    `INSERT INTO couple_members (id, couple_id, user_id, member_role, display_role)
     VALUES (?, ?, ?, 'owner', ?)`,
    [uuid(), coupleId, user.id, displayRole]
  );

  await execute(
    `INSERT INTO conversations (id, couple_id, kind, title) VALUES (?, ?, 'direct', 'Private chat')`,
    [uuid(), coupleId]
  );

  await execute(`UPDATE profiles SET onboarded_at = ? WHERE id = ?`, [nowSql(), user.id]);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'couple.create',
    entityType: 'couple',
    entityId: coupleId,
    summary: `Created relationship space "${name}"`,
  });

  revalidatePath('/dashboard');
  return { ok: true, data: coupleId };
}

export async function invitePartnerAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user || !context) return { ok: false, error: 'Create your relationship space first.' };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const displayRole = String(formData.get('display_role') ?? '').trim() || 'Partner B';
  const message = String(formData.get('message') ?? '').trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (email === user.email.toLowerCase()) {
    return { ok: false, error: 'That is your own email address.' };
  }
  if (context.members.filter((member) => !member.removed_at).length >= 2) {
    return { ok: false, error: 'This space already has two members. Remove one first.' };
  }

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const inserted = await execute(
    `INSERT INTO couple_invitations (id, couple_id, email, token, invited_by, display_role, message, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      context.couple.id,
      email,
      token,
      user.id,
      displayRole,
      message || null,
      toMysqlDateTime(expiresAt),
    ]
  );
  if (!inserted.ok) return { ok: false, error: inserted.error ?? 'Could not create the invitation.' };

  const inviteUrl = `${SITE_URL}/invite/${token}`;
  await sendEmail({
    to: email,
    template: 'partner-invite',
    variables: {
      inviter_name: user.profile.full_name ?? user.email,
      invite_url: inviteUrl,
      relationship_type: context.couple.relationship_type,
      message: message || 'Join me on FairCouples so we both track our own side.',
    },
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'couple.invite',
    entityType: 'couple',
    entityId: context.couple.id,
    summary: `Invited ${email}`,
  });

  revalidatePath('/dashboard/partner');
  return { ok: true, message: `Invitation sent to ${email}.`, data: { inviteUrl } };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  const context = await getCoupleContext();
  if (!context) return { ok: false, error: 'No relationship space found.' };

  const result = await execute(
    `UPDATE couple_invitations SET status = 'revoked' WHERE id = ? AND couple_id = ?`,
    [invitationId, context.couple.id]
  );
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not revoke the invitation.' };

  revalidatePath('/dashboard/partner');
  return { ok: true, message: 'Invitation revoked.' };
}

export async function acceptInvitationAction(token: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Sign in to accept this invitation.' };

  const invitation = await queryOne<any>(
    `SELECT * FROM couple_invitations
      WHERE token = ? AND status = 'pending' AND expires_at > NOW() LIMIT 1`,
    [token]
  );
  if (!invitation) return { ok: false, error: 'This invitation is invalid or has expired.' };

  const members = await query<{ user_id: string }>(
    `SELECT user_id FROM couple_members WHERE couple_id = ? AND removed_at IS NULL`,
    [invitation.couple_id]
  );

  if (members.some((member) => member.user_id === user.id)) {
    return { ok: true, message: 'You are already a member of this space.' };
  }
  if (members.length >= 2) {
    return { ok: false, error: 'This relationship space already has two members.' };
  }

  const joined = await execute(
    `INSERT INTO couple_members (id, couple_id, user_id, member_role, display_role)
     VALUES (?, ?, ?, 'partner', ?)
     ON DUPLICATE KEY UPDATE removed_at = NULL, removed_by = NULL`,
    [uuid(), invitation.couple_id, user.id, invitation.display_role ?? 'Partner B']
  );
  if (!joined.ok) return { ok: false, error: joined.error ?? 'Could not join the space.' };

  await execute(
    `UPDATE couple_invitations SET status = 'accepted', accepted_at = ?, accepted_by = ? WHERE id = ?`,
    [nowSql(), user.id, invitation.id]
  );
  await execute(`UPDATE couples SET status = 'active' WHERE id = ?`, [invitation.couple_id]);
  await execute(`UPDATE profiles SET onboarded_at = ? WHERE id = ?`, [nowSql(), user.id]);

  await notifyUser({
    userId: invitation.invited_by,
    coupleId: invitation.couple_id,
    type: 'couple',
    title: `${user.profile.full_name ?? user.email} joined your space`,
    body: 'You can both start logging entries now.',
    link: '/dashboard/fairness',
    emoji: '💗',
  });

  revalidatePath('/dashboard');
  return { ok: true, data: invitation.couple_id, message: 'You are in.' };
}

/**
 * Removes a partner from the space. Available to the space owner and to
 * platform admins. Their access ends immediately.
 */
export async function removePartnerAction(memberUserId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user || !context) return { ok: false, error: 'No relationship space found.' };

  const isOwner = context.couple.owner_id === user.id;
  const isSelf = memberUserId === user.id;

  if (!isOwner && !isSelf) {
    return { ok: false, error: 'Only the space owner can remove the other member.' };
  }
  if (isOwner && isSelf) {
    return {
      ok: false,
      error: 'You own this space. Transfer ownership or delete the space instead.',
    };
  }

  const result = await execute(
    `UPDATE couple_members SET removed_at = ?, removed_by = ? WHERE couple_id = ? AND user_id = ?`,
    [nowSql(), user.id, context.couple.id, memberUserId]
  );
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not remove the member.' };

  const removed = context.members.find((member) => member.user_id === memberUserId);
  if (removed?.profile?.email) {
    await sendEmail({
      to: removed.profile.email,
      template: 'account-removed',
      variables: {
        name: removed.profile.full_name ?? 'there',
        couple_name: context.couple.name ?? 'your shared space',
      },
      userId: memberUserId,
    });
  }

  await notifyUser({
    userId: memberUserId,
    title: 'You were removed from a shared space',
    body: 'Your own private entries are still in your account.',
    emoji: '⚠️',
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'couple.member.remove',
    entityType: 'couple',
    entityId: context.couple.id,
    summary: `Removed member ${memberUserId}`,
  });

  revalidatePath('/dashboard/partner');
  return { ok: true, message: 'Partner removed. Their access ended immediately.' };
}

export async function updateCoupleAction(formData: FormData): Promise<ActionResult> {
  const context = await getCoupleContext();
  if (!context) return { ok: false, error: 'No relationship space found.' };

  const result = await execute(
    `UPDATE couples
        SET name = ?, relationship_type = ?, fairness_weighting = ?, currency = ?, anniversary_date = ?
      WHERE id = ?`,
    [
      String(formData.get('name') ?? '').trim() || null,
      String(formData.get('relationship_type') ?? context.couple.relationship_type),
      String(formData.get('fairness_weighting') ?? 'equal'),
      String(formData.get('currency') ?? context.couple.currency),
      String(formData.get('anniversary_date') ?? '').trim() || null,
      context.couple.id,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };

  revalidatePath('/dashboard/partner');
  return { ok: true, message: 'Space updated.' };
}

export async function updateMemberRoleAction(formData: FormData): Promise<ActionResult> {
  const context = await getCoupleContext();
  if (!context) return { ok: false, error: 'No relationship space found.' };

  const memberId = String(formData.get('member_id') ?? '');
  const incomeShare = formData.get('income_share');

  const result = await execute(
    `UPDATE couple_members SET display_role = ?, income_share = ? WHERE id = ? AND couple_id = ?`,
    [
      String(formData.get('display_role') ?? '').trim() || null,
      incomeShare ? Number(incomeShare) : null,
      memberId,
      context.couple.id,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };

  revalidatePath('/dashboard/partner');
  return { ok: true, message: 'Saved.' };
}

/** Used by the admin panel to remove either member of any space. */
export async function adminRemoveMemberAction(
  coupleId: string,
  memberUserId: string
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.profile.role)) {
    return { ok: false, error: 'Admin access required.' };
  }

  const result = await execute(
    `UPDATE couple_members SET removed_at = ?, removed_by = ? WHERE couple_id = ? AND user_id = ?`,
    [nowSql(), user.id, coupleId, memberUserId]
  );
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not remove the member.' };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.couple.member.remove',
    entityType: 'couple',
    entityId: coupleId,
    summary: `Admin removed member ${memberUserId}`,
  });

  revalidatePath('/admin/couples');
  return { ok: true, message: 'Member removed.' };
}
