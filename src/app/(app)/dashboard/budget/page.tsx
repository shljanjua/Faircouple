import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = createClient();
  const monthStart = new Date();
  monthStart.setDate(1);

  const [{ data: budgets }, { data: expenses }, { data: shares }, { data: incomes }, { data: settlements }, { data: trips }] =
    await Promise.all([
      supabase
        .from('budgets')
        .select('*')
        .eq('couple_id', context.couple.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .eq('couple_id', context.couple.id)
        .order('spent_on', { ascending: false })
        .limit(200),
      supabase
        .from('expense_shares')
        .select('*, expense:expenses!inner(couple_id, is_settled)')
        .eq('expense.couple_id', context.couple.id)
        .eq('expense.is_settled', false),
      supabase.from('incomes').select('*').eq('couple_id', context.couple.id),
      supabase
        .from('settlements')
        .select('*')
        .eq('couple_id', context.couple.id)
        .order('settled_on', { ascending: false })
        .limit(20),
      supabase
        .from('trips')
        .select('id, title')
        .eq('couple_id', context.couple.id)
        .neq('status', 'cancelled'),
    ]);

  return (
    <BudgetWorkspace
      currency={context.couple.currency}
      budgets={(budgets ?? []) as any[]}
      expenses={(expenses ?? []) as any[]}
      shares={(shares ?? []) as any[]}
      incomes={(incomes ?? []) as any[]}
      settlements={(settlements ?? []) as any[]}
      trips={(trips ?? []) as any[]}
      members={context.members.map((member) => ({
        id: member.user_id,
        name: member.profile?.full_name ?? 'Member',
        incomeShare: member.income_share,
      }))}
      meId={context.me.user_id}
    />
  );
}
