'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { limitReached, upgradeMessage } from '@/lib/plans';
import type { ActionResult } from '@/app/actions/couple';

async function space() {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user || !context) return null;
  return { user, context };
}

/** Splits an expense between the two members according to the split rule. */
function computeShares(
  amountCents: number,
  splitType: string,
  members: { userId: string; incomeShare?: number | null }[],
  payerId: string,
  custom?: Record<string, number>
) {
  if (splitType === 'none') {
    return members.map((m) => ({
      user_id: m.userId,
      share_cents: m.userId === payerId ? amountCents : 0,
    }));
  }

  if (splitType === 'custom' && custom) {
    return members.map((m) => ({
      user_id: m.userId,
      share_cents: Math.round((custom[m.userId] ?? 0) * 100),
    }));
  }

  if (splitType === 'income' || splitType === 'percent') {
    const total = members.reduce((sum, m) => sum + (m.incomeShare ?? 50), 0) || 100;
    let allocated = 0;
    return members.map((m, index) => {
      const isLast = index === members.length - 1;
      const share = isLast
        ? amountCents - allocated
        : Math.round((amountCents * (m.incomeShare ?? 50)) / total);
      allocated += share;
      return { user_id: m.userId, share_cents: share };
    });
  }

  // Equal split, remainder to the first member.
  const per = Math.floor(amountCents / members.length);
  return members.map((m, index) => ({
    user_id: m.userId,
    share_cents: index === 0 ? amountCents - per * (members.length - 1) : per,
  }));
}

export async function saveBudgetAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const id = String(formData.get('id') ?? '');
  if (!id) {
    const entitlements = await getEntitlements();
    const supabase = createClient();
    const { count } = await supabase
      .from('budgets')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', ctx.context.couple.id)
      .is('archived_at', null);
    if (limitReached(entitlements.limits, 'budgets', count ?? 0)) {
      return { ok: false, error: upgradeMessage('budgets') };
    }
  }

  const payload = {
    couple_id: ctx.context.couple.id,
    name: String(formData.get('name') ?? '').trim(),
    budget_type: String(formData.get('budget_type') ?? 'household'),
    currency: String(formData.get('currency') ?? ctx.context.couple.currency),
    total_cents: Math.round(Number(formData.get('total') ?? 0) * 100),
    period_start: String(formData.get('period_start') ?? '') || null,
    period_end: String(formData.get('period_end') ?? '') || null,
    split_type: String(formData.get('split_type') ?? 'equal'),
    trip_id: String(formData.get('trip_id') ?? '') || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    created_by: ctx.user.id,
  };

  if (!payload.name) return { ok: false, error: 'Name your budget.' };

  const supabase = createClient();
  const { error } = id
    ? await supabase.from('budgets').update(payload).eq('id', id)
    : await supabase.from('budgets').insert(payload);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Budget saved.' };
}

export async function saveExpenseAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const amount = Number(formData.get('amount') ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }

  const amountCents = Math.round(amount * 100);
  const splitType = String(formData.get('split_type') ?? 'equal');
  const payerId = String(formData.get('paid_by') ?? ctx.user.id);
  const expenseId = String(formData.get('id') ?? '');

  const supabase = createClient();

  const payload = {
    couple_id: ctx.context.couple.id,
    budget_id: String(formData.get('budget_id') ?? '') || null,
    trip_id: String(formData.get('trip_id') ?? '') || null,
    paid_by: payerId,
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    category: String(formData.get('category') ?? 'other'),
    amount_cents: amountCents,
    currency: String(formData.get('currency') ?? ctx.context.couple.currency),
    spent_on: String(formData.get('spent_on') ?? new Date().toISOString().slice(0, 10)),
    split_type: splitType,
    created_by: ctx.user.id,
  };

  if (!payload.title) return { ok: false, error: 'Describe the expense.' };

  const { data, error } = expenseId
    ? await supabase.from('expenses').update(payload).eq('id', expenseId).select('id').single()
    : await supabase.from('expenses').insert(payload).select('id').single();

  if (error) return { ok: false, error: error.message };

  const members = ctx.context.members
    .filter((m) => !m.removed_at)
    .map((m) => ({ userId: m.user_id, incomeShare: m.income_share }));

  const shares = computeShares(amountCents, splitType, members, payerId);

  await supabase.from('expense_shares').delete().eq('expense_id', (data as any).id);
  if (shares.length) {
    await supabase.from('expense_shares').insert(
      shares.map((share) => ({ ...share, expense_id: (data as any).id }))
    );
  }

  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Expense saved.' };
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Deleted.' };
}

export async function saveIncomeAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const amountCents = Math.round(Number(formData.get('amount') ?? 0) * 100);

  const { data: existing } = await supabase
    .from('incomes')
    .select('id')
    .eq('couple_id', ctx.context.couple.id)
    .eq('user_id', ctx.user.id)
    .limit(1)
    .maybeSingle();

  const payload = {
    couple_id: ctx.context.couple.id,
    user_id: ctx.user.id,
    label: String(formData.get('label') ?? 'Primary income'),
    amount_cents: amountCents,
    currency: String(formData.get('currency') ?? ctx.context.couple.currency),
    frequency: String(formData.get('frequency') ?? 'month'),
    is_private: formData.get('is_private') === 'true',
  };

  const { error } = existing
    ? await supabase.from('incomes').update(payload).eq('id', (existing as any).id)
    : await supabase.from('incomes').insert(payload);

  if (error) return { ok: false, error: error.message };

  // Recalculate proportional shares for the space.
  const { data: incomes } = await supabase
    .from('incomes')
    .select('user_id, amount_cents, frequency')
    .eq('couple_id', ctx.context.couple.id);

  const monthly = (row: any) =>
    row.frequency === 'year'
      ? row.amount_cents / 12
      : row.frequency === 'week'
        ? (row.amount_cents * 52) / 12
        : row.amount_cents;

  const total = (incomes ?? []).reduce((sum: number, row: any) => sum + monthly(row), 0);
  if (total > 0) {
    for (const row of incomes ?? []) {
      await supabase
        .from('couple_members')
        .update({ income_share: Math.round((monthly(row) / total) * 10000) / 100 })
        .eq('couple_id', ctx.context.couple.id)
        .eq('user_id', (row as any).user_id);
    }
  }

  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Income saved. Proportional split updated.' };
}

export async function settleUpAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const { error } = await supabase.from('settlements').insert({
    couple_id: ctx.context.couple.id,
    from_user: String(formData.get('from_user') ?? ctx.user.id),
    to_user: String(formData.get('to_user') ?? ''),
    amount_cents: Math.round(Number(formData.get('amount') ?? 0) * 100),
    currency: String(formData.get('currency') ?? ctx.context.couple.currency),
    method: String(formData.get('method') ?? '').trim() || null,
    note: String(formData.get('note') ?? '').trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  await supabase
    .from('expenses')
    .update({ is_settled: true })
    .eq('couple_id', ctx.context.couple.id)
    .eq('is_settled', false);

  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Settled up.' };
}
