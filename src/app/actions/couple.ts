'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { recordAudit, notifyUser } from '@/lib/audit';
import { SITE_URL } from '@/lib/seo';

export type ActionResult = { ok: true; message?: string; data?: any } | { ok: false; error: string };

export async function createCoupleAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const name = String(formData.get('name') ?? '').trim() || 'Our space';
  const relationshipType = String(formData.get('relationship_type') ?? 'romantic');
  const displayRole = String(formData.get('display_role') ?? '').trim() || null;
  const anniversary = String(formData.get('anniversary_date') ?? '').trim();

  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_couple', {
    p_name: name,
    p_relationship_type: relationshipType,
    p_display_role: displayRole,
  });

  if (error) return { ok: false, error: error.message };

  if (anniversary) {
    await supabase.from('couples').update({ anniversary_date: anniversary }).eq('id', data);
  }

  await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'couple.create',
    entityType: 'couple',
    entityId: String(data),
    summary: `Created relationship space "${name}"`,
  });

  revalidatePath('/dashboard');
  return { ok: true, data };
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

  const activeMembers = context.members.filter((m) => !m.removed_at);
  if (activeMembers.length >= 2) {
    return { ok: false, error: 'This space already has two members. Remove one first.' };
  }

  const supabase = createClient();
  const token = randomBytes(24).toString('hex');

  const { error } = await supabase.from('couple_invitations').insert({
    couple_id: context.couple.id,
    email,
    token,
    invited_by: user.id,
    display_role: displayRole,
    message: message || null,
  });

  if (error) return { ok: false, error: error.message };

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
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('couple_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/partner');
  return { ok: true, message: 'Invitation revoked.' };
}

export async function acceptInvitationAction(token: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Sign in to accept this invitation.' };

  const supabase = createClient();
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) return { ok: false, error: error.message };

  await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id);

  revalidatePath('/dashboard');
  return { ok: true, data, message: 'You are in. Both of you can now log entries.' };
}

/**
 * Removes a partner from the space. Available to the space owner and to
 * platform admins (Admin → Members). Their access ends immediately.
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

  const supabase = createClient();
  const { error } = await supabase
    .from('couple_members')
    .update({ removed_at: new Date().toISOString(), removed_by: user.id })
    .eq('couple_id', context.couple.id)
    .eq('user_id', memberUserId);

  if (error) return { ok: false, error: error.message };

  const removed = context.members.find((m) => m.user_id === memberUserId);
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

  const payload: Record<string, unknown> = {
    name: String(formData.get('name') ?? '').trim() || null,
    relationship_type: String(formData.get('relationship_type') ?? context.couple.relationship_type),
    fairness_weighting: String(formData.get('fairness_weighting') ?? 'equal'),
    currency: String(formData.get('currency') ?? context.couple.currency),
  };

  const anniversary = String(formData.get('anniversary_date') ?? '').trim();
  payload.anniversary_date = anniversary || null;

  const supabase = createClient();
  const { error } = await supabase.from('couples').update(payload).eq('id', context.couple.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/partner');
  return { ok: true, message: 'Space updated.' };
}

export async function updateMemberRoleAction(formData: FormData): Promise<ActionResult> {
  const context = await getCoupleContext();
  if (!context) return { ok: false, error: 'No relationship space found.' };

  const memberId = String(formData.get('member_id') ?? '');
  const displayRole = String(formData.get('display_role') ?? '').trim();
  const incomeShare = formData.get('income_share');

  const supabase = createClient();
  const { error } = await supabase
    .from('couple_members')
    .update({
      display_role: displayRole || null,
      income_share: incomeShare ? Number(incomeShare) : null,
    })
    .eq('id', memberId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/partner');
  return { ok: true, message: 'Saved.' };
}

/** Used by the admin panel — bypasses RLS after verifying the caller's role. */
export async function adminRemoveMemberAction(
  coupleId: string,
  memberUserId: string
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || (user.profile.role !== 'admin' && user.profile.role !== 'superadmin')) {
    return { ok: false, error: 'Admin access required.' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('couple_members')
    .update({ removed_at: new Date().toISOString(), removed_by: user.id })
    .eq('couple_id', coupleId)
    .eq('user_id', memberUserId);

  if (error) return { ok: false, error: error.message };

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
