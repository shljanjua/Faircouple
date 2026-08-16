'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { deletePlanAction, savePlanAction, savePlanPriceAction } from '@/app/actions/admin';
import { ActionButton, AdminForm } from '@/components/admin/form-shell';
import { Button } from '@/components/ui/button';
import { Badge, Card, Field, Input, Select, Table, Td, Textarea, Th } from '@/components/ui';
import { CURRENCY_LIST, formatMoney } from '@/lib/currency';

export function PlansManager({ plans }: { plans: any[] }) {
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Plans &amp; pricing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create packages, set limits and publish prices in every currency you sell in.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New plan
        </Button>
      </header>

      {(creating || editing) && (
        <Card className="p-5">
          <h2 className="font-semibold">{editing ? `Edit ${editing.name}` : 'New plan'}</h2>
          <AdminForm action={savePlanAction} className="mt-4" submitLabel="Save plan">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required htmlFor="name">
                <Input id="name" name="name" required defaultValue={editing?.name ?? ''} />
              </Field>
              <Field label="Slug" required htmlFor="slug">
                <Input id="slug" name="slug" required defaultValue={editing?.slug ?? ''} />
              </Field>
              <Field label="Tagline" htmlFor="tagline">
                <Input id="tagline" name="tagline" defaultValue={editing?.tagline ?? ''} />
              </Field>
              <Field label="Badge" htmlFor="badge" hint="e.g. Most popular">
                <Input id="badge" name="badge" defaultValue={editing?.badge ?? ''} />
              </Field>
              <Field label="Tier" htmlFor="tier" hint="Higher tiers win when comparing plans.">
                <Input id="tier" name="tier" type="number" defaultValue={editing?.tier ?? 0} />
              </Field>
              <Field label="Sort order" htmlFor="sort_order">
                <Input
                  id="sort_order"
                  name="sort_order"
                  type="number"
                  defaultValue={editing?.sort_order ?? 0}
                />
              </Field>
              <Field label="Trial days" htmlFor="trial_days">
                <Input
                  id="trial_days"
                  name="trial_days"
                  type="number"
                  min="0"
                  defaultValue={editing?.trial_days ?? 0}
                />
              </Field>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={editing ? editing.is_active : true}
                    className="h-4 w-4 rounded"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_featured"
                    defaultChecked={editing?.is_featured ?? false}
                    className="h-4 w-4 rounded"
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_free"
                    defaultChecked={editing?.is_free ?? false}
                    className="h-4 w-4 rounded"
                  />
                  Free plan
                </label>
              </div>
              <Field label="Description" htmlFor="description" className="sm:col-span-2">
                <Textarea id="description" name="description" rows={2} defaultValue={editing?.description ?? ''} />
              </Field>
              <Field
                label="Features"
                hint="One per line — shown on the pricing table."
                htmlFor="features"
                className="sm:col-span-2"
              >
                <Textarea
                  id="features"
                  name="features"
                  rows={6}
                  defaultValue={(editing?.features ?? []).join('\n')}
                />
              </Field>
              <Field
                label="Limits (JSON)"
                hint="-1 means unlimited. Keys: couples, emotion_logs, messages, checklists, budgets, trips, itineraries, gifts, documents, storage_mb, history_months, exports, itinerary_generator, advanced_reports, priority_support, remove_ads, custom_categories."
                htmlFor="limits"
                className="sm:col-span-2"
              >
                <Textarea
                  id="limits"
                  name="limits"
                  rows={8}
                  className="font-mono text-xs"
                  defaultValue={JSON.stringify(editing?.limits ?? {}, null, 2)}
                />
              </Field>
            </div>
          </AdminForm>
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => {
              setCreating(false);
              setEditing(null);
            }}
          >
            Close
          </Button>
        </Card>
      )}

      <div className="space-y-5">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  {plan.name}
                  {plan.is_featured && <Badge tone="primary">Featured</Badge>}
                  {!plan.is_active && <Badge tone="danger">Inactive</Badge>}
                  {plan.is_free && <Badge tone="outline">Free</Badge>}
                </h2>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(plan); setCreating(false); }}>
                  Edit
                </Button>
                <ActionButton
                  label="Delete"
                  variant="ghost"
                  confirm="Delete this plan?"
                  action={() => deletePlanAction(plan.id)}
                />
              </div>
            </div>

            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Currency</Th>
                    <Th>Interval</Th>
                    <Th>Price</Th>
                    <Th>Stripe price ID</Th>
                    <Th>PayPal plan ID</Th>
                  </tr>
                </thead>
                <tbody>
                  {(plan.prices ?? [])
                    .sort((a: any, b: any) => a.currency.localeCompare(b.currency))
                    .map((price: any) => (
                      <tr key={price.id}>
                        <Td>{price.currency}</Td>
                        <Td className="capitalize">{price.interval}</Td>
                        <Td className="font-medium">
                          {formatMoney(price.amount_cents, price.currency)}
                        </Td>
                        <Td className="font-mono text-xs text-muted-foreground">
                          {price.stripe_price_id ?? '—'}
                        </Td>
                        <Td className="font-mono text-xs text-muted-foreground">
                          {price.paypal_plan_id ?? '—'}
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Add or update a price
              </summary>
              <AdminForm action={savePlanPriceAction} className="mt-3" submitLabel="Save price">
                <input type="hidden" name="plan_id" value={plan.id} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Currency" htmlFor={`currency-${plan.id}`}>
                    <Select id={`currency-${plan.id}`} name="currency" defaultValue="USD">
                      {CURRENCY_LIST.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.code}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Interval" htmlFor={`interval-${plan.id}`}>
                    <Select id={`interval-${plan.id}`} name="interval" defaultValue="month">
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                      <option value="lifetime">Lifetime</option>
                    </Select>
                  </Field>
                  <Field label="Amount" htmlFor={`amount-${plan.id}`}>
                    <Input id={`amount-${plan.id}`} name="amount" type="number" step="0.01" min="0" />
                  </Field>
                  <Field label="Compare-at price" htmlFor={`compare-${plan.id}`}>
                    <Input id={`compare-${plan.id}`} name="compare_at" type="number" step="0.01" min="0" />
                  </Field>
                  <Field label="Stripe price ID" htmlFor={`stripe-${plan.id}`}>
                    <Input id={`stripe-${plan.id}`} name="stripe_price_id" placeholder="price_..." />
                  </Field>
                  <Field label="PayPal plan ID" htmlFor={`paypal-${plan.id}`}>
                    <Input id={`paypal-${plan.id}`} name="paypal_plan_id" placeholder="P-..." />
                  </Field>
                </div>
              </AdminForm>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
