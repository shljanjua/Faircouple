'use client';

import { useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, Luggage, Sparkles, Trash2, Wand2 } from 'lucide-react';
import {
  addPackingItemAction,
  createPackingListAction,
  deleteItineraryItemAction,
  generateItineraryAction,
  togglePackingItemAction,
  toggleItineraryItemAction,
} from '@/app/actions/travel';
import { Button, ButtonLink } from '@/components/ui/button';
import { Alert, Badge, Card, Field, Input, Progress, Select } from '@/components/ui';
import { INTEREST_OPTIONS } from '@/lib/itinerary';
import { formatMoney } from '@/lib/currency';
import { cn, formatDate } from '@/lib/utils';

const ITEM_ICONS: Record<string, string> = {
  activity: '📍',
  meal: '🍽️',
  transport: '🚕',
  hotel: '🏨',
  flight: '✈️',
  rest: '😴',
  shopping: '🛍️',
  free_time: '🌤️',
};

export function TripWorkspace({
  trip,
  itinerary,
  documents,
  packingLists,
  expenses,
  templates,
  members,
  canGenerate,
}: {
  trip: any;
  itinerary: any | null;
  documents: any[];
  packingLists: any[];
  expenses: any[];
  templates: any[];
  members: { id: string; name: string }[];
  canGenerate: boolean;
}) {
  const [tab, setTab] = useState<'itinerary' | 'packing' | 'documents' | 'budget'>('itinerary');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [interests, setInterests] = useState<string[]>(['romance', 'food']);

  const spent = expenses.reduce((sum, expense) => sum + (expense.amount_cents ?? 0), 0);

  function run(action: () => Promise<any>) {
    startTransition(async () => {
      const result = await action();
      if (result) {
        setStatus(
          result.ok
            ? { ok: true, message: result.message ?? 'Done.' }
            : { ok: false, message: result.error }
        );
        setTimeout(() => setStatus(null), 4000);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        {(trip.cover_image || trip.destination?.hero_image) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${trip.cover_image || trip.destination?.hero_image}?auto=format&fit=crop&w=1400&q=70`}
            alt=""
            className="h-48 w-full object-cover sm:h-60"
          />
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold">{trip.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {trip.destination?.country?.flag_emoji} {trip.destination?.name ?? 'Destination TBC'}
                {trip.start_date && ` · ${formatDate(trip.start_date)}`}
                {trip.end_date && ` → ${formatDate(trip.end_date)}`}
              </p>
            </div>
            <Badge tone={trip.status === 'completed' ? 'success' : 'info'}>{trip.status}</Badge>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Travellers</dt>
              <dd className="font-medium">{trip.travelers}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Budget</dt>
              <dd className="font-medium">
                {trip.budget_cents ? formatMoney(trip.budget_cents, trip.currency, { showDecimals: false }) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Spent</dt>
              <dd className="font-medium">{formatMoney(spent, trip.currency, { showDecimals: false })}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Bookings</dt>
              <dd className="font-medium">{documents.length}</dd>
            </div>
          </dl>

          {trip.budget_cents ? (
            <Progress
              value={(spent / trip.budget_cents) * 100}
              className="mt-4"
              barClassName={spent > trip.budget_cents ? 'bg-rose-500' : undefined}
            />
          ) : null}

          {trip.destination?.slug && (
            <ButtonLink
              href={`/destinations/${trip.destination.slug}`}
              variant="outline"
              size="sm"
              className="mt-5"
            >
              Read the {trip.destination.name} guide
            </ButtonLink>
          )}
        </div>
      </Card>

      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}

      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          { key: 'itinerary', label: 'Itinerary' },
          { key: 'packing', label: 'Packing' },
          { key: 'documents', label: 'Bookings' },
          { key: 'budget', label: 'Costs' },
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

      {tab === 'itinerary' && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Wand2 className="h-4 w-4 text-primary" aria-hidden />
              Itinerary generator
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Builds a day-by-day plan from the destination&apos;s attractions, matched to your pace
              and interests. Regenerating replaces the previous generated plan.
            </p>

            {!canGenerate ? (
              <Alert tone="warning" className="mt-4">
                The generator is available on Essential and above.{' '}
                <Link href="/pricing" className="font-medium underline">
                  Compare plans
                </Link>
              </Alert>
            ) : !trip.destination ? (
              <Alert tone="warning" className="mt-4">
                Pick a destination for this trip first — the generator uses its attraction list.
              </Alert>
            ) : (
              <form
                className="mt-4 space-y-4"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  formData.set('interests', interests.join(','));
                  run(() => generateItineraryAction(formData));
                }}
              >
                <input type="hidden" name="trip_id" value={trip.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Days" htmlFor="days">
                    <Input
                      id="days"
                      name="days"
                      type="number"
                      min="1"
                      max="21"
                      defaultValue={trip.destination?.ideal_days ?? 5}
                    />
                  </Field>
                  <Field label="Pace" htmlFor="pace">
                    <Select id="pace" name="pace" defaultValue="balanced">
                      <option value="relaxed">Relaxed — 2 things a day</option>
                      <option value="balanced">Balanced — 3 things a day</option>
                      <option value="packed">Packed — 5 things a day</option>
                    </Select>
                  </Field>
                </div>

                <fieldset>
                  <legend className="text-sm font-medium">Interests</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setInterests((prev) =>
                            prev.includes(option.value)
                              ? prev.filter((value) => value !== option.value)
                              : [...prev, option.value]
                          )
                        }
                        aria-pressed={interests.includes(option.value)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm transition-colors',
                          interests.includes(option.value)
                            ? 'border-primary bg-primary/10 font-medium text-primary'
                            : 'border-border hover:bg-secondary'
                        )}
                      >
                        {option.emoji} {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="include_meals" value="true" defaultChecked className="h-4 w-4 rounded" />
                  Include meal slots
                </label>

                <Button type="submit" loading={pending}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {itinerary ? 'Regenerate itinerary' : 'Generate itinerary'}
                </Button>
              </form>
            )}
          </Card>

          {itinerary ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{itinerary.title}</h2>
                <span className="text-sm text-muted-foreground">
                  Estimated {formatMoney(itinerary.total_cost_cents ?? 0, itinerary.currency)}
                </span>
              </div>

              {(itinerary.days ?? []).map((day: any) => (
                <Card key={day.id} className="p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">
                      Day {day.day_number}
                      {day.title ? ` — ${day.title}` : ''}
                    </h3>
                    {day.day_date && (
                      <span className="text-xs text-muted-foreground">{formatDate(day.day_date)}</span>
                    )}
                  </div>
                  {day.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{day.summary}</p>
                  )}

                  <ul className="mt-4 space-y-2">
                    {(day.items ?? []).map((item: any) => (
                      <li
                        key={item.id}
                        className="group flex items-start gap-3 rounded-lg border border-border p-3"
                      >
                        <input
                          type="checkbox"
                          defaultChecked={item.is_done}
                          onChange={(event) =>
                            run(() => toggleItineraryItemAction(item.id, event.target.checked))
                          }
                          className="mt-1 h-4 w-4 shrink-0 rounded border-input text-primary"
                          aria-label={item.title}
                        />
                        <span className="shrink-0 text-lg" aria-hidden>
                          {ITEM_ICONS[item.item_type] ?? '📍'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-medium', item.is_done && 'line-through opacity-60')}>
                            {item.start_time?.slice(0, 5)} {item.title}
                          </p>
                          {item.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        {item.cost_cents ? (
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {formatMoney(item.cost_cents, item.currency ?? trip.currency)}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`Remove ${item.title}`}
                          onClick={() => run(() => deleteItineraryItemAction(item.id))}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-medium">No itinerary yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate one above, or add days manually.
              </p>
            </Card>
          )}
        </div>
      )}

      {tab === 'packing' && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Luggage className="h-4 w-4 text-primary" aria-hidden />
              Add a packing list
            </h2>
            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                formData.set('trip_id', trip.id);
                run(() => createPackingListAction(formData));
              }}
            >
              <Select name="template_id" defaultValue="" className="flex-1">
                <option value="">— Empty list —</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.emoji} {template.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" loading={pending}>
                Add list
              </Button>
            </form>
          </Card>

          {packingLists.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No packing lists yet — start from a climate template above.
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {packingLists.map((list) => (
                <PackingListCard
                  key={list.id}
                  list={list}
                  members={members}
                  onChange={run}
                  pending={pending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Bookings for this trip</h2>
            <ButtonLink href="/dashboard/documents" size="sm" variant="outline">
              Open the vault
            </ButtonLink>
          </div>
          {documents.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No documents attached yet. Upload flight tickets, hotel confirmations and attraction
              passes in the vault, then link them to this trip.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {doc.doc_type.replace(/_/g, ' ')}
                      {doc.confirmation_code && ` · ${doc.confirmation_code}`}
                    </p>
                  </div>
                  {doc.depart_at && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(doc.depart_at)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'budget' && (
        <Card className="p-5">
          <h2 className="font-semibold">Trip costs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Expenses tagged to this trip. Add them from the Budget page and pick this trip.
          </p>
          {expenses.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {expenses.map((expense) => (
                <li key={expense.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                  <span>
                    {expense.title}
                    <span className="ml-2 text-xs text-muted-foreground">{expense.category}</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(expense.amount_cents, expense.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="font-medium">Total</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMoney(spent, trip.currency)}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

function PackingListCard({
  list,
  members,
  onChange,
  pending,
}: {
  list: any;
  members: { id: string; name: string }[];
  onChange: (action: () => Promise<any>) => void;
  pending: boolean;
}) {
  const [newItem, setNewItem] = useState('');
  const packed = list.items.filter((item: any) => item.is_packed).length;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{list.name}</h3>
        <Badge tone={packed === list.items.length && list.items.length > 0 ? 'success' : 'outline'}>
          {packed}/{list.items.length}
        </Badge>
      </div>
      <Progress
        value={list.items.length ? (packed / list.items.length) * 100 : 0}
        className="mt-3"
      />

      <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto pr-1">
        {list.items.map((item: any) => (
          <li key={item.id} className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-secondary/60">
            <input
              type="checkbox"
              defaultChecked={item.is_packed}
              onChange={(event) => onChange(() => togglePackingItemAction(item.id, event.target.checked))}
              className="h-4 w-4 shrink-0 rounded border-input text-primary"
              aria-label={item.name}
            />
            <span className={cn('min-w-0 flex-1 text-sm', item.is_packed && 'line-through opacity-60')}>
              {item.name}
              {item.quantity > 1 && <span className="text-muted-foreground"> ×{item.quantity}</span>}
            </span>
            {item.is_essential && !item.is_packed && <Badge tone="warning">essential</Badge>}
            {item.assigned_to && (
              <Badge tone="info">
                {members.find((m) => m.id === item.assigned_to)?.name.split(' ')[0] ?? 'assigned'}
              </Badge>
            )}
          </li>
        ))}
      </ul>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!newItem.trim()) return;
          const formData = new FormData();
          formData.set('list_id', list.id);
          formData.set('name', newItem.trim());
          onChange(() => addPackingItemAction(formData));
          setNewItem('');
        }}
      >
        <Input
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
          placeholder="Add an item…"
          aria-label={`Add an item to ${list.name}`}
        />
        <Button type="submit" variant="outline" size="icon" loading={pending} aria-label="Add">
          <Check className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </Card>
  );
}
