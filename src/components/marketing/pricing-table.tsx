'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { buttonClasses } from '@/components/ui/button';
import { CURRENCY_LIST, formatMoney, normalizeCurrency, type CurrencyCode } from '@/lib/currency';
import { cn } from '@/lib/utils';
import type { Plan, PlanPrice } from '@/types';

type Interval = 'month' | 'year';

interface Props {
  plans: (Plan & { prices: PlanPrice[] })[];
  defaultCurrency?: string;
  currentPlanSlug?: string | null;
  signedIn?: boolean;
}

export function PricingTable({ plans, defaultCurrency, currentPlanSlug, signedIn }: Props) {
  const [currency, setCurrency] = useState<CurrencyCode>(normalizeCurrency(defaultCurrency));
  const [interval, setInterval] = useState<Interval>('year');

  const sorted = useMemo(
    () => [...plans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [plans]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <div className="inline-flex rounded-lg border border-border bg-card p-1" role="group" aria-label="Billing interval">
          {(['month', 'year'] as Interval[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              aria-pressed={interval === value}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                interval === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {value === 'month' ? 'Monthly' : 'Yearly'}
              {value === 'year' && (
                <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Save 17%
                </span>
              )}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Currency</span>
          <select
            value={currency}
            onChange={(event) => setCurrency(normalizeCurrency(event.target.value))}
            aria-label="Billing currency"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CURRENCY_LIST.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {sorted.map((plan) => {
          const lifetime = plan.prices?.find(
            (p) => p.currency === currency && p.interval === 'lifetime'
          );
          const price =
            lifetime ??
            plan.prices?.find((p) => p.currency === currency && p.interval === interval);

          const monthlyEquivalent =
            price && price.interval === 'year' ? Math.round(price.amount_cents / 12) : null;
          const isCurrent = currentPlanSlug === plan.slug;

          const href = signedIn
            ? plan.is_free
              ? '/dashboard'
              : `/checkout?plan=${plan.slug}&currency=${currency}&interval=${price?.interval ?? interval}`
            : `/signup?plan=${plan.slug}&currency=${currency}&interval=${price?.interval ?? interval}`;

          return (
            <Card
              key={plan.id}
              id={plan.slug}
              className={cn(
                'relative flex flex-col p-6',
                plan.is_featured && 'border-primary shadow-lg ring-1 ring-primary/20'
              )}
            >
              {plan.badge && (
                <Badge
                  tone={plan.is_featured ? 'primary' : 'default'}
                  className="absolute -top-3 left-6"
                >
                  {plan.badge}
                </Badge>
              )}

              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 min-h-[40px] text-sm text-muted-foreground">{plan.tagline}</p>

              <div className="mt-5">
                {price ? (
                  <>
                    <span className="text-4xl font-bold tabular-nums">
                      {formatMoney(price.amount_cents, currency, {
                        showDecimals: price.amount_cents % 100 !== 0,
                      })}
                    </span>
                    <span className="ml-1 text-sm text-muted-foreground">
                      {price.interval === 'lifetime'
                        ? 'one-time'
                        : price.interval === 'year'
                          ? '/year'
                          : '/month'}
                    </span>
                    {monthlyEquivalent !== null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatMoney(monthlyEquivalent, currency)} per month, billed yearly
                      </p>
                    )}
                    {price.compare_at_cents ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <s>{formatMoney(price.compare_at_cents, currency, { showDecimals: false })}</s>{' '}
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          save{' '}
                          {formatMoney(price.compare_at_cents - price.amount_cents, currency, {
                            showDecimals: false,
                          })}
                        </span>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <span className="text-2xl font-bold">Contact us</span>
                )}
              </div>

              <Link
                href={href}
                className={buttonClasses(
                  plan.is_featured ? 'primary' : 'outline',
                  'md',
                  'mt-6 w-full'
                )}
                aria-disabled={isCurrent}
              >
                {isCurrent
                  ? 'Your current plan'
                  : plan.is_free
                    ? 'Start free'
                    : plan.trial_days > 0
                      ? `Start ${plan.trial_days}-day trial`
                      : 'Get started'}
              </Link>

              <ul className="mt-6 space-y-2.5 text-sm">
                {(plan.features ?? []).map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.is_free && (
                <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
                  <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Includes ads and a 1-month history window.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Prices include applicable taxes at checkout. Paying once covers <strong>both partners</strong>.
        14-day money-back guarantee on first purchases.
      </p>
    </div>
  );
}
