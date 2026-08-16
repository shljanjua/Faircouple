import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { query, queryOne, parseJson, toBool, nowSql, execute } from '@/lib/db';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { mergeLimits } from '@/lib/plans';
import type { CoupleContext, CoupleMember, PlanLimits, Profile } from '@/types';

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    phone: row.phone,
    bio: row.bio,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    role: row.role,
    status: row.status,
    currency: row.currency,
    country_code: row.country_code,
    locale: row.locale,
    timezone: row.timezone,
    marketing_opt_in: toBool(row.marketing_opt_in),
    email_verified_at: row.email_verified_at,
    onboarded_at: row.onboarded_at,
    last_seen_at: row.last_seen_at,
    login_count: Number(row.login_count ?? 0),
    referral_code: row.referral_code,
    suspended_reason: row.suspended_reason,
    notification_prefs: parseJson(row.notification_prefs, {
      email: true,
      push: true,
      weekly_report: true,
      partner_activity: true,
    }),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** The signed-in user, resolved from the session cookie. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  const row = await queryOne<any>(
    `SELECT * FROM profiles WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [session.sub]
  );
  if (!row) return null;

  return { id: row.id, email: row.email, profile: mapProfile(row) };
});

export async function requireUser(redirectTo = '/dashboard'): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(redirectTo)}`);
  if (user.profile.status === 'suspended' || user.profile.status === 'banned') {
    redirect('/account-suspended');
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=%2Fadmin');
  if (!isAdminRole(user.profile.role)) redirect('/dashboard');
  return user;
}

export function isAdminRole(role?: string | null) {
  return role === 'admin' || role === 'superadmin';
}

/** Records a login timestamp without blocking the request. */
export async function touchLastSeen(userId: string, ip?: string | null) {
  await execute(
    `UPDATE profiles SET last_seen_at = ?, last_login_ip = ?, login_count = login_count + 1 WHERE id = ?`,
    [nowSql(), ip ?? null, userId]
  );
}

/* ------------------------------------------------------------------ Couples */

function mapMember(row: any): CoupleMember {
  return {
    id: row.member_id ?? row.id,
    couple_id: row.couple_id,
    user_id: row.user_id,
    member_role: row.member_role,
    display_role: row.display_role,
    color: row.color,
    income_share: row.income_share === null ? null : Number(row.income_share),
    joined_at: row.joined_at,
    removed_at: row.removed_at,
    profile: row.email ? mapProfile(row) : undefined,
  };
}

/**
 * The active relationship space for the signed-in user, with both members.
 * MySQL has no row-level security, so every downstream query is scoped by the
 * couple id returned here.
 */
export const getCoupleContext = cache(async (): Promise<CoupleContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const couple = await queryOne<any>(
    `SELECT c.*
       FROM couples c
       JOIN couple_members m ON m.couple_id = c.id
      WHERE m.user_id = ? AND m.removed_at IS NULL
      ORDER BY m.joined_at ASC
      LIMIT 1`,
    [user.id]
  );
  if (!couple) return null;

  const rows = await query<any>(
    `SELECT m.id AS member_id, m.couple_id, m.user_id, m.member_role, m.display_role,
            m.color, m.income_share, m.joined_at, m.removed_at, p.*
       FROM couple_members m
       JOIN profiles p ON p.id = m.user_id
      WHERE m.couple_id = ? AND m.removed_at IS NULL
      ORDER BY m.joined_at ASC`,
    [couple.id]
  );

  const members = rows.map(mapMember);
  const me = members.find((member) => member.user_id === user.id) ?? members[0];
  const partner = members.find((member) => member.user_id !== user.id) ?? null;

  return {
    couple: {
      id: couple.id,
      name: couple.name,
      relationship_type: couple.relationship_type,
      status: couple.status,
      anniversary_date: couple.anniversary_date,
      invite_code: couple.invite_code,
      owner_id: couple.owner_id,
      timezone: couple.timezone,
      currency: couple.currency,
      avatar_url: couple.avatar_url,
      fairness_weighting: couple.fairness_weighting,
      settings: parseJson(couple.settings, {}),
      created_at: couple.created_at,
    },
    members,
    me,
    partner,
  };
});

/** Confirms a user belongs to a couple — the MySQL stand-in for RLS. */
export async function assertCoupleMember(coupleId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM couple_members WHERE couple_id = ? AND user_id = ? AND removed_at IS NULL LIMIT 1`,
    [coupleId, userId]
  );
  return Boolean(row);
}

/* ------------------------------------------------------------- Entitlements */

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
 * The effective plan for the signed-in user. A paid plan held by either
 * partner covers both members of the space.
 */
export const getEntitlements = cache(async (): Promise<Entitlements> => {
  const user = await getSessionUser();
  if (!user) return FREE_ENTITLEMENTS;

  const row = await queryOne<any>(
    `SELECT s.id, s.status, s.billing_interval, s.currency, s.current_period_end,
            p.slug, p.name, p.limits, p.features, p.tier
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.status IN ('active','trialing')
        AND (
          s.user_id = ?
          OR s.couple_id IN (
            SELECT couple_id FROM couple_members WHERE user_id = ? AND removed_at IS NULL
          )
        )
      ORDER BY p.tier DESC, s.current_period_end DESC
      LIMIT 1`,
    [user.id, user.id]
  );

  if (!row) return FREE_ENTITLEMENTS;

  return {
    planSlug: row.slug,
    planName: row.name,
    status: row.status,
    isPaid: row.slug !== 'free',
    interval: row.billing_interval,
    currency: row.currency,
    currentPeriodEnd: row.current_period_end,
    limits: mergeLimits(parseJson(row.limits, null)),
    features: parseJson(row.features, [] as string[]),
  };
});
