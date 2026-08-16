import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mergeLimits } from '@/lib/plans';
import type { CoupleContext, PlanLimits, Profile } from '@/types';

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;
  return { id: user.id, email: user.email ?? (profile as any).email, profile: profile as Profile };
});

export async function requireUser(redirectTo = '/dashboard') {
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(redirectTo)}`);
  if (user.profile.status === 'suspended' || user.profile.status === 'banned') {
    redirect('/account-suspended');
  }
  return user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=%2Fadmin');
  if (user.profile.role !== 'admin' && user.profile.role !== 'superadmin') redirect('/dashboard');
  return user;
}

export function isAdminRole(role?: string | null) {
  return role === 'admin' || role === 'superadmin';
}

/** The active relationship space for the signed-in user (first joined). */
export const getCoupleContext = cache(async (): Promise<CoupleContext | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from('couple_members')
    .select('*, couple:couples(*)')
    .eq('user_id', user.id)
    .is('removed_at', null)
    .order('joined_at', { ascending: true })
    .limit(1);

  const membership = memberships?.[0] as any;
  if (!membership?.couple) return null;

  const { data: members } = await supabase
    .from('couple_members')
    .select('*, profile:profiles(*)')
    .eq('couple_id', membership.couple.id)
    .is('removed_at', null);

  const all = (members ?? []) as any[];
  const me = all.find((m) => m.user_id === user.id) ?? membership;
  const partner = all.find((m) => m.user_id !== user.id) ?? null;

  return { couple: membership.couple, members: all, me, partner };
});

export interface Entitlements {
  planSlug: string;
  planName: string;
  status: string;
  isPaid: boolean;
  interval: string;
  currency: string;
  currentPeriodEnd: string | null;
  limits: PlanLimits;
  features: string[];
}

export const FREE_ENTITLEMENTS: Entitlements = {
  planSlug: 'free',
  planName: 'Starter',
  status: 'active',
  isPaid: false,
  interval: 'month',
  currency: 'USD',
  currentPeriodEnd: null,
  limits: mergeLimits(null),
  features: [],
};

/**
 * Resolves the effective plan for the signed-in user. A paid plan held by
 * either partner covers both members of the space.
 */
export const getEntitlements = cache(async (): Promise<Entitlements> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return FREE_ENTITLEMENTS;

  const { data, error } = await supabase.rpc('active_subscription', { uid: user.id });
  if (error || !data || !Array.isArray(data) || data.length === 0) return FREE_ENTITLEMENTS;

  const row = data[0] as any;
  return {
    planSlug: row.plan_slug,
    planName: row.plan_name,
    status: row.status,
    isPaid: row.plan_slug !== 'free',
    interval: row.interval,
    currency: row.currency,
    currentPeriodEnd: row.current_period_end,
    limits: mergeLimits(row.limits),
    features: Array.isArray(row.features) ? row.features : [],
  };
});
