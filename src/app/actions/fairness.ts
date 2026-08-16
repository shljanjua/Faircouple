'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { notifyUser } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { weekStart } from '@/lib/utils';
import { SITE_URL } from '@/lib/seo';
import type { ActionResult } from '@/app/actions/couple';

/**
 * Saves one member's entry for a single fairness category and period.
 * Each partner writes only their own row — enforced by RLS as well as here.
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

  const supabase = createClient();

  const payload = {
    couple_id: context.couple.id,
    user_id: user.id,
    about_user_id: context.partner?.user_id ?? null,
    category_id: categoryId,
    period,
    self_score: num('self_score'),
    partner_score: num('partner_score'),
    effort_self: num('effort_self'),
    effort_partner: num('effort_partner'),
    respect_score: num('respect_score'),
    loyalty_score: num('loyalty_score'),
    satisfaction: num('satisfaction'),
    note: String(formData.get('note') ?? '').trim() || null,
    partner_note: String(formData.get('partner_note') ?? '').trim() || null,
    is_private: formData.get('is_private') === 'on' || formData.get('is_private') === 'true',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('fairness_entries')
    .upsert(payload, { onConflict: 'couple_id,user_id,category_id,period' })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  // Persist per-criterion answers (0–4 scale) submitted alongside the entry.
  const criterionResponses: any[] = [];
  formData.forEach((value, key) => {
    const match = /^criterion:(.+):(self|partner)$/.exec(key);
    if (!match || value === '') return;
    const [, criterionId, side] = match;
    let row = criterionResponses.find((r) => r.criterion_id === criterionId);
    if (!row) {
      row = { entry_id: (data as any).id, criterion_id: criterionId };
      criterionResponses.push(row);
    }
    row[side === 'self' ? 'self_value' : 'partner_value'] = Number(value);
  });

  if (criterionResponses.length) {
    await supabase
      .from('fairness_criteria_responses')
      .upsert(criterionResponses, { onConflict: 'entry_id,criterion_id' });
  }

  if (context.partner && !payload.is_private) {
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
  const supabase = createClient();

  const { data: categories } = await supabase
    .from('fairness_categories')
    .select('id')
    .eq('is_active', true);

  const rows = (categories ?? [])
    .map((category: any) => {
      const self = formData.get(`self:${category.id}`);
      const partner = formData.get(`partner:${category.id}`);
      if (self === null && partner === null) return null;
      const selfScore = self === null || self === '' ? null : Number(self);
      const partnerScore = partner === null || partner === '' ? null : Number(partner);
      if (selfScore === null && partnerScore === null) return null;
      return {
        couple_id: context.couple.id,
        user_id: user.id,
        about_user_id: context.partner?.user_id ?? null,
        category_id: category.id,
        period,
        self_score: selfScore,
        partner_score: partnerScore,
        effort_self: selfScore === null ? null : selfScore * 10,
        effort_partner: partnerScore === null ? null : partnerScore * 10,
        note: String(formData.get(`note:${category.id}`) ?? '').trim() || null,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (!rows.length) return { ok: false, error: 'Nothing to save yet.' };

  const { error } = await supabase
    .from('fairness_entries')
    .upsert(rows as any[], { onConflict: 'couple_id,user_id,category_id,period' });

  if (error) return { ok: false, error: error.message };

  if (context.partner?.profile?.email) {
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

  const supabase = createClient();
  const { error } = await supabase.from('fairness_reports').upsert(
    {
      couple_id: context.couple.id,
      period: payload.period,
      period_type: 'week',
      overall_score: payload.overallScore,
      balance_index: payload.balanceIndex,
      effort_a: payload.effortA,
      effort_b: payload.effortB,
      respect_delta: payload.respectDelta,
      loyalty_delta: payload.loyaltyDelta,
      verdict: payload.verdict,
      risk_level: payload.riskLevel,
      breakdown: payload.breakdown as any,
      insights: payload.insights as any,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'couple_id,period,period_type' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function emailWeeklyReportAction(period: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user || !context) return { ok: false, error: 'No relationship space.' };

  const supabase = createClient();
  const { data: report } = await supabase
    .from('fairness_reports')
    .select('*')
    .eq('couple_id', context.couple.id)
    .eq('period', period)
    .maybeSingle();

  if (!report) return { ok: false, error: 'Generate the report first.' };

  const recipients = context.members
    .map((m) => m.profile?.email)
    .filter((email): email is string => Boolean(email));

  for (const email of recipients) {
    await sendEmail({
      to: email,
      template: 'weekly-report',
      variables: {
        name: user.profile.full_name ?? 'there',
        partner_name: context.partner?.profile?.full_name ?? 'your partner',
        balance_index: Math.round(Number((report as any).balance_index ?? 0)),
        overall_score: Math.round(Number((report as any).overall_score ?? 0)),
        verdict: (report as any).verdict ?? '',
        report_url: `${SITE_URL}/dashboard/fairness`,
      },
    });
  }

  return { ok: true, message: `Report emailed to ${recipients.length} recipient(s).` };
}
