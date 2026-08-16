'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { scoreAssessment, scoreCompatibility } from '@/lib/assessment';
import type { ActionResult } from '@/app/actions/couple';

export async function saveLoveAssessmentAction(
  answers: Record<string, number>
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Sign in to save your result.' };

  const context = await getCoupleContext();
  const result = scoreAssessment(answers);

  const supabase = createClient();
  const { error } = await supabase.from('assessments').insert({
    couple_id: context?.couple.id ?? null,
    user_id: user.id,
    kind: 'love_vs_attraction',
    answers,
    love_score: result.loveScore,
    attraction_score: result.attractionScore,
    result_key: result.key,
    verdict: result.verdict,
    summary: result.summary,
    details: { guidance: result.guidance, difference: result.difference },
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/compatibility');
  return { ok: true, data: result };
}

export async function saveCompatibilityAction(
  answers: Record<string, number>
): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!context) return { ok: false, error: 'Create your relationship space first.' };

  const supabase = createClient();

  const { error: insertError } = await supabase.from('assessments').insert({
    couple_id: context.couple.id,
    user_id: user.id,
    kind: 'compatibility',
    answers,
  });
  if (insertError) return { ok: false, error: insertError.message };

  // Recompute the shared score using the partner's latest answers, if any.
  let partnerAnswers: Record<string, number> | null = null;
  if (context.partner) {
    const { data } = await supabase
      .from('assessments')
      .select('answers')
      .eq('couple_id', context.couple.id)
      .eq('user_id', context.partner.user_id)
      .eq('kind', 'compatibility')
      .order('taken_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    partnerAnswers = ((data as any)?.answers ?? null) as Record<string, number> | null;
  }

  const scored = scoreCompatibility(answers, partnerAnswers);
  const byKey = Object.fromEntries(scored.dimensions.map((d) => [d.key, d.score]));

  const { error } = await supabase.from('compatibility_scores').upsert(
    {
      couple_id: context.couple.id,
      period: new Date().toISOString().slice(0, 10),
      overall: scored.overall,
      emotional: byKey.emotional ?? null,
      communication: byKey.communication ?? null,
      trust: byKey.trust ?? null,
      financial: byKey.financial ?? null,
      intimacy: byKey.intimacy ?? null,
      lifestyle: byKey.lifestyle ?? null,
      future_goals: byKey.future_goals ?? null,
      conflict: byKey.conflict ?? null,
      verdict: scored.biggestGap
        ? `Biggest perception gap: ${scored.biggestGap.label}.`
        : 'Waiting for your partner to complete their answers.',
      details: { dimensions: scored.dimensions },
    },
    { onConflict: 'couple_id,period' }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/compatibility');
  return { ok: true, data: scored };
}
