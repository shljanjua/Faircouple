'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import type { ActionResult } from '@/app/actions/couple';

/** Joins a space using its short invite code (an alternative to an email token). */
export async function joinByCodeAction(code: string, displayRole: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Sign in first.' };

  const supabase = createClient();
  const { data: couple } = await supabase
    .from('couples')
    .select('id, name')
    .eq('invite_code', code.toUpperCase())
    .maybeSingle();

  if (!couple) return { ok: false, error: 'That code does not match any space.' };

  const { data: members } = await supabase
    .from('couple_members')
    .select('user_id')
    .eq('couple_id', (couple as any).id)
    .is('removed_at', null);

  const list = (members ?? []) as any[];
  if (list.some((member) => member.user_id === user.id)) {
    return { ok: true, message: 'You are already a member of this space.' };
  }
  if (list.length >= 2) {
    return { ok: false, error: 'This space already has two members.' };
  }

  const { error } = await supabase.from('couple_members').insert({
    couple_id: (couple as any).id,
    user_id: user.id,
    member_role: 'partner',
    display_role: displayRole || 'Partner B',
  });

  if (error) return { ok: false, error: error.message };

  await supabase.from('couples').update({ status: 'active' }).eq('id', (couple as any).id);
  await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'couple.join',
    entityType: 'couple',
    entityId: (couple as any).id,
    summary: 'Joined via invite code',
  });

  revalidatePath('/dashboard');
  return { ok: true, message: 'You are in.' };
}
