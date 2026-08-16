'use server';

import { cookies, headers } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { execute, query, queryOne, uuid, nowSql, toMysqlDateTime } from '@/lib/db';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, signSession } from '@/lib/session';
import { touchLastSeen } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { getAllSettings, settingBool } from '@/lib/settings';
import { recordAudit } from '@/lib/audit';
import { normalizeCurrency } from '@/lib/currency';
import { SITE_URL } from '@/lib/seo';

export type AuthResult =
  | { ok: true; message?: string; requiresVerification?: boolean; redirectTo?: string }
  | { ok: false; error: string; field?: string };

const PASSWORD_RULES = z
  .string()
  .min(8, 'Use at least 8 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Please enter your name').max(120),
  email: z.string().email('Enter a valid email address'),
  password: PASSWORD_RULES,
  country: z.string().min(2).max(10),
  currency: z.string().length(3),
  relationshipType: z.string().max(30).optional(),
  marketing: z.boolean().optional(),
  timezone: z.string().max(64).optional(),
});

function clientIp() {
  const list = headers();
  return (
    list.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    list.get('x-real-ip') ??
    null
  );
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function issueSession(user: { id: string; email: string; role: string }) {
  const sid = uuid();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await execute(
    `INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sid, user.id, clientIp(), headers().get('user-agent'), toMysqlDateTime(expiresAt)]
  );

  const token = await signSession({ sub: user.id, email: user.email, role: user.role, sid });
  cookies().set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return sid;
}

/* --------------------------------------------------------------- Sign up */

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const settings = await getAllSettings();
  if (!settingBool(settings, 'signup_enabled', true)) {
    return { ok: false, error: 'New signups are temporarily paused.' };
  }

  const parsed = signUpSchema.safeParse({
    fullName: String(formData.get('full_name') ?? ''),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: String(formData.get('password') ?? ''),
    country: String(formData.get('country') ?? 'US'),
    currency: String(formData.get('currency') ?? 'USD'),
    relationshipType: String(formData.get('relationship_type') ?? 'romantic'),
    marketing: formData.get('marketing') === 'true',
    timezone: String(formData.get('timezone') ?? 'UTC'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0]) };
  }

  if (formData.get('accept_terms') !== 'true') {
    return { ok: false, error: 'You must accept the terms to continue.', field: 'acceptTerms' };
  }

  const { fullName, email, password, country, currency, marketing, timezone } = parsed.data;

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  if (existing) {
    return { ok: false, error: 'An account already exists with that email.', field: 'email' };
  }

  const userId = uuid();
  const passwordHash = await bcrypt.hash(password, 12);
  const requireVerification = settingBool(settings, 'require_email_verification', true);

  const userInsert = await execute(
    `INSERT INTO users (id, email, password_hash, email_verified_at) VALUES (?, ?, ?, ?)`,
    [userId, email, passwordHash, requireVerification ? null : nowSql()]
  );
  if (!userInsert.ok) return { ok: false, error: userInsert.error ?? 'Could not create your account.' };

  const profileInsert = await execute(
    `INSERT INTO profiles
       (id, email, full_name, display_name, currency, country_code, locale, timezone,
        marketing_opt_in, referral_code, email_verified_at, notification_prefs)
     VALUES (?, ?, ?, ?, ?, ?, 'en', ?, ?, ?, ?, ?)`,
    [
      userId,
      email,
      fullName,
      fullName.split(' ')[0],
      normalizeCurrency(currency),
      country === 'OTHER' ? null : country,
      timezone || 'UTC',
      marketing ? 1 : 0,
      randomBytes(5).toString('hex').toUpperCase(),
      requireVerification ? null : nowSql(),
      JSON.stringify({ email: true, push: true, weekly_report: true, partner_activity: true }),
    ]
  );

  if (!profileInsert.ok) {
    await execute(`DELETE FROM users WHERE id = ?`, [userId]);
    return { ok: false, error: profileInsert.error ?? 'Could not create your profile.' };
  }

  if (marketing) {
    await execute(
      `INSERT INTO newsletter_subscribers (id, email, name, source, status)
       VALUES (?, ?, ?, 'signup', 'subscribed')
       ON DUPLICATE KEY UPDATE status = 'subscribed'`,
      [uuid(), email, fullName]
    );
  }

  await recordAudit({
    actorId: userId,
    actorEmail: email,
    action: 'auth.signup',
    entityType: 'user',
    entityId: userId,
    summary: `New account from ${country}`,
  });

  if (requireVerification) {
    await sendVerificationEmail(userId, email, fullName);
    return {
      ok: true,
      requiresVerification: true,
      message: 'Check your email for the confirmation link.',
    };
  }

  await issueSession({ id: userId, email, role: 'user' });
  await sendEmail({
    to: email,
    template: 'welcome',
    variables: { name: fullName, confirm_url: `${SITE_URL}/dashboard` },
    userId,
  });

  return { ok: true, redirectTo: '/onboarding' };
}

/* --------------------------------------------------------------- Sign in */

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, error: 'Enter your email and password.' };
  }

  const user = await queryOne<any>(
    `SELECT u.id, u.email, u.password_hash, u.email_verified_at,
            p.role, p.status, p.full_name
       FROM users u
       JOIN profiles p ON p.id = u.id
      WHERE u.email = ? AND p.deleted_at IS NULL
      LIMIT 1`,
    [email]
  );

  // Constant-ish work whether or not the account exists, to avoid enumeration.
  const hash = user?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    return { ok: false, error: 'Incorrect email or password.' };
  }

  if (user.status === 'suspended' || user.status === 'banned') {
    return { ok: false, error: 'This account is suspended. Contact support.' };
  }

  const settings = await getAllSettings();
  if (settingBool(settings, 'require_email_verification', true) && !user.email_verified_at) {
    return {
      ok: false,
      error: 'Please confirm your email address first — check your inbox for the link.',
    };
  }

  await issueSession({ id: user.id, email: user.email, role: user.role });
  await touchLastSeen(user.id, clientIp());

  return { ok: true, redirectTo: '/dashboard' };
}

/* -------------------------------------------------------------- Sign out */

export async function signOutAction(): Promise<AuthResult> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    const { verifySession } = await import('@/lib/session');
    const session = await verifySession(token);
    if (session?.sid) {
      await execute(`DELETE FROM sessions WHERE id = ?`, [session.sid]);
    }
  }
  cookies().delete(SESSION_COOKIE);
  return { ok: true, redirectTo: '/signin' };
}

/* --------------------------------------------------- Email verification */

export async function sendVerificationEmail(userId: string, email: string, name?: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await execute(`DELETE FROM auth_tokens WHERE user_id = ? AND kind = 'verify'`, [userId]);
  await execute(
    `INSERT INTO auth_tokens (id, user_id, kind, token_hash, expires_at) VALUES (?, ?, 'verify', ?, ?)`,
    [uuid(), userId, hashToken(token), toMysqlDateTime(expiresAt)]
  );

  await sendEmail({
    to: email,
    template: 'welcome',
    variables: {
      name: name ?? email.split('@')[0],
      confirm_url: `${SITE_URL}/verify-email?token=${token}`,
    },
    userId,
  });
}

export async function verifyEmailAction(token: string): Promise<AuthResult> {
  if (!token) return { ok: false, error: 'Missing confirmation token.' };

  const row = await queryOne<any>(
    `SELECT t.id, t.user_id, u.email, p.role, p.full_name
       FROM auth_tokens t
       JOIN users u ON u.id = t.user_id
       JOIN profiles p ON p.id = t.user_id
      WHERE t.token_hash = ? AND t.kind = 'verify' AND t.used_at IS NULL AND t.expires_at > NOW()
      LIMIT 1`,
    [hashToken(token)]
  );

  if (!row) {
    return { ok: false, error: 'This link is invalid or has expired. Request a new one below.' };
  }

  await execute(`UPDATE users SET email_verified_at = ? WHERE id = ?`, [nowSql(), row.user_id]);
  await execute(`UPDATE profiles SET email_verified_at = ? WHERE id = ?`, [nowSql(), row.user_id]);
  await execute(`UPDATE auth_tokens SET used_at = ? WHERE id = ?`, [nowSql(), row.id]);

  await issueSession({ id: row.user_id, email: row.email, role: row.role });

  return { ok: true, message: 'Email confirmed.', redirectTo: '/onboarding' };
}

export async function resendVerificationAction(email: string): Promise<AuthResult> {
  const clean = email.trim().toLowerCase();
  const row = await queryOne<any>(
    `SELECT u.id, u.email, u.email_verified_at, p.full_name
       FROM users u JOIN profiles p ON p.id = u.id
      WHERE u.email = ? LIMIT 1`,
    [clean]
  );

  // Always report success so the form cannot be used to enumerate accounts.
  if (row && !row.email_verified_at) {
    await sendVerificationEmail(row.id, row.email, row.full_name);
  }

  return { ok: true, message: 'If that address needs confirming, a new link is on its way.' };
}

/* ------------------------------------------------------- Password reset */

export async function requestPasswordResetAction(email: string): Promise<AuthResult> {
  const clean = email.trim().toLowerCase();
  const row = await queryOne<any>(
    `SELECT u.id, u.email, p.full_name FROM users u JOIN profiles p ON p.id = u.id
      WHERE u.email = ? LIMIT 1`,
    [clean]
  );

  if (row) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await execute(`DELETE FROM auth_tokens WHERE user_id = ? AND kind = 'reset'`, [row.id]);
    await execute(
      `INSERT INTO auth_tokens (id, user_id, kind, token_hash, expires_at) VALUES (?, ?, 'reset', ?, ?)`,
      [uuid(), row.id, hashToken(token), toMysqlDateTime(expiresAt)]
    );

    await sendEmail({
      to: row.email,
      template: 'password-reset',
      variables: {
        name: row.full_name ?? 'there',
        reset_url: `${SITE_URL}/reset-password?token=${token}`,
      },
      userId: row.id,
    });
  }

  return {
    ok: true,
    message: 'If an account exists for that address, a reset link is on its way.',
  };
}

export async function resetPasswordAction(
  token: string,
  password: string,
  confirm: string
): Promise<AuthResult> {
  const parsed = PASSWORD_RULES.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (password !== confirm) return { ok: false, error: 'The two passwords do not match.' };

  const row = await queryOne<any>(
    `SELECT t.id, t.user_id FROM auth_tokens t
      WHERE t.token_hash = ? AND t.kind = 'reset' AND t.used_at IS NULL AND t.expires_at > NOW()
      LIMIT 1`,
    [hashToken(token)]
  );

  if (!row) {
    return { ok: false, error: 'This reset link is invalid or has expired.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, row.user_id]);
  await execute(`UPDATE auth_tokens SET used_at = ? WHERE id = ?`, [nowSql(), row.id]);

  // Changing the password ends every other session.
  await execute(`DELETE FROM sessions WHERE user_id = ?`, [row.user_id]);

  await recordAudit({
    actorId: row.user_id,
    action: 'auth.password_reset',
    entityType: 'user',
    entityId: row.user_id,
    summary: 'Password reset completed',
  });

  return { ok: true, message: 'Password updated. Sign in with your new password.' };
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<AuthResult> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const { verifySession } = await import('@/lib/session');
  const session = await verifySession(token);
  if (!session) return { ok: false, error: 'Not signed in.' };

  const parsed = PASSWORD_RULES.safeParse(newPassword);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const row = await queryOne<any>(`SELECT password_hash FROM users WHERE id = ? LIMIT 1`, [
    session.sub,
  ]);
  if (!row) return { ok: false, error: 'Account not found.' };

  const valid = await bcrypt.compare(currentPassword, row.password_hash ?? '');
  if (!valid) return { ok: false, error: 'Your current password is incorrect.' };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, session.sub]);
  await execute(`DELETE FROM sessions WHERE user_id = ? AND id <> ?`, [session.sub, session.sid]);

  return { ok: true, message: 'Password updated. Other devices have been signed out.' };
}

/** Housekeeping used by the cron endpoint. */
export async function purgeExpiredAuthRows() {
  await execute(`DELETE FROM sessions WHERE expires_at < NOW()`);
  await execute(`DELETE FROM auth_tokens WHERE expires_at < NOW()`);
  const rows = await query<{ total: number }>(`SELECT ROW_COUNT() AS total`);
  return rows[0]?.total ?? 0;
}
