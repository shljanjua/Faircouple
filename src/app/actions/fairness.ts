'use server';

import { revalidatePath } from 'next/cache';
import { execute, query, queryOne, uuid, nowSql } from '@/lib/db';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { notifyUser } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { weekStart } from '@/lib/utils';
import { SITE_URL } from '@/lib/seo';
import type { ActionResult } from '@/app/actions/couple';

/**
 * Saves one member's entry for a single fairness category and period.
 * Each partner writes only their own row — every statement is scoped to
 * both the couple and the signed-in user, since MySQL has no row-level
 * security to fall back on.
 */
export async function saveFairnessEntryAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!context) return { ok: false, error: 'Create your relationship space first.' };

  const categoryId = String(formData.get('category_id') ?? '');
  if (!categoryId) return { ok: false, error: 'Missing category.' };

  const period = String(formData.get('period') ?? weekStart());
  const num = (key: string) => {
    const raw = formData.get(key);
    if (raw === null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };

  const isPrivate = formData.get('is_private') === 'on' || formData.get('is_private') === 'true';

  const saved = await execute(
    `INSERT INTO fairness_entries
       (id, couple_id, user_id, about_user_id, category_id, period,
        self_score, partner_score, effort_self, effort_partner,
        respect_score, loyalty_score, satisfaction, note, partner_note, is_private)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       about_user_id  = VALUES(about_user_id),
       self_score     = VALUES(self_score),
       partner_score  = VALUES(partner_score),
       effort_self    = VALUES(effort_self),
       effort_partner = VALUES(effort_partner),
       respect_score  = VALUES(respect_score),
       loyalty_score  = VALUES(loyalty_score),
       satisfaction   = VALUES(satisfaction),
       note           = VALUES(note),
       partner_note   = VALUES(partner_note),
       is_private     = VALUES(is_private),
       updated_at     = CURRENT_TIMESTAMP`,
    [
      uuid(),
      context.couple.id,
      user.id,
      context.partner?.user_id ?? null,
      categoryId,
      period,
      num('self_score'),
      num('partner_score'),
      num('effort_self'),
      num('effort_partner'),
      num('respect_score'),
      num('loyalty_score'),
      num('satisfaction'),
      String(formData.get('note') ?? '').trim() || null,
      String(formData.get('partner_note') ?? '').trim() || null,
      isPrivate,
    ]
  );

  if (!saved.ok) return { ok: false, error: saved.error ?? 'Could not save your entry.' };

  const entry = await queryOne<{ id: string }>(
    `SELECT id FROM fairness_entries
      WHERE couple_id = ? AND user_id = ? AND category_id = ? AND period = ? LIMIT 1`,
    [context.couple.id, user.id, categoryId, period]
  );

  // Persist per-criterion answers (0–4 scale) submitted alongside the entry.
  if (entry) {
    const responses = new Map<string, { self: number | null; partner: number | null }>();
    formData.forEach((value, key) => {
      const match = /^criterion:(.+):(self|partner)$/.exec(key);
      if (!match || value === '') return;
      const [, criterionId, side] = match;
      const row = responses.get(criterionId) ?? { self: null, partner: null };
      row[side === 'self' ? 'self' : 'partner'] = Number(value);
      responses.set(criterionId, row);
    });

    for (const [criterionId, values] of responses) {
      await execute(
        `INSERT INTO fairness_criteria_responses (id, entry_id, criterion_id, self_value, partner_value)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE self_value = VALUES(self_value), partner_value = VALUES(partner_value)`,
        [uuid(), entry.id, criterionId, values.self, values.partner]
      );
    }
  }

  if (context.partner && !isPrivate) {
    await notifyUser({
      userId: context.partner.user_id,
      coupleId: context.couple.id,
      type: 'fairness',
      title: `${user.profile.full_name ?? 'Your partner'} updated a fairness entry`,
      body: 'Open the report to add your own side.',
      link: '/dashboard/fairness',
      emoji: '⚖️',
    });
  }

  revalidatePath('/dashboard/fairness');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Saved.' };
}

/** Saves every category in one submit (the "quick week" form). */
export async function saveWeeklyFairnessAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user || !context) return { ok: false, error: 'Create your relationship space first.' };

  const period = String(formData.get('period') ?? weekStart());

  const categories = await query<{ id: string }>(
    `SELECT id FROM fairness_categories WHERE is_active = 1`
  );

  let written = 0;

  for (const category of categories) {
    const self = formData.get(`self:${category.id}`);
    const partner = formData.get(`partner:${category.id}`);
    const selfScore = self === null || self === '' ? null : Number(self);
    const partnerScore = partner === null || partner === '' ? null : Number(partner);
    if (selfScore === null && partnerScore === null) continue;

    const result = await execute(
      `INSERT INTO fairness_entries
         (id, couple_id, user_id, about_user_id, category_id, period,
          self_score, partner_score, effort_self, effort_partner, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         about_user_id  = VALUES(about_user_id),
         self_score     = VALUES(self_score),
         partner_score  = VALUES(partner_score),
         effort_self    = VALUES(effort_self),
         effort_partner = VALUES(effort_partner),
         note           = VALUES(note),
         updated_at     = CURRENT_TIMESTAMP`,
      [
        uuid(),
        context.couple.id,
        user.id,
        context.partner?.user_id ?? null,
        category.id,
        period,
        selfScore,
        partnerScore,
        selfScore === null ? null : Math.min(100, selfScore * 10),
        partnerScore === null ? null : Math.min(100, partnerScore * 10),
        String(formData.get(`note:${category.id}`) ?? '').trim() || null,
      ]
    );

    if (!result.ok) return { ok: false, error: result.error ?? 'Could not save your week.' };
    written += 1;
  }

  if (!written) return { ok: false, error: 'Nothing to save yet.' };

  if (context.partner) {
    await notifyUser({
      userId: context.partner.user_id,
      coupleId: context.couple.id,
      type: 'fairness',
      title: `${user.profile.full_name ?? 'Your partner'} completed this week's entries`,
      body: 'Add yours so the balance index can be calculated.',
      link: '/dashboard/fairness',
      emoji: '⚖️',
    });
  }

  revalidatePath('/dashboard/fairness');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Your week is saved.' };
}

/** Persists a computed report snapshot so history survives plan downgrades. */
export async function snapshotReportAction(payload: {
  period: string;
  overallScore: number;
  balanceIndex: number;
  effortA: number;
  effortB: number;
  respectDelta: number;
  loyaltyDelta: number;
  verdict: string;
  riskLevel: string;
  breakdown: unknown;
  insights: unknown;
}): Promise<ActionResult> {
  const context = await getCoupleContext();
  if (!context) return { ok: false, error: 'No relationship space.' };

  const result = await execute(
    `INSERT INTO fairness_reports
       (id, couple_id, period, period_type, overall_score, balance_index, effort_a, effort_b,
        respect_delta, loyalty_delta, verdict, risk_level, breakdown, insights, generated_at)
     VALUES (?, ?, ?, 'week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       overall_score = VALUES(overall_score),
       balance_index = VALUES(balance_index),
       effort_a      = VALUES(effort_a),
       effort_b      = VALUES(effort_b),
       respect_delta = VALUES(respect_delta),
       loyalty_delta = VALUES(loyalty_delta),
       verdict       = VALUES(verdict),
       risk_level    = VALUES(risk_level),
       breakdown     = VALUES(breakdown),
       insights      = VALUES(insights),
       generated_at  = VALUES(generated_at)`,
    [
      uuid(),
      context.couple.id,
      payload.period,
      payload.overallScore,
      payload.balanceIndex,
      payload.effortA,
      payload.effortB,
      payload.respectDelta,
      payload.loyaltyDelta,
      payload.verdict,
      payload.riskLevel,
      JSON.stringify(payload.breakdown ?? null),
      JSON.stringify(payload.insights ?? null),
      nowSql(),
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not store the snapshot.' };
  return { ok: true };
}

export async function emailWeeklyReportAction(period: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user || !context) return { ok: false, error: 'No relationship space.' };

  const report = await queryOne<any>(
    `SELECT * FROM fairness_reports WHERE couple_id = ? AND period = ? LIMIT 1`,
    [context.couple.id, period]
  );

  if (!report) return { ok: false, error: 'Generate the report first.' };

  const recipients = context.members
    .map((member) => member.profile?.email)
    .filter((email): email is string => Boolean(email));

  for (const email of recipients) {
    await sendEmail({
      to: email,
      template: 'weekly-report',
      variables: {
        name: user.profile.full_name ?? 'there',
        partner_name: context.partner?.profile?.full_name ?? 'your partner',
        balance_index: Math.round(Number(report.balance_index ?? 0)),
        overall_score: Math.round(Number(report.overall_score ?? 0)),
        verdict: report.verdict ?? '',
        report_url: `${SITE_URL}/dashboard/fairness`,
      },
    });
  }

  return { ok: true, message: `Report emailed to ${recipients.length} recipient(s).` };
}
