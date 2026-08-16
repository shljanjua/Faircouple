'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { setSettings } from '@/lib/settings';
import { recordAudit } from '@/lib/audit';
import { sendEmail, verifySmtp } from '@/lib/email';
import { slugify } from '@/lib/utils';
import type { ActionResult } from '@/app/actions/couple';

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.profile.role !== 'admin' && user.profile.role !== 'superadmin') return null;
  return user;
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

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('payment_gateways')
    .select('credentials')
    .eq('provider', provider)
    .maybeSingle();

  const merged = { ...((existing as any)?.credentials ?? {}), ...credentials };

  const { error } = await supabase.from('payment_gateways').upsert(
    {
      provider,
      display_name: String(formData.get('display_name') ?? provider),
      is_enabled: formData.get('is_enabled') === 'on',
      mode: String(formData.get('mode') ?? 'test'),
      credentials: merged,
      instructions: String(formData.get('instructions') ?? '') || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'provider' }
  );

  if (error) return { ok: false, error: error.message };

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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      role,
      status,
      suspended_reason: String(formData.get('suspended_reason') ?? '') || null,
    })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };

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

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .maybeSingle();

  if ((target as any)?.role === 'superadmin' && user.profile.role !== 'superadmin') {
    return { ok: false, error: 'Only a superadmin can delete a superadmin.' };
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    await supabase
      .from('profiles')
      .update({ status: 'pending_deletion', deleted_at: new Date().toISOString() })
      .eq('id', userId);
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.user.delete',
    entityType: 'profile',
    entityId: userId,
    summary: `Deleted ${(target as any)?.email ?? userId}`,
  });

  revalidatePath('/admin/users');
  return { ok: true, message: 'User deleted.' };
}

export async function impersonationLinkAction(userId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user || user.profile.role !== 'superadmin') {
    return { ok: false, error: 'Superadmin access required.' };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { ok: false, error: 'User not found.' };

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: (profile as any).email,
  });

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'admin.user.magiclink',
    entityType: 'profile',
    entityId: userId,
    summary: 'Generated a one-time sign-in link for support',
  });

  return { ok: true, data: (data as any)?.properties?.action_link ?? null };
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

  const payload = {
    slug: slugify(String(formData.get('slug') ?? '')),
    name: String(formData.get('name') ?? '').trim(),
    tagline: String(formData.get('tagline') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
    tier: Number(formData.get('tier') ?? 0),
    is_active: formData.get('is_active') === 'on',
    is_featured: formData.get('is_featured') === 'on',
    is_free: formData.get('is_free') === 'on',
    trial_days: Number(formData.get('trial_days') ?? 0),
    sort_order: Number(formData.get('sort_order') ?? 0),
    badge: String(formData.get('badge') ?? '').trim() || null,
    features,
    limits,
  };

  if (!payload.slug || !payload.name) {
    return { ok: false, error: 'Slug and name are required.' };
  }

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from('plans').update(payload).eq('id', id)
    : await supabase.from('plans').insert(payload);

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: id ? 'admin.plan.update' : 'admin.plan.create',
    entityType: 'plan',
    entityId: id || payload.slug,
    summary: `Saved plan ${payload.name}`,
  });

  revalidatePath('/admin/plans');
  revalidatePath('/pricing');
  return { ok: true, message: 'Plan saved.' };
}

export async function savePlanPriceAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const payload = {
    plan_id: String(formData.get('plan_id') ?? ''),
    currency: String(formData.get('currency') ?? 'USD').toUpperCase(),
    interval: String(formData.get('interval') ?? 'month'),
    amount_cents: Math.round(Number(formData.get('amount') ?? 0) * 100),
    compare_at_cents: formData.get('compare_at')
      ? Math.round(Number(formData.get('compare_at')) * 100)
      : null,
    stripe_price_id: String(formData.get('stripe_price_id') ?? '').trim() || null,
    paypal_plan_id: String(formData.get('paypal_plan_id') ?? '').trim() || null,
    is_active: formData.get('is_active') !== 'off',
  };

  if (!payload.plan_id) return { ok: false, error: 'Missing plan.' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('plan_prices')
    .upsert(payload, { onConflict: 'plan_id,currency,interval' });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/plans');
  revalidatePath('/pricing');
  return { ok: true, message: 'Price saved.' };
}

export async function deletePlanAction(planId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const supabase = createAdminClient();
  const { count } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .in('status', ['active', 'trialing']);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `${count} active subscription(s) use this plan. Deactivate it instead of deleting.`,
    };
  }

  const { error } = await supabase.from('plans').delete().eq('id', planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/plans');
  revalidatePath('/pricing');
  return { ok: true, message: 'Plan deleted.' };
}

/* --------------------------------------------------------------- Coupons */

export async function saveCouponAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const payload = {
    code: String(formData.get('code') ?? '').trim().toUpperCase(),
    description: String(formData.get('description') ?? '').trim() || null,
    discount_type: String(formData.get('discount_type') ?? 'percent'),
    percent_off: formData.get('percent_off') ? Number(formData.get('percent_off')) : null,
    amount_off_cents: formData.get('amount_off')
      ? Math.round(Number(formData.get('amount_off')) * 100)
      : null,
    currency: String(formData.get('currency') ?? '') || null,
    duration: String(formData.get('duration') ?? 'once'),
    max_redemptions: formData.get('max_redemptions')
      ? Number(formData.get('max_redemptions'))
      : null,
    expires_at: String(formData.get('expires_at') ?? '') || null,
    is_active: formData.get('is_active') === 'on',
  };

  if (!payload.code) return { ok: false, error: 'A coupon code is required.' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('coupons').upsert(payload, { onConflict: 'code' });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/coupons');
  return { ok: true, message: 'Coupon saved.' };
}

export async function deleteCouponAction(couponId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('coupons').delete().eq('id', couponId);
  if (error) return { ok: false, error: error.message };
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

  const payload = {
    slug,
    title,
    excerpt: String(formData.get('excerpt') ?? '').trim() || null,
    content: String(formData.get('content') ?? ''),
    cover_image: String(formData.get('cover_image') ?? '').trim() || null,
    category_id: String(formData.get('category_id') ?? '') || null,
    author_id: user.id,
    author_name: String(formData.get('author_name') ?? 'FairCouples Team'),
    status,
    is_featured: formData.get('is_featured') === 'on',
    reading_minutes: Number(formData.get('reading_minutes') ?? 5),
    tags: String(formData.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    keywords: String(formData.get('keywords') ?? '')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    meta_title: String(formData.get('meta_title') ?? '').trim() || null,
    meta_description: String(formData.get('meta_description') ?? '').trim() || null,
    canonical_url: String(formData.get('canonical_url') ?? '').trim() || null,
    og_image: String(formData.get('og_image') ?? '').trim() || null,
    no_index: formData.get('no_index') === 'on',
    published_at:
      status === 'published'
        ? String(formData.get('published_at') ?? '') || new Date().toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from('blog_posts').update(payload).eq('id', id)
    : await supabase.from('blog_posts').insert(payload);

  if (error) return { ok: false, error: error.message };

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
  return { ok: true, message: 'Post saved.' };
}

export async function deleteBlogPostAction(postId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('blog_posts').delete().eq('id', postId);
  if (error) return { ok: false, error: error.message };

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

  const payload = {
    slug,
    title,
    content: String(formData.get('content') ?? ''),
    page_type: String(formData.get('page_type') ?? 'legal'),
    status: String(formData.get('status') ?? 'published'),
    show_in_footer: formData.get('show_in_footer') === 'on',
    show_in_header: formData.get('show_in_header') === 'on',
    meta_title: String(formData.get('meta_title') ?? '').trim() || null,
    meta_description: String(formData.get('meta_description') ?? '').trim() || null,
    keywords: String(formData.get('keywords') ?? '')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    no_index: formData.get('no_index') === 'on',
    sort_order: Number(formData.get('sort_order') ?? 0),
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from('pages').update(payload).eq('id', id)
    : await supabase.from('pages').insert(payload);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/pages');
  revalidatePath(`/${slug}`);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Page saved.' };
}

export async function deletePageAction(pageId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('pages').delete().eq('id', pageId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/pages');
  return { ok: true, message: 'Page deleted.' };
}

/* ---------------------------------------------------------------------- SEO */

export async function saveSeoMetaAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const path = String(formData.get('path') ?? '').trim();
  if (!path.startsWith('/')) return { ok: false, error: 'Path must start with /' };

  const payload = {
    path,
    title: String(formData.get('title') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
    keywords: String(formData.get('keywords') ?? '')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    og_image: String(formData.get('og_image') ?? '').trim() || null,
    canonical_url: String(formData.get('canonical_url') ?? '').trim() || null,
    robots: String(formData.get('robots') ?? 'index,follow'),
    priority: Number(formData.get('priority') ?? 0.7),
    changefreq: String(formData.get('changefreq') ?? 'weekly'),
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { error } = await supabase.from('seo_meta').upsert(payload, { onConflict: 'path' });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/seo');
  revalidatePath(path);
  return { ok: true, message: 'SEO metadata saved.' };
}

export async function saveRedirectAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const payload = {
    source: String(formData.get('source') ?? '').trim(),
    destination: String(formData.get('destination') ?? '').trim(),
    status_code: Number(formData.get('status_code') ?? 301),
    is_active: formData.get('is_active') !== 'off',
  };

  if (!payload.source.startsWith('/') || !payload.destination) {
    return { ok: false, error: 'Source must start with / and destination is required.' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('redirects').upsert(payload, { onConflict: 'source' });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/seo');
  return { ok: true, message: 'Redirect saved.' };
}

export async function deleteRedirectAction(redirectId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };
  const supabase = createAdminClient();
  const { error } = await supabase.from('redirects').delete().eq('id', redirectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/seo');
  return { ok: true, message: 'Redirect removed.' };
}

/* -------------------------------------------------------------------- Email */

export async function saveEmailTemplateAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) return { ok: false, error: 'Missing template slug.' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('email_templates')
    .update({
      name: String(formData.get('name') ?? slug),
      subject: String(formData.get('subject') ?? ''),
      html_body: String(formData.get('html_body') ?? ''),
      text_body: String(formData.get('text_body') ?? '') || null,
      is_active: formData.get('is_active') === 'on',
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug);

  if (error) return { ok: false, error: error.message };

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
      confirm_url: 'https://example.com/confirm',
      inviter_name: 'FairCouples',
      invite_url: 'https://example.com/invite',
      reset_url: 'https://example.com/reset',
      plan_name: 'Premium',
      amount: '19.99',
      currency: 'USD',
      next_billing_date: 'in one month',
      invoice_url: 'https://example.com/invoice',
      balance_index: '84',
      overall_score: '76',
      verdict: 'Balanced week.',
      report_url: 'https://example.com/report',
      partner_name: 'Alex',
      destination: 'Santorini',
      days: '14',
      checklist_url: 'https://example.com/checklist',
      couple_name: 'Our space',
      entry_type: 'a fairness entry',
      link: 'https://example.com',
      retry_url: 'https://example.com/billing',
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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('contact_messages')
    .update({ status, replied_at: status === 'replied' ? new Date().toISOString() : null })
    .eq('id', messageId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/contacts');
  return { ok: true, message: 'Updated.' };
}

export async function saveTestimonialAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const payload = {
    author_name: String(formData.get('author_name') ?? '').trim(),
    author_role: String(formData.get('author_role') ?? '').trim() || null,
    author_location: String(formData.get('author_location') ?? '').trim() || null,
    quote: String(formData.get('quote') ?? '').trim(),
    rating: Number(formData.get('rating') ?? 5),
    is_featured: formData.get('is_featured') === 'on',
    is_active: formData.get('is_active') === 'on',
    sort_order: Number(formData.get('sort_order') ?? 0),
  };

  if (!payload.author_name || !payload.quote) {
    return { ok: false, error: 'Name and quote are required.' };
  }

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from('testimonials').update(payload).eq('id', id)
    : await supabase.from('testimonials').insert(payload);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/content');
  revalidatePath('/');
  return { ok: true, message: 'Testimonial saved.' };
}

export async function saveFaqAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const payload = {
    question: String(formData.get('question') ?? '').trim(),
    answer: String(formData.get('answer') ?? '').trim(),
    category: String(formData.get('category') ?? 'general'),
    page_path: String(formData.get('page_path') ?? '').trim() || null,
    sort_order: Number(formData.get('sort_order') ?? 0),
    is_active: formData.get('is_active') === 'on',
  };

  if (!payload.question || !payload.answer) {
    return { ok: false, error: 'Question and answer are required.' };
  }

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from('faqs').update(payload).eq('id', id)
    : await supabase.from('faqs').insert(payload);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/content');
  revalidatePath('/faq');
  return { ok: true, message: 'FAQ saved.' };
}

export async function deleteRowAction(table: string, id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const allowed = ['testimonials', 'faqs', 'contact_messages', 'newsletter_subscribers'];
  if (!allowed.includes(table)) return { ok: false, error: 'Not allowed.' };

  const supabase = createAdminClient();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/content');
  revalidatePath('/admin/contacts');
  return { ok: true, message: 'Deleted.' };
}

/* -------------------------------------------------------------- Subscriptions */

export async function adminUpdateSubscriptionAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? 'active');
  const periodEnd = String(formData.get('current_period_end') ?? '');

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      current_period_end: periodEnd ? new Date(periodEnd).toISOString() : undefined,
      notes: String(formData.get('notes') ?? '') || null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

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

  const supabase = createAdminClient();
  const { data: membership } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', userId)
    .is('removed_at', null)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('subscriptions').insert({
    user_id: userId,
    couple_id: (membership as any)?.couple_id ?? null,
    plan_id: planId,
    provider: 'manual',
    provider_subscription_id: `manual-${userId}-${Date.now()}`,
    status: 'active',
    interval: 'month',
    amount_cents: 0,
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    notes: `Granted by ${user.email}`,
  });

  if (error) return { ok: false, error: error.message };

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
