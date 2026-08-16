import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { BudgetWorkspace } from '@/components/app/budget-workspace';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Budget', path: '/dashboard/budget', noIndex: true });
}

export default async function BudgetPage() {
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="💸"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const coupleId = context.couple.id;

  const [budgets, expenses, shares, incomes, settlements, trips] = await Promise.all([
    query<any>(
      `SELECT * FROM budgets WHERE couple_id = ? AND archived_at IS NULL ORDER BY created_at DESC`,
      [coupleId]
    ),
    query<any>(`SELECT * FROM expenses WHERE couple_id = ? ORDER BY spent_on DESC LIMIT 200`, [
      coupleId,
    ]),
    query<any>(
      `SELECT s.* FROM expense_shares s
         JOIN expenses e ON e.id = s.expense_id
        WHERE e.couple_id = ? AND e.is_settled = 0`,
      [coupleId]
    ),
    query<any>(`SELECT * FROM incomes WHERE couple_id = ?`, [coupleId]),
    query<any>(`SELECT * FROM settlements WHERE couple_id = ? ORDER BY settled_on DESC LIMIT 20`, [
      coupleId,
    ]),
    query<{ id: string; title: string }>(
      `SELECT id, title FROM trips WHERE couple_id = ? AND status <> 'cancelled'`,
      [coupleId]
    ),
  ]);

  return (
    <BudgetWorkspace
      currency={context.couple.currency}
      budgets={budgets}
      expenses={expenses}
      shares={shares}
      incomes={incomes}
      settlements={settlements}
      trips={trips}
      members={context.members.map((member) => ({
        id: member.user_id,
        name: member.profile?.full_name ?? 'Member',
        incomeShare: member.income_share,
      }))}
      meId={context.me.user_id}
    />
  );
}
