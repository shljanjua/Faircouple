'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { execute, query, queryOne, uuid, nowSql, toMysqlDateTime, parseJson } from '@/lib/db';
import { getSessionUser, isAdminRole } from '@/lib/auth';
import { setSettings } from '@/lib/settings';
import { recordAudit } from '@/lib/audit';
import { sendEmail, verifySmtp } from '@/lib/email';
import { slugify } from '@/lib/utils';
import { SITE_URL } from '@/lib/seo';
import type { ActionResult } from '@/app/actions/couple';

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.profile.role)) return null;
  return user;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function parseValue(raw: string): any {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return raw;
}

function csv(formData: FormData, key: string) {
  return String(formData.get(key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ Settings */

export async function saveSettingsAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const values: Record<string, any> = {};
  formData.forEach((value, key) => {
    if (key.startsWith('setting:')) {
      values[key.replace('setting:', '')] = parseValue(String(value));
    }
  });

  // Unchecked checkboxes never submit — coerce declared booleans back to false.
  const booleanKeys = String(formData.get('__booleans') ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  for (const key of booleanKeys) {
    if (!(key in values)) values[key] = false;
  }

  if (!Object.keys(values).length) return { ok: false, error: 'Nothing to save.' };

  try {
    await setSettings(values, user.id);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Save failed.' };
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.settings.update',
    entityType: 'site_settings',
    summary: `Updated ${Object.keys(values).length} settings`,
    changes: values,
  });

  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Settings saved.' };
}

/* ------------------------------------------------------------------ Gateways */

export async function savePaymentGatewayAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const provider = String(formData.get('provider') ?? '');
  if (!['stripe', 'paypal', 'manual'].includes(provider)) {
    return { ok: false, error: 'Unknown provider.' };
  }

  const credentials: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (key.startsWith('cred:')) {
      const name = key.replace('cred:', '');
      const stringValue = String(value);
      // Empty inputs mean "leave unchanged" so masked secrets are not wiped.
      if (stringValue.trim()) credentials[name] = stringValue.trim();
    }
  });

  const existing = await queryOne<{ credentials: unknown }>(
    `SELECT credentials FROM payment_gateways WHERE provider = ? LIMIT 1`,
    [provider]
  );

  const merged = {
    ...parseJson<Record<string, string>>(existing?.credentials, {}),
    ...credentials,
  };

  const result = await execute(
    `INSERT INTO payment_gateways (id, provider, display_name, is_enabled, mode, credentials, instructions)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       is_enabled   = VALUES(is_enabled),
       mode         = VALUES(mode),
       credentials  = VALUES(credentials),
       instructions = VALUES(instructions)`,
    [
      uuid(),
      provider,
      String(formData.get('display_name') ?? provider),
      formData.get('is_enabled') === 'on',
      String(formData.get('mode') ?? 'test'),
      JSON.stringify(merged),
      String(formData.get('instructions') ?? '') || null,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the gateway.' };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.gateway.update',
    entityType: 'payment_gateway',
    entityId: provider,
    summary: `Updated ${provider} gateway`,
  });

  revalidatePath('/admin/payments');
  return { ok: true, message: `${provider} settings saved.` };
}

/* --------------------------------------------------------------------- Users */

export async function updateUserAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? 'user');
  const status = String(formData.get('status') ?? 'active');

  if (role === 'superadmin' && user.profile.role !== 'superadmin') {
    return { ok: false, error: 'Only a superadmin can grant superadmin.' };
  }
  if (userId === user.id && role !== user.profile.role) {
    return { ok: false, error: 'You cannot change your own role.' };
  }

  const target = await queryOne<{ role: string }>(`SELECT role FROM profiles WHERE id = ? LIMIT 1`, [
    userId,
  ]);
  if (target?.role === 'superadmin' && user.profile.role !== 'superadmin') {
    return { ok: false, error: 'Only a superadmin can change a superadmin.' };
  }

  const result = await execute(
    `UPDATE profiles SET role = ?, status = ?, suspended_reason = ? WHERE id = ?`,
    [role, status, String(formData.get('suspended_reason') ?? '') || null, userId]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not update the user.' };

  // A suspended or banned account loses every active session immediately.
  if (status === 'suspended' || status === 'banned') {
    await execute(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.user.update',
    entityType: 'profile',
    entityId: userId,
    summary: `Set role=${role}, status=${status}`,
  });

  revalidatePath('/admin/users');
  return { ok: true, message: 'User updated.' };
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };
  if (userId === user.id) return { ok: false, error: 'You cannot delete your own account here.' };

  const target = await queryOne<{ role: string; email: string }>(
    `SELECT role, email FROM profiles WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (!target) return { ok: false, error: 'User not found.' };
  if (target.role === 'superadmin' && user.profile.role !== 'superadmin') {
    return { ok: false, error: 'Only a superadmin can delete a superadmin.' };
  }

  // `users` cascades into profiles and every couple-scoped table.
  const result = await execute(`DELETE FROM users WHERE id = ?`, [userId]);
  if (!result.ok) {
    await execute(`UPDATE profiles SET status = 'pending_deletion', deleted_at = ? WHERE id = ?`, [
      nowSql(),
      userId,
    ]);
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.user.delete',
    entityType: 'profile',
    entityId: userId,
    summary: `Deleted ${target.email}`,
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin/couples');
  return { ok: true, message: 'User deleted.' };
}

/**
 * Issues a single-use password-reset link an admin can hand to a member who
 * cannot receive email. It never signs the admin in as the user, and its use is
 * recorded in the audit log.
 */
export async function impersonationLinkAction(userId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const profile = await queryOne<{ email: string; role: string }>(
    `SELECT email, role FROM profiles WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (!profile) return { ok: false, error: 'User not found.' };
  if (profile.role === 'superadmin' && user.profile.role !== 'superadmin') {
    return { ok: false, error: 'Only a superadmin can do this for a superadmin.' };
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await execute(`DELETE FROM auth_tokens WHERE user_id = ? AND kind = 'reset'`, [userId]);
  const created = await execute(
    `INSERT INTO auth_tokens (id, user_id, kind, token_hash, expires_at) VALUES (?, ?, 'reset', ?, ?)`,
    [uuid(), userId, hashToken(token), toMysqlDateTime(expiresAt)]
  );
  if (!created.ok) return { ok: false, error: created.error ?? 'Could not create the link.' };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.user.reset_link',
    entityType: 'profile',
    entityId: userId,
    summary: `Generated a one-hour password reset link for ${profile.email}`,
  });

  return { ok: true, data: `${SITE_URL}/reset-password?token=${token}` };
}

/** Sets a member's password directly, for support requests. */
export async function adminSetPasswordAction(
  userId: string,
  newPassword: string
): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };
  if (newPassword.length < 8) return { ok: false, error: 'Use at least 8 characters.' };

  const profile = await queryOne<{ email: string; role: string }>(
    `SELECT email, role FROM profiles WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (!profile) return { ok: false, error: 'User not found.' };
  if (profile.role === 'superadmin' && user.profile.role !== 'superadmin') {
    return { ok: false, error: 'Only a superadmin can do this for a superadmin.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const result = await execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [
    passwordHash,
    userId,
  ]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not set the password.' };

  await execute(`DELETE FROM sessions WHERE user_id = ?`, [userId]);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.user.password_set',
    entityType: 'profile',
    entityId: userId,
    summary: `Reset the password for ${profile.email}`,
  });

  return { ok: true, message: 'Password set. Every session for that account was signed out.' };
}

/* ---------------------------------------------------------------- Plans */

export async function savePlanAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const features = String(formData.get('features') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let limits: Record<string, unknown> = {};
  try {
    limits = JSON.parse(String(formData.get('limits') ?? '{}'));
  } catch {
    return { ok: false, error: 'Limits must be valid JSON.' };
  }

  const slug = slugify(String(formData.get('slug') ?? ''));
  const name = String(formData.get('name') ?? '').trim();
  if (!slug || !name) return { ok: false, error: 'Slug and name are required.' };

  const values = [
    slug,
    name,
    String(formData.get('tagline') ?? '').trim() || null,
    String(formData.get('description') ?? '').trim() || null,
    Number(formData.get('tier') ?? 0),
    formData.get('is_active') === 'on',
    formData.get('is_featured') === 'on',
    formData.get('is_free') === 'on',
    Number(formData.get('trial_days') ?? 0),
    Number(formData.get('sort_order') ?? 0),
    String(formData.get('badge') ?? '').trim() || null,
    JSON.stringify(features),
    JSON.stringify(limits),
  ];

  const result = id
    ? await execute(
        `UPDATE plans
            SET slug = ?, name = ?, tagline = ?, description = ?, tier = ?, is_active = ?,
                is_featured = ?, is_free = ?, trial_days = ?, sort_order = ?, badge = ?,
                features = ?, limits = ?
          WHERE id = ?`,
        [...values, id]
      )
    : await execute(
        `INSERT INTO plans
           (id, slug, name, tagline, description, tier, is_active, is_featured, is_free,
            trial_days, sort_order, badge, features, limits)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ...values]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the plan.' };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: id ? 'admin.plan.update' : 'admin.plan.create',
    entityType: 'plan',
    entityId: id || slug,
    summary: `Saved plan ${name}`,
  });

  revalidatePath('/admin/plans');
  revalidatePath('/pricing');
  return { ok: true, message: 'Plan saved.' };
}

export async function savePlanPriceAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const planId = String(formData.get('plan_id') ?? '');
  if (!planId) return { ok: false, error: 'Missing plan.' };

  const result = await execute(
    `INSERT INTO plan_prices
       (id, plan_id, currency, billing_interval, amount_cents, compare_at_cents,
        stripe_price_id, paypal_plan_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       amount_cents     = VALUES(amount_cents),
       compare_at_cents = VALUES(compare_at_cents),
       stripe_price_id  = VALUES(stripe_price_id),
       paypal_plan_id   = VALUES(paypal_plan_id),
       is_active        = VALUES(is_active)`,
    [
      uuid(),
      planId,
      String(formData.get('currency') ?? 'USD').toUpperCase(),
      String(formData.get('interval') ?? 'month'),
      Math.round(Number(formData.get('amount') ?? 0) * 100),
      formData.get('compare_at') ? Math.round(Number(formData.get('compare_at')) * 100) : null,
      String(formData.get('stripe_price_id') ?? '').trim() || null,
      String(formData.get('paypal_plan_id') ?? '').trim() || null,
      formData.get('is_active') !== 'off',
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the price.' };

  revalidatePath('/admin/plans');
  revalidatePath('/pricing');
  return { ok: true, message: 'Price saved.' };
}

export async function deletePlanAction(planId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM subscriptions
      WHERE plan_id = ? AND status IN ('active','trialing')`,
    [planId]
  );

  const count = Number(row?.total ?? 0);
  if (count > 0) {
    return {
      ok: false,
      error: `${count} active subscription(s) use this plan. Deactivate it instead of deleting.`,
    };
  }

  const result = await execute(`DELETE FROM plans WHERE id = ?`, [planId]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the plan.' };

  revalidatePath('/admin/plans');
  revalidatePath('/pricing');
  return { ok: true, message: 'Plan deleted.' };
}

/* --------------------------------------------------------------- Coupons */

export async function saveCouponAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const code = String(formData.get('code') ?? '')
    .trim()
    .toUpperCase();
  if (!code) return { ok: false, error: 'A coupon code is required.' };

  const result = await execute(
    `INSERT INTO coupons
       (id, code, description, discount_type, percent_off, amount_off_cents, currency,
        duration, max_redemptions, expires_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       description      = VALUES(description),
       discount_type    = VALUES(discount_type),
       percent_off      = VALUES(percent_off),
       amount_off_cents = VALUES(amount_off_cents),
       currency         = VALUES(currency),
       duration         = VALUES(duration),
       max_redemptions  = VALUES(max_redemptions),
       expires_at       = VALUES(expires_at),
       is_active        = VALUES(is_active)`,
    [
      uuid(),
      code,
      String(formData.get('description') ?? '').trim() || null,
      String(formData.get('discount_type') ?? 'percent'),
      formData.get('percent_off') ? Number(formData.get('percent_off')) : null,
      formData.get('amount_off') ? Math.round(Number(formData.get('amount_off')) * 100) : null,
      String(formData.get('currency') ?? '') || null,
      String(formData.get('duration') ?? 'once'),
      formData.get('max_redemptions') ? Number(formData.get('max_redemptions')) : null,
      toMysqlDateTime(String(formData.get('expires_at') ?? '') || null),
      formData.get('is_active') === 'on',
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the coupon.' };

  revalidatePath('/admin/coupons');
  return { ok: true, message: 'Coupon saved.' };
}

export async function deleteCouponAction(couponId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const result = await execute(`DELETE FROM coupons WHERE id = ?`, [couponId]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the coupon.' };
  revalidatePath('/admin/coupons');
  return { ok: true, message: 'Coupon deleted.' };
}

/* ------------------------------------------------------------------ Content */

export async function saveBlogPostAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const slug = slugify(String(formData.get('slug') ?? '') || title);
  const status = String(formData.get('status') ?? 'draft');

  if (!title || !slug) return { ok: false, error: 'Title and slug are required.' };

  const publishedAt =
    status === 'published'
      ? (toMysqlDateTime(String(formData.get('published_at') ?? '') || null) ?? nowSql())
      : null;

  const values = [
    slug,
    title,
    String(formData.get('excerpt') ?? '').trim() || null,
    String(formData.get('content') ?? ''),
    String(formData.get('cover_image') ?? '').trim() || null,
    String(formData.get('category_id') ?? '') || null,
    user.id,
    String(formData.get('author_name') ?? 'FairCouples Team'),
    status,
    formData.get('is_featured') === 'on',
    Number(formData.get('reading_minutes') ?? 5),
    JSON.stringify(csv(formData, 'tags')),
    JSON.stringify(csv(formData, 'keywords')),
    String(formData.get('meta_title') ?? '').trim() || null,
    String(formData.get('meta_description') ?? '').trim() || null,
    String(formData.get('canonical_url') ?? '').trim() || null,
    String(formData.get('og_image') ?? '').trim() || null,
    formData.get('no_index') === 'on',
    publishedAt,
  ];

  const result = id
    ? await execute(
        `UPDATE blog_posts
            SET slug = ?, title = ?, excerpt = ?, content = ?, cover_image = ?, category_id = ?,
                author_id = ?, author_name = ?, status = ?, is_featured = ?, reading_minutes = ?,
                tags = ?, keywords = ?, meta_title = ?, meta_description = ?, canonical_url = ?,
                og_image = ?, no_index = ?, published_at = ?
          WHERE id = ?`,
        [...values, id]
      )
    : await execute(
        `INSERT INTO blog_posts
           (id, slug, title, excerpt, content, cover_image, category_id, author_id, author_name,
            status, is_featured, reading_minutes, tags, keywords, meta_title, meta_description,
            canonical_url, og_image, no_index, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ...values]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the post.' };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: id ? 'admin.post.update' : 'admin.post.create',
    entityType: 'blog_post',
    entityId: slug,
    summary: `Saved post "${title}"`,
  });

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  revalidatePath('/sitemap.xml');
  return { ok: true, message: 'Post saved.' };
}

export async function deleteBlogPostAction(postId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const result = await execute(`DELETE FROM blog_posts WHERE id = ?`, [postId]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the post.' };

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  return { ok: true, message: 'Post deleted.' };
}

export async function savePageAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const slug = slugify(String(formData.get('slug') ?? '') || title);

  if (!title || !slug) return { ok: false, error: 'Title and slug are required.' };

  const values = [
    slug,
    title,
    String(formData.get('content') ?? ''),
    String(formData.get('page_type') ?? 'legal'),
    String(formData.get('status') ?? 'published'),
    formData.get('show_in_footer') === 'on',
    formData.get('show_in_header') === 'on',
    String(formData.get('meta_title') ?? '').trim() || null,
    String(formData.get('meta_description') ?? '').trim() || null,
    JSON.stringify(csv(formData, 'keywords')),
    formData.get('no_index') === 'on',
    Number(formData.get('sort_order') ?? 0),
  ];

  const result = id
    ? await execute(
        `UPDATE pages
            SET slug = ?, title = ?, content = ?, page_type = ?, status = ?, show_in_footer = ?,
                show_in_header = ?, meta_title = ?, meta_description = ?, keywords = ?,
                no_index = ?, sort_order = ?
          WHERE id = ?`,
        [...values, id]
      )
    : await execute(
        `INSERT INTO pages
           (id, slug, title, content, page_type, status, show_in_footer, show_in_header,
            meta_title, meta_description, keywords, no_index, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ...values]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the page.' };

  revalidatePath('/admin/pages');
  revalidatePath(`/${slug}`);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Page saved.' };
}

export async function deletePageAction(pageId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const result = await execute(`DELETE FROM pages WHERE id = ?`, [pageId]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the page.' };
  revalidatePath('/admin/pages');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Page deleted.' };
}

/* ---------------------------------------------------------------------- SEO */

export async function saveSeoMetaAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const path = String(formData.get('path') ?? '').trim();
  if (!path.startsWith('/')) return { ok: false, error: 'Path must start with /' };

  const result = await execute(
    `INSERT INTO seo_meta
       (id, path, title, description, keywords, og_image, canonical_url, robots, priority, changefreq)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title         = VALUES(title),
       description   = VALUES(description),
       keywords      = VALUES(keywords),
       og_image      = VALUES(og_image),
       canonical_url = VALUES(canonical_url),
       robots        = VALUES(robots),
       priority      = VALUES(priority),
       changefreq    = VALUES(changefreq)`,
    [
      uuid(),
      path,
      String(formData.get('title') ?? '').trim() || null,
      String(formData.get('description') ?? '').trim() || null,
      JSON.stringify(csv(formData, 'keywords')),
      String(formData.get('og_image') ?? '').trim() || null,
      String(formData.get('canonical_url') ?? '').trim() || null,
      String(formData.get('robots') ?? 'index,follow'),
      Number(formData.get('priority') ?? 0.7),
      String(formData.get('changefreq') ?? 'weekly'),
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the metadata.' };

  revalidatePath('/admin/seo');
  revalidatePath(path);
  return { ok: true, message: 'SEO metadata saved.' };
}

export async function saveRedirectAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const source = String(formData.get('source') ?? '').trim();
  const destination = String(formData.get('destination') ?? '').trim();

  if (!source.startsWith('/') || !destination) {
    return { ok: false, error: 'Source must start with / and destination is required.' };
  }

  const result = await execute(
    `INSERT INTO redirects (id, source, destination, status_code, is_active)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       destination = VALUES(destination),
       status_code = VALUES(status_code),
       is_active   = VALUES(is_active)`,
    [
      uuid(),
      source,
      destination,
      Number(formData.get('status_code') ?? 301),
      formData.get('is_active') !== 'off',
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the redirect.' };

  revalidatePath('/admin/seo');
  return { ok: true, message: 'Redirect saved.' };
}

export async function deleteRedirectAction(redirectId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const result = await execute(`DELETE FROM redirects WHERE id = ?`, [redirectId]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not remove the redirect.' };
  revalidatePath('/admin/seo');
  return { ok: true, message: 'Redirect removed.' };
}

/* -------------------------------------------------------------------- Email */

export async function saveEmailTemplateAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) return { ok: false, error: 'Missing template slug.' };

  const result = await execute(
    `UPDATE email_templates
        SET name = ?, subject = ?, html_body = ?, text_body = ?, is_active = ?
      WHERE slug = ?`,
    [
      String(formData.get('name') ?? slug),
      String(formData.get('subject') ?? ''),
      String(formData.get('html_body') ?? ''),
      String(formData.get('text_body') ?? '') || null,
      formData.get('is_active') === 'on',
      slug,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the template.' };

  revalidatePath('/admin/emails');
  return { ok: true, message: 'Template saved.' };
}

export async function sendTestEmailAction(to: string, template?: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const result = await sendEmail({
    to,
    template,
    subject: template ? undefined : 'FairCouples SMTP test',
    html: template
      ? undefined
      : '<p>Your SMTP configuration works. This is a test email from the FairCouples admin panel.</p>',
    variables: {
      name: 'Admin',
      confirm_url: `${SITE_URL}/verify-email`,
      inviter_name: 'FairCouples',
      invite_url: `${SITE_URL}/invite/example`,
      reset_url: `${SITE_URL}/reset-password`,
      plan_name: 'Premium',
      amount: '19.99',
      currency: 'USD',
      next_billing_date: 'in one month',
      invoice_url: `${SITE_URL}/dashboard/billing`,
      balance_index: '84',
      overall_score: '76',
      verdict: 'Balanced week.',
      report_url: `${SITE_URL}/dashboard/fairness`,
      partner_name: 'Alex',
      destination: 'Santorini',
      days: '14',
      checklist_url: `${SITE_URL}/dashboard/checklists`,
      couple_name: 'Our space',
      entry_type: 'a fairness entry',
      link: SITE_URL,
      retry_url: `${SITE_URL}/dashboard/billing`,
    },
  });

  return result.ok
    ? { ok: true, message: `Test email sent to ${to}.` }
    : { ok: false, error: result.error ?? 'Send failed.' };
}

export async function verifySmtpAction(): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const result = await verifySmtp();
  return result.ok
    ? { ok: true, message: 'SMTP connection verified.' }
    : { ok: false, error: result.error ?? 'Verification failed.' };
}

/* ------------------------------------------------------- Support & marketing */

export async function updateContactStatusAction(
  messageId: string,
  status: string
): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const result = await execute(
    `UPDATE contact_messages SET status = ?, replied_at = ? WHERE id = ?`,
    [status, status === 'replied' ? nowSql() : null, messageId]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not update the message.' };
  revalidatePath('/admin/contacts');
  return { ok: true, message: 'Updated.' };
}

export async function saveTestimonialAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const authorName = String(formData.get('author_name') ?? '').trim();
  const quote = String(formData.get('quote') ?? '').trim();

  if (!authorName || !quote) return { ok: false, error: 'Name and quote are required.' };

  const values = [
    authorName,
    String(formData.get('author_role') ?? '').trim() || null,
    String(formData.get('author_location') ?? '').trim() || null,
    quote,
    Number(formData.get('rating') ?? 5),
    formData.get('is_featured') === 'on',
    formData.get('is_active') === 'on',
    Number(formData.get('sort_order') ?? 0),
  ];

  const result = id
    ? await execute(
        `UPDATE testimonials
            SET author_name = ?, author_role = ?, author_location = ?, quote = ?, rating = ?,
                is_featured = ?, is_active = ?, sort_order = ?
          WHERE id = ?`,
        [...values, id]
      )
    : await execute(
        `INSERT INTO testimonials
           (id, author_name, author_role, author_location, quote, rating, is_featured, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ...values]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the testimonial.' };
  revalidatePath('/admin/content');
  revalidatePath('/');
  return { ok: true, message: 'Testimonial saved.' };
}

export async function saveFaqAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const question = String(formData.get('question') ?? '').trim();
  const answer = String(formData.get('answer') ?? '').trim();

  if (!question || !answer) return { ok: false, error: 'Question and answer are required.' };

  const values = [
    question,
    answer,
    String(formData.get('category') ?? 'general'),
    String(formData.get('page_path') ?? '').trim() || null,
    Number(formData.get('sort_order') ?? 0),
    formData.get('is_active') === 'on',
  ];

  const result = id
    ? await execute(
        `UPDATE faqs SET question = ?, answer = ?, category = ?, page_path = ?, sort_order = ?, is_active = ?
          WHERE id = ?`,
        [...values, id]
      )
    : await execute(
        `INSERT INTO faqs (id, question, answer, category, page_path, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ...values]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the FAQ.' };
  revalidatePath('/admin/content');
  revalidatePath('/faq');
  return { ok: true, message: 'FAQ saved.' };
}

export async function deleteRowAction(table: string, id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  // The table name is interpolated, so only this fixed allow-list may be used.
  const allowed = ['testimonials', 'faqs', 'contact_messages', 'newsletter_subscribers'];
  if (!allowed.includes(table)) return { ok: false, error: 'Not allowed.' };

  const result = await execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the row.' };

  revalidatePath('/admin/content');
  revalidatePath('/admin/contacts');
  return { ok: true, message: 'Deleted.' };
}

/* ------------------------------------------------------------- Destinations */

export async function saveDestinationAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const slug = slugify(String(formData.get('slug') ?? '') || name);
  const countryCode = String(formData.get('country_code') ?? '')
    .trim()
    .toUpperCase();

  if (!name || !slug || countryCode.length !== 2) {
    return { ok: false, error: 'Name, slug and a two-letter country code are required.' };
  }

  const values = [
    countryCode,
    name,
    slug,
    String(formData.get('city') ?? '').trim() || null,
    String(formData.get('destination_type') ?? 'city'),
    String(formData.get('summary') ?? '').trim() || null,
    String(formData.get('description') ?? '').trim() || null,
    String(formData.get('hero_image') ?? '').trim() || null,
    formData.get('avg_daily_cost_usd') ? Number(formData.get('avg_daily_cost_usd')) : null,
    formData.get('honeymoon_score') ? Number(formData.get('honeymoon_score')) : null,
    formData.get('romance_score') ? Number(formData.get('romance_score')) : null,
    String(formData.get('budget_level') ?? '') || null,
    formData.get('ideal_days') ? Number(formData.get('ideal_days')) : null,
    JSON.stringify(csv(formData, 'tags')),
    formData.get('is_honeymoon') === 'on',
    formData.get('is_featured') === 'on',
    formData.get('is_active') !== 'off',
    String(formData.get('meta_title') ?? '').trim() || null,
    String(formData.get('meta_description') ?? '').trim() || null,
  ];

  const result = id
    ? await execute(
        `UPDATE destinations
            SET country_code = ?, name = ?, slug = ?, city = ?, destination_type = ?, summary = ?,
                description = ?, hero_image = ?, avg_daily_cost_usd = ?, honeymoon_score = ?,
                romance_score = ?, budget_level = ?, ideal_days = ?, tags = ?, is_honeymoon = ?,
                is_featured = ?, is_active = ?, meta_title = ?, meta_description = ?
          WHERE id = ?`,
        [...values, id]
      )
    : await execute(
        `INSERT INTO destinations
           (id, country_code, name, slug, city, destination_type, summary, description, hero_image,
            avg_daily_cost_usd, honeymoon_score, romance_score, budget_level, ideal_days, tags,
            is_honeymoon, is_featured, is_active, meta_title, meta_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ...values]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the destination.' };

  revalidatePath('/admin/destinations');
  revalidatePath('/destinations');
  revalidatePath(`/destinations/${slug}`);
  return { ok: true, message: 'Destination saved.' };
}

export async function deleteDestinationAction(destinationId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const result = await execute(`DELETE FROM destinations WHERE id = ?`, [destinationId]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the destination.' };

  revalidatePath('/admin/destinations');
  revalidatePath('/destinations');
  return { ok: true, message: 'Destination deleted.' };
}

/* -------------------------------------------------------------- Subscriptions */

export async function adminUpdateSubscriptionAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? 'active');
  const periodEnd = toMysqlDateTime(String(formData.get('current_period_end') ?? '') || null);

  const result = periodEnd
    ? await execute(
        `UPDATE subscriptions SET status = ?, current_period_end = ?, notes = ? WHERE id = ?`,
        [status, periodEnd, String(formData.get('notes') ?? '') || null, id]
      )
    : await execute(`UPDATE subscriptions SET status = ?, notes = ? WHERE id = ?`, [
        status,
        String(formData.get('notes') ?? '') || null,
        id,
      ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not update the subscription.' };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.subscription.update',
    entityType: 'subscription',
    entityId: id,
    summary: `Set status to ${status}`,
  });

  revalidatePath('/admin/subscriptions');
  return { ok: true, message: 'Subscription updated.' };
}

export async function grantPlanAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const userId = String(formData.get('user_id') ?? '');
  const planId = String(formData.get('plan_id') ?? '');
  const months = Number(formData.get('months') ?? 12);

  if (!userId || !planId) return { ok: false, error: 'Pick a user and a plan.' };

  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);

  const membership = await queryOne<{ couple_id: string }>(
    `SELECT couple_id FROM couple_members WHERE user_id = ? AND removed_at IS NULL LIMIT 1`,
    [userId]
  );

  const result = await execute(
    `INSERT INTO subscriptions
       (id, user_id, couple_id, plan_id, provider, provider_subscription_id, status,
        billing_interval, amount_cents, current_period_start, current_period_end, notes)
     VALUES (?, ?, ?, ?, 'manual', ?, 'active', 'month', 0, ?, ?, ?)`,
    [
      uuid(),
      userId,
      membership?.couple_id ?? null,
      planId,
      `manual-${userId}-${Date.now()}`,
      toMysqlDateTime(start),
      toMysqlDateTime(end),
      `Granted by ${user.email}`,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not grant the plan.' };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.plan.grant',
    entityType: 'subscription',
    entityId: userId,
    summary: `Granted plan for ${months} months`,
  });

  revalidatePath('/admin/subscriptions');
  return { ok: true, message: `Plan granted for ${months} months.` };
}

/** Powers the admin dashboard's headline numbers. */
export async function adminStatsAction(): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const rows = await query<{ metric: string; total: number }>(
    `SELECT 'users' AS metric, COUNT(*) AS total FROM profiles WHERE deleted_at IS NULL
     UNION ALL SELECT 'couples', COUNT(*) FROM couples
     UNION ALL SELECT 'active_subs', COUNT(*) FROM subscriptions WHERE status IN ('active','trialing')
     UNION ALL SELECT 'contacts_new', COUNT(*) FROM contact_messages WHERE status = 'new'`
  );

  return {
    ok: true,
    data: Object.fromEntries(rows.map((row) => [row.metric, Number(row.total)])),
  };
}
