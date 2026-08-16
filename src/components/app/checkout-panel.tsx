'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Select } from '@/components/ui';
import { CURRENCY_LIST, formatMoney, normalizeCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import type { Plan, PlanPrice } from '@/types';

export function CheckoutPanel({
  plan,
  currency: initialCurrency,
  interval: initialInterval,
  stripeEnabled,
  paypalEnabled,
}: {
  plan: Plan & { prices: PlanPrice[] };
  currency: string;
  interval: string;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
}) {
  const [currency, setCurrency] = useState(normalizeCurrency(initialCurrency));
  const [interval, setInterval] = useState(initialInterval);
  const [provider, setProvider] = useState<'stripe' | 'paypal'>(
    stripeEnabled ? 'stripe' : 'paypal'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableIntervals = useMemo(
    () =>
      Array.from(
        new Set(
          plan.prices.filter((price) => price.currency === currency).map((price) => price.interval)
        )
      ),
    [plan.prices, currency]
  );

  const price = useMemo(
    () =>
      plan.prices.find((row) => row.currency === currency && row.interval === interval) ??
      plan.prices.find((row) => row.currency === currency) ??
      null,
    [plan.prices, currency, interval]
  );

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: plan.slug,
          currency,
          interval: price?.interval ?? interval,
          provider,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Checkout could not be started.');
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      throw new Error('No checkout URL was returned.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
      setLoading(false);
    }
  }

  const noGateways = !stripeEnabled && !paypalEnabled;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Complete your subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One payment covers both partners. Cancel any time from Billing.
        </p>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      {noGateways && (
        <Alert tone="warning" title="Payments are not configured yet">
          An administrator needs to add Stripe or PayPal credentials in Admin → Payments before
          checkout can run.
        </Alert>
      )}

      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{plan.name}</h2>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
            </div>
            {plan.badge && <Badge tone="primary">{plan.badge}</Badge>}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Billing period</span>
              <Select value={interval} onChange={(event) => setInterval(event.target.value)}>
                {availableIntervals.map((value) => (
                  <option key={value} value={value}>
                    {value === 'month' ? 'Monthly' : value === 'year' ? 'Yearly' : 'One-time'}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Currency</span>
              <Select
                value={currency}
                onChange={(event) => setCurrency(normalizeCurrency(event.target.value))}
              >
                {CURRENCY_LIST.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.code}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium">Payment method</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!stripeEnabled}
                onClick={() => setProvider('stripe')}
                aria-pressed={provider === 'stripe'}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-40',
                  provider === 'stripe' ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                )}
              >
                <CreditCard className="h-5 w-5" aria-hidden />
                <span>
                  <span className="block font-medium">Card</span>
                  <span className="text-xs text-muted-foreground">
                    Visa, Mastercard, Amex, Apple&nbsp;Pay
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={!paypalEnabled}
                onClick={() => setProvider('paypal')}
                aria-pressed={provider === 'paypal'}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-40',
                  provider === 'paypal' ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                )}
              >
                <span className="text-lg font-bold text-[#003087]" aria-hidden>
                  P
                </span>
                <span>
                  <span className="block font-medium">PayPal</span>
                  <span className="text-xs text-muted-foreground">Pay with your PayPal balance</span>
                </span>
              </button>
            </div>
          </fieldset>

          <ul className="mt-6 space-y-2 text-sm">
            {(plan.features ?? []).slice(0, 6).map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="font-semibold">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium">{plan.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Billing</dt>
              <dd className="font-medium capitalize">{price?.interval ?? interval}</dd>
            </div>
            {plan.trial_days > 0 && price?.interval !== 'lifetime' && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Free trial</dt>
                <dd className="font-medium">{plan.trial_days} days</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <dt className="font-medium">Total today</dt>
              <dd className="font-bold">
                {price
                  ? plan.trial_days > 0 && price.interval !== 'lifetime'
                    ? formatMoney(0, currency)
                    : formatMoney(price.amount_cents, currency)
                  : '—'}
              </dd>
            </div>
            {price && plan.trial_days > 0 && price.interval !== 'lifetime' && (
              <p className="text-xs text-muted-foreground">
                Then {formatMoney(price.amount_cents, currency)} per {price.interval}.
              </p>
            )}
          </dl>

          <Button
            className="mt-5 w-full"
            size="lg"
            loading={loading}
            disabled={!price || noGateways}
            onClick={startCheckout}
          >
            <Lock className="h-4 w-4" aria-hidden />
            Continue to payment
          </Button>

          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Payment details never touch our servers. 14-day money-back guarantee.
          </p>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            <Link href="/pricing" className="underline">
              Back to plans
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
