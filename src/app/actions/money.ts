'use server';

import { revalidatePath } from 'next/cache';
import { execute, query, queryOne, uuid } from '@/lib/db';
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
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'Name your budget.' };

  if (!id) {
    const entitlements = await getEntitlements();
    const row = await queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM budgets WHERE couple_id = ? AND archived_at IS NULL`,
      [ctx.context.couple.id]
    );
    if (limitReached(entitlements.limits, 'budgets', Number(row?.total ?? 0))) {
      return { ok: false, error: upgradeMessage('budgets') };
    }
  }

  const values = [
    name,
    String(formData.get('budget_type') ?? 'household'),
    String(formData.get('currency') ?? ctx.context.couple.currency),
    Math.round(Number(formData.get('total') ?? 0) * 100),
    String(formData.get('period_start') ?? '') || null,
    String(formData.get('period_end') ?? '') || null,
    String(formData.get('split_type') ?? 'equal'),
    String(formData.get('trip_id') ?? '') || null,
    String(formData.get('notes') ?? '').trim() || null,
  ];

  const result = id
    ? await execute(
        `UPDATE budgets
            SET name = ?, budget_type = ?, currency = ?, total_cents = ?, period_start = ?,
                period_end = ?, split_type = ?, trip_id = ?, notes = ?
          WHERE id = ? AND couple_id = ?`,
        [...values, id, ctx.context.couple.id]
      )
    : await execute(
        `INSERT INTO budgets
           (id, couple_id, name, budget_type, currency, total_cents, period_start, period_end,
            split_type, trip_id, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ctx.context.couple.id, ...values, ctx.user.id]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the budget.' };
  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Budget saved.' };
}

export async function deleteBudgetAction(budgetId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const result = await execute(`DELETE FROM budgets WHERE id = ? AND couple_id = ?`, [
    budgetId,
    ctx.context.couple.id,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the budget.' };
  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Budget deleted.' };
}

export async function saveExpenseAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const amount = Number(formData.get('amount') ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { ok: false, error: 'Describe the expense.' };

  const amountCents = Math.round(amount * 100);
  const splitType = String(formData.get('split_type') ?? 'equal');
  const payerId = String(formData.get('paid_by') ?? ctx.user.id);
  const expenseId = String(formData.get('id') ?? '');

  const values = [
    String(formData.get('budget_id') ?? '') || null,
    String(formData.get('trip_id') ?? '') || null,
    payerId,
    title,
    String(formData.get('description') ?? '').trim() || null,
    String(formData.get('category') ?? 'other'),
    amountCents,
    String(formData.get('currency') ?? ctx.context.couple.currency),
    String(formData.get('spent_on') ?? new Date().toISOString().slice(0, 10)),
    splitType,
  ];

  let savedId = expenseId;

  if (expenseId) {
    const result = await execute(
      `UPDATE expenses
          SET budget_id = ?, trip_id = ?, paid_by = ?, title = ?, description = ?, category = ?,
              amount_cents = ?, currency = ?, spent_on = ?, split_type = ?
        WHERE id = ? AND couple_id = ?`,
      [...values, expenseId, ctx.context.couple.id]
    );
    if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the expense.' };
  } else {
    savedId = uuid();
    const result = await execute(
      `INSERT INTO expenses
         (id, couple_id, budget_id, trip_id, paid_by, title, description, category,
          amount_cents, currency, spent_on, split_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [savedId, ctx.context.couple.id, ...values, ctx.user.id]
    );
    if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the expense.' };
  }

  const members = ctx.context.members
    .filter((m) => !m.removed_at)
    .map((m) => ({ userId: m.user_id, incomeShare: m.income_share }));

  const shares = computeShares(amountCents, splitType, members, payerId);

  await execute(`DELETE FROM expense_shares WHERE expense_id = ?`, [savedId]);
  for (const share of shares) {
    await execute(
      `INSERT INTO expense_shares (id, expense_id, user_id, share_cents) VALUES (?, ?, ?, ?)`,
      [uuid(), savedId, share.user_id, share.share_cents]
    );
  }

  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Expense saved.' };
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const result = await execute(`DELETE FROM expenses WHERE id = ? AND couple_id = ?`, [
    expenseId,
    ctx.context.couple.id,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete.' };
  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Deleted.' };
}

export async function saveIncomeAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const values = [
    String(formData.get('label') ?? 'Primary income'),
    Math.round(Number(formData.get('amount') ?? 0) * 100),
    String(formData.get('currency') ?? ctx.context.couple.currency),
    String(formData.get('frequency') ?? 'month'),
    formData.get('is_private') === 'true',
  ];

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM incomes WHERE couple_id = ? AND user_id = ? LIMIT 1`,
    [ctx.context.couple.id, ctx.user.id]
  );

  const result = existing
    ? await execute(
        `UPDATE incomes SET label = ?, amount_cents = ?, currency = ?, frequency = ?, is_private = ?
          WHERE id = ? AND user_id = ?`,
        [...values, existing.id, ctx.user.id]
      )
    : await execute(
        `INSERT INTO incomes (id, couple_id, user_id, label, amount_cents, currency, frequency, is_private)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), ctx.context.couple.id, ctx.user.id, ...values]
      );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save your income.' };

  // Recalculate proportional shares for the space.
  const incomes = await query<{ user_id: string; amount_cents: number; frequency: string }>(
    `SELECT user_id, amount_cents, frequency FROM incomes WHERE couple_id = ?`,
    [ctx.context.couple.id]
  );

  const monthly = (row: { amount_cents: number; frequency: string }) =>
    row.frequency === 'year'
      ? row.amount_cents / 12
      : row.frequency === 'week'
        ? (row.amount_cents * 52) / 12
        : row.amount_cents;

  const total = incomes.reduce((sum, row) => sum + monthly(row), 0);
  if (total > 0) {
    for (const row of incomes) {
      await execute(
        `UPDATE couple_members SET income_share = ? WHERE couple_id = ? AND user_id = ?`,
        [
          Math.round((monthly(row) / total) * 10000) / 100,
          ctx.context.couple.id,
          row.user_id,
        ]
      );
    }
  }

  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Income saved. Proportional split updated.' };
}

export async function settleUpAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const toUser = String(formData.get('to_user') ?? '');
  if (!toUser) return { ok: false, error: 'Choose who is being paid.' };

  const result = await execute(
    `INSERT INTO settlements
       (id, couple_id, from_user, to_user, amount_cents, currency, method, note, settled_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [
      uuid(),
      ctx.context.couple.id,
      String(formData.get('from_user') ?? ctx.user.id),
      toUser,
      Math.round(Number(formData.get('amount') ?? 0) * 100),
      String(formData.get('currency') ?? ctx.context.couple.currency),
      String(formData.get('method') ?? '').trim() || null,
      String(formData.get('note') ?? '').trim() || null,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not record the settlement.' };

  await execute(`UPDATE expenses SET is_settled = 1 WHERE couple_id = ? AND is_settled = 0`, [
    ctx.context.couple.id,
  ]);
  await execute(
    `UPDATE expense_shares s
       JOIN expenses e ON e.id = s.expense_id
        SET s.is_settled = 1, s.settled_at = NOW()
      WHERE e.couple_id = ? AND s.is_settled = 0`,
    [ctx.context.couple.id]
  );

  revalidatePath('/dashboard/budget');
  return { ok: true, message: 'Settled up.' };
}
