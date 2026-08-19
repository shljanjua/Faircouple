'use server';

import { revalidatePath } from 'next/cache';
import { execute, queryOne, uuid, parseJson } from '@/lib/db';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { scoreAssessment, scoreCompatibility } from '@/lib/assessment';
import type { ActionResult } from '@/app/actions/couple';

export async function saveLoveAssessmentAction(
  answers: Record<string, number>
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Sign in to save your result.' };

  const context = await getCoupleContext();
  const scored = scoreAssessment(answers);

  const inserted = await execute(
    `INSERT INTO assessments
       (id, couple_id, user_id, kind, answers, love_score, attraction_score,
        result_key, verdict, summary, details)
     VALUES (?, ?, ?, 'love_vs_attraction', ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      context?.couple.id ?? null,
      user.id,
      JSON.stringify(answers),
      scored.loveScore,
      scored.attractionScore,
      scored.key,
      scored.verdict,
      scored.summary,
      JSON.stringify({ guidance: scored.guidance, difference: scored.difference }),
    ]
  );

  if (!inserted.ok) return { ok: false, error: inserted.error ?? 'Could not save your result.' };

  // Keep the couple's snapshot in step so the dashboard shows the latest verdict.
  if (context) {
    await execute(
      `INSERT INTO compatibility_scores (id, couple_id, period, overall, love_index, attraction_index)
       VALUES (?, ?, CURDATE(), 0, ?, ?)
       ON DUPLICATE KEY UPDATE love_index = VALUES(love_index), attraction_index = VALUES(attraction_index)`,
      [uuid(), context.couple.id, scored.loveScore, scored.attractionScore]
    );
  }

  revalidatePath('/dashboard/compatibility');
  return { ok: true, data: scored };
}

export async function saveCompatibilityAction(
  answers: Record<string, number>
): Promise<ActionResult> {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!context) return { ok: false, error: 'Create your relationship space first.' };

  const inserted = await execute(
    `INSERT INTO assessments (id, couple_id, user_id, kind, answers)
     VALUES (?, ?, ?, 'compatibility', ?)`,
    [uuid(), context.couple.id, user.id, JSON.stringify(answers)]
  );
  if (!inserted.ok) return { ok: false, error: inserted.error ?? 'Could not save your answers.' };

  // Recompute the shared score using the partner's latest answers, if any.
  let partnerAnswers: Record<string, number> | null = null;
  if (context.partner) {
    const row = await queryOne<{ answers: unknown }>(
      `SELECT answers FROM assessments
        WHERE couple_id = ? AND user_id = ? AND kind = 'compatibility'
        ORDER BY taken_at DESC LIMIT 1`,
      [context.couple.id, context.partner.user_id]
    );
    partnerAnswers = row ? parseJson<Record<string, number> | null>(row.answers, null) : null;
  }

  const scored = scoreCompatibility(answers, partnerAnswers);
  const byKey = Object.fromEntries(scored.dimensions.map((dimension) => [dimension.key, dimension.score]));

  const saved = await execute(
    `INSERT INTO compatibility_scores
       (id, couple_id, period, overall, emotional, communication, trust, financial,
        intimacy, lifestyle, future_goals, conflict, verdict, details)
     VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       overall       = VALUES(overall),
       emotional     = VALUES(emotional),
       communication = VALUES(communication),
       trust         = VALUES(trust),
       financial     = VALUES(financial),
       intimacy      = VALUES(intimacy),
       lifestyle     = VALUES(lifestyle),
       future_goals  = VALUES(future_goals),
       conflict      = VALUES(conflict),
       verdict       = VALUES(verdict),
       details       = VALUES(details)`,
    [
      uuid(),
      context.couple.id,
      scored.overall,
      byKey.emotional ?? null,
      byKey.communication ?? null,
      byKey.trust ?? null,
      byKey.financial ?? null,
      byKey.intimacy ?? null,
      byKey.lifestyle ?? null,
      byKey.future_goals ?? null,
      byKey.conflict ?? null,
      scored.biggestGap
        ? `Biggest perception gap: ${scored.biggestGap.label}.`
        : 'Waiting for your partner to complete their answers.',
      JSON.stringify({ dimensions: scored.dimensions }),
    ]
  );

  if (!saved.ok) return { ok: false, error: saved.error ?? 'Could not save the score.' };

  revalidatePath('/dashboard/compatibility');
  return { ok: true, data: scored };
}
