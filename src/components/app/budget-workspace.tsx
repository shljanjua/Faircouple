'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  deleteExpenseAction,
  saveBudgetAction,
  saveExpenseAction,
  saveIncomeAction,
  settleUpAction,
} from '@/app/actions/money';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Field, Input, Progress, Select, Stat, Table, Td, Textarea, Th } from '@/components/ui';
import { CURRENCY_LIST, formatMoney } from '@/lib/currency';
import { formatDate } from '@/lib/utils';

const CATEGORIES = [
  'Rent & housing', 'Groceries', 'Eating out', 'Transport', 'Travel', 'Utilities',
  'Health', 'Subscriptions', 'Gifts', 'Entertainment', 'Childcare', 'Other',
];

const CHART_COLORS = ['#f43f5e', '#c026d3', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#eab308', '#f97316'];

interface Member {
  id: string;
  name: string;
  incomeShare: number | null;
}

export function BudgetWorkspace({
  currency,
  budgets,
  expenses,
  shares,
  incomes,
  settlements,
  trips,
  members,
  meId,
}: {
  currency: string;
  budgets: any[];
  expenses: any[];
  shares: any[];
  incomes: any[];
  settlements: any[];
  trips: any[];
  members: Member[];
  meId: string;
}) {
  const [tab, setTab] = useState<'overview' | 'expenses' | 'budgets' | 'income'>('overview');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthExpenses = useMemo(
    () => expenses.filter((expense) => String(expense.spent_on).startsWith(monthKey)),
    [expenses, monthKey]
  );

  const totals = useMemo(() => {
    const total = monthExpenses.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);
    const byMember = new Map<string, number>();
    for (const expense of monthExpenses) {
      byMember.set(expense.paid_by, (byMember.get(expense.paid_by) ?? 0) + (expense.amount_cents ?? 0));
    }
    const byCategory = new Map<string, number>();
    for (const expense of monthExpenses) {
      byCategory.set(
        expense.category ?? 'Other',
        (byCategory.get(expense.category ?? 'Other') ?? 0) + (expense.amount_cents ?? 0)
      );
    }
    return { total, byMember, byCategory };
  }, [monthExpenses]);

  // Who owes whom, from unsettled shares vs what each person actually paid.
  const balance = useMemo(() => {
    const paid = new Map<string, number>();
    const owed = new Map<string, number>();

    const unsettledIds = new Set(shares.map((share) => share.expense_id));
    for (const expense of expenses) {
      if (!unsettledIds.has(expense.id)) continue;
      paid.set(expense.paid_by, (paid.get(expense.paid_by) ?? 0) + (expense.amount_cents ?? 0));
    }
    for (const share of shares) {
      owed.set(share.user_id, (owed.get(share.user_id) ?? 0) + (share.share_cents ?? 0));
    }

    const net = members.map((member) => ({
      ...member,
      net: (paid.get(member.id) ?? 0) - (owed.get(member.id) ?? 0),
    }));

    const creditor = net.find((m) => m.net > 0);
    const debtor = net.find((m) => m.net < 0);

    return {
      net,
      settlement:
        creditor && debtor
          ? { from: debtor, to: creditor, amount: Math.min(Math.abs(debtor.net), creditor.net) }
          : null,
    };
  }, [shares, expenses, members]);

  const pieData = Array.from(totals.byCategory.entries()).map(([name, value]) => ({
    name,
    value: value / 100,
  }));

  function run(action: () => Promise<any>) {
    startTransition(async () => {
      const result = await action();
      setStatus(
        result?.ok
          ? { ok: true, message: result.message ?? 'Saved.' }
          : { ok: false, message: result?.error ?? 'Something went wrong.' }
      );
      setTimeout(() => setStatus(null), 3000);
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Budget</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fair is not always equal. Split by income, settle in one tap, and keep the money
          conversation scheduled instead of accidental.
        </p>
      </header>

      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}

      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'expenses', label: 'Expenses' },
          { key: 'budgets', label: 'Budgets' },
          { key: 'income', label: 'Income & split' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key as typeof tab)}
            className={
              tab === item.key
                ? 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                : 'rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="This month"
              value={formatMoney(totals.total, currency, { showDecimals: false })}
              hint={`${monthExpenses.length} expenses`}
            />
            {members.map((member) => (
              <Stat
                key={member.id}
                label={`${member.name.split(' ')[0]} paid`}
                value={formatMoney(totals.byMember.get(member.id) ?? 0, currency, {
                  showDecimals: false,
                })}
                hint={
                  member.incomeShare
                    ? `${member.incomeShare}% income share`
                    : 'Add income for a proportional split'
                }
              />
            ))}
            <Stat
              label="Unsettled"
              value={
                balance.settlement
                  ? formatMoney(balance.settlement.amount, currency, { showDecimals: false })
                  : formatMoney(0, currency, { showDecimals: false })
              }
              hint={
                balance.settlement
                  ? `${balance.settlement.from.name.split(' ')[0]} → ${balance.settlement.to.name.split(' ')[0]}`
                  : 'All square'
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-semibold">Where the money went</h2>
              {pieData.length ? (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="45%"
                        outerRadius="75%"
                        paddingAngle={2}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => formatMoney(Number(value) * 100, currency)}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No expenses logged this month.</p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold">Settle up</h2>
              {balance.settlement ? (
                <>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <strong>{balance.settlement.from.name}</strong> owes{' '}
                    <strong>{balance.settlement.to.name}</strong>{' '}
                    {formatMoney(balance.settlement.amount, currency)}.
                  </p>
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      run(() => settleUpAction(formData));
                    }}
                  >
                    <input type="hidden" name="from_user" value={balance.settlement.from.id} />
                    <input type="hidden" name="to_user" value={balance.settlement.to.id} />
                    <input
                      type="hidden"
                      name="amount"
                      value={(balance.settlement.amount / 100).toFixed(2)}
                    />
                    <input type="hidden" name="currency" value={currency} />
                    <Field label="How was it settled?" htmlFor="method">
                      <Input id="method" name="method" placeholder="Bank transfer" />
                    </Field>
                    <Button type="submit" loading={pending}>
                      Mark as settled
                    </Button>
                  </form>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing outstanding — you are square.
                </p>
              )}

              {settlements.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recent settlements
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {settlements.slice(0, 5).map((settlement) => (
                      <li key={settlement.id} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {formatDate(settlement.settled_on)}
                        </span>
                        <span className="font-medium">
                          {formatMoney(settlement.amount_cents, settlement.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Card className="p-5">
            <h2 className="font-semibold">Add an expense</h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                run(async () => {
                  const result = await saveExpenseAction(formData);
                  if (result.ok) form.reset();
                  return result;
                });
              }}
            >
              <Field label="What was it?" required htmlFor="title">
                <Input id="title" name="title" required placeholder="Weekly shop" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount" required htmlFor="amount">
                  <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
                </Field>
                <Field label="Currency" htmlFor="currency">
                  <Select id="currency" name="currency" defaultValue={currency}>
                    {CURRENCY_LIST.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" htmlFor="category">
                  <Select id="category" name="category" defaultValue="Other">
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Date" htmlFor="spent_on">
                  <Input
                    id="spent_on"
                    name="spent_on"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Paid by" htmlFor="paid_by">
                  <Select id="paid_by" name="paid_by" defaultValue={meId}>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Split" htmlFor="split_type">
                  <Select id="split_type" name="split_type" defaultValue="equal">
                    <option value="equal">50 / 50</option>
                    <option value="income">By income</option>
                    <option value="none">Not shared</option>
                  </Select>
                </Field>
              </div>

              {budgets.length > 0 && (
                <Field label="Budget" htmlFor="budget_id">
                  <Select id="budget_id" name="budget_id" defaultValue="">
                    <option value="">— None —</option>
                    {budgets.map((budget) => (
                      <option key={budget.id} value={budget.id}>
                        {budget.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {trips.length > 0 && (
                <Field label="Trip" htmlFor="trip_id">
                  <Select id="trip_id" name="trip_id" defaultValue="">
                    <option value="">— None —</option>
                    {trips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Button type="submit" className="w-full" loading={pending}>
                <Plus className="h-4 w-4" aria-hidden />
                Add expense
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Recent expenses</h2>
            {expenses.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <div className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>What</Th>
                      <Th>Paid by</Th>
                      <Th>Date</Th>
                      <Th className="text-right">Amount</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.slice(0, 40).map((expense) => (
                      <tr key={expense.id}>
                        <Td>
                          <span className="font-medium">{expense.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {expense.category}
                          </span>
                        </Td>
                        <Td className="text-muted-foreground">
                          {members.find((m) => m.id === expense.paid_by)?.name.split(' ')[0] ?? '—'}
                        </Td>
                        <Td className="text-muted-foreground">{formatDate(expense.spent_on)}</Td>
                        <Td className="text-right font-medium tabular-nums">
                          {formatMoney(expense.amount_cents, expense.currency)}
                        </Td>
                        <Td className="text-right">
                          <button
                            type="button"
                            aria-label={`Delete ${expense.title}`}
                            onClick={() => run(() => deleteExpenseAction(expense.id))}
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'budgets' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Card className="p-5">
            <h2 className="font-semibold">New budget</h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                run(async () => {
                  const result = await saveBudgetAction(formData);
                  if (result.ok) form.reset();
                  return result;
                });
              }}
            >
              <Field label="Name" required htmlFor="name">
                <Input id="name" name="name" required placeholder="Monthly household" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type" htmlFor="budget_type">
                  <Select id="budget_type" name="budget_type" defaultValue="household">
                    <option value="household">Household</option>
                    <option value="trip">Trip</option>
                    <option value="event">Event</option>
                    <option value="gift">Gifts</option>
                  </Select>
                </Field>
                <Field label="Total" htmlFor="total">
                  <Input id="total" name="total" type="number" step="0.01" min="0" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From" htmlFor="period_start">
                  <Input id="period_start" name="period_start" type="date" />
                </Field>
                <Field label="To" htmlFor="period_end">
                  <Input id="period_end" name="period_end" type="date" />
                </Field>
              </div>
              <Field label="Split rule" htmlFor="split_type">
                <Select id="split_type" name="split_type" defaultValue="equal">
                  <option value="equal">50 / 50</option>
                  <option value="income">Proportional to income</option>
                </Select>
              </Field>
              <Field label="Notes" htmlFor="notes">
                <Textarea id="notes" name="notes" rows={2} />
              </Field>
              <input type="hidden" name="currency" value={currency} />
              <Button type="submit" className="w-full" loading={pending}>
                Create budget
              </Button>
            </form>
          </Card>

          <div className="space-y-4">
            {budgets.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="font-medium">No budgets yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one for the household and one per trip.
                </p>
              </Card>
            ) : (
              budgets.map((budget) => {
                const spent = expenses
                  .filter((expense) => expense.budget_id === budget.id)
                  .reduce((sum, expense) => sum + (expense.amount_cents ?? 0), 0);
                const percentage = budget.total_cents
                  ? (spent / budget.total_cents) * 100
                  : 0;
                return (
                  <Card key={budget.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{budget.name}</h3>
                        <p className="text-xs capitalize text-muted-foreground">
                          {budget.budget_type} · {budget.split_type} split
                        </p>
                      </div>
                      <Badge tone={percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : 'success'}>
                        {Math.round(percentage)}%
                      </Badge>
                    </div>
                    <Progress
                      value={percentage}
                      className="mt-3"
                      barClassName={percentage > 100 ? 'bg-rose-500' : undefined}
                    />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatMoney(spent, budget.currency)} of{' '}
                      {formatMoney(budget.total_cents, budget.currency)}
                    </p>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'income' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">Your income</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Used only to calculate a proportional split. Mark it private if you would rather your
              partner did not see the figure — the percentage still works.
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                run(() => saveIncomeAction(formData));
              }}
            >
              <Field label="Label" htmlFor="label">
                <Input id="label" name="label" defaultValue="Primary income" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount" required htmlFor="amount">
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={
                      incomes.find((income) => income.user_id === meId)
                        ? (incomes.find((income) => income.user_id === meId)!.amount_cents / 100).toFixed(2)
                        : ''
                    }
                  />
                </Field>
                <Field label="Frequency" htmlFor="frequency">
                  <Select id="frequency" name="frequency" defaultValue="month">
                    <option value="month">Per month</option>
                    <option value="year">Per year</option>
                    <option value="week">Per week</option>
                  </Select>
                </Field>
              </div>
              <input type="hidden" name="currency" value={currency} />
              <Button type="submit" loading={pending}>
                Save income
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Proportional split</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Two people earning different amounts splitting 50/50 are splitting identically, not
              fairly. These percentages leave you both with the same proportion of free income.
            </p>
            <div className="mt-5 space-y-4">
              {members.map((member) => (
                <div key={member.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{member.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {member.incomeShare ? `${member.incomeShare}%` : 'not set'}
                    </span>
                  </div>
                  <Progress value={member.incomeShare ?? 50} className="mt-1.5" />
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
              Example: partners earning 2,000 and 5,000 split a 1,400 rent as 400 / 1,000 — not
              700 / 700.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
