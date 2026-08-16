'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { ExternalLink, Gift, Plus, Trash2 } from 'lucide-react';
import { deleteGiftAction, saveGiftAction, saveWishlistItemAction } from '@/app/actions/entries';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { formatMoney } from '@/lib/currency';
import { formatDate } from '@/lib/utils';

const OCCASIONS = [
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'anniversary', label: '💍 Anniversary' },
  { value: 'valentines', label: '❤️ Valentine’s' },
  { value: 'christmas', label: '🎄 Christmas' },
  { value: 'wedding', label: '💒 Wedding' },
  { value: 'engagement', label: '💐 Engagement' },
  { value: 'mothers_day', label: '🌷 Mother’s Day' },
  { value: 'fathers_day', label: '👔 Father’s Day' },
  { value: 'just_because', label: '✨ Just because' },
  { value: 'apology', label: '🙏 Apology' },
  { value: 'other', label: '🎁 Other' },
];

const STATUSES = ['idea', 'planned', 'purchased', 'wrapped', 'given', 'received'];

export function GiftsWorkspace({
  gifts,
  wishlist,
  currency,
  meId,
  members,
  hiddenCount,
}: {
  gifts: any[];
  wishlist: any[];
  currency: string;
  meId: string;
  members: { id: string; name: string }[];
  hiddenCount: number;
}) {
  const [tab, setTab] = useState<'gifts' | 'wishlist'>('gifts');
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const balance = useMemo(() => {
    const given = new Map<string, number>();
    for (const gift of gifts) {
      if (!['given', 'received'].includes(gift.status)) continue;
      given.set(gift.from_user, (given.get(gift.from_user) ?? 0) + 1);
    }
    return members.map((member) => ({ ...member, count: given.get(member.id) ?? 0 }));
  }, [gifts, members]);

  function run(action: () => Promise<any>, form?: HTMLFormElement) {
    startTransition(async () => {
      const result = await action();
      setStatus(
        result?.ok
          ? { ok: true, message: result.message ?? 'Saved.' }
          : { ok: false, message: result?.error ?? 'Something went wrong.' }
      );
      if (result?.ok && form) form.reset();
      setTimeout(() => setStatus(null), 3000);
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Gifts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gifts should be mutual, not a one-sided expectation. Surprises stay hidden from your
            partner until you mark them given.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add a gift
        </Button>
      </header>

      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}
      {hiddenCount > 0 && (
        <Alert tone="info">
          {hiddenCount} surprise {hiddenCount === 1 ? 'gift is' : 'gifts are'} hidden from you — your
          partner will reveal them.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {balance.map((member) => (
          <Card key={member.id} className="flex items-center justify-between p-4">
            <span className="text-sm font-medium">{member.name} has given</span>
            <span className="text-2xl font-bold tabular-nums">{member.count}</span>
          </Card>
        ))}
      </div>

      <div className="flex gap-2" role="tablist">
        {[
          { key: 'gifts', label: 'Gift tracker' },
          { key: 'wishlist', label: 'Wishlists' },
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

      {showForm && tab === 'gifts' && (
        <Card className="p-5">
          <h2 className="font-semibold">New gift</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = event.currentTarget;
              run(() => saveGiftAction(new FormData(form)), form);
            }}
          >
            <Field label="What is it?" required htmlFor="title" className="sm:col-span-2">
              <Input id="title" name="title" required placeholder="Weekend in Bruges" />
            </Field>
            <Field label="For" htmlFor="to_user">
              <Select id="to_user" name="to_user" defaultValue={members.find((m) => m.id !== meId)?.id ?? ''}>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Occasion" htmlFor="occasion">
              <Select id="occasion" name="occasion" defaultValue="just_because">
                {OCCASIONS.map((occasion) => (
                  <option key={occasion.value} value={occasion.value}>
                    {occasion.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Budget" htmlFor="amount">
              <Input id="amount" name="amount" type="number" step="0.01" min="0" />
            </Field>
            <Field label="Date" htmlFor="occasion_date">
              <Input id="occasion_date" name="occasion_date" type="date" />
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue="idea">
                {STATUSES.map((value) => (
                  <option key={value} value={value} className="capitalize">
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Link" htmlFor="url">
              <Input id="url" name="url" type="url" placeholder="https://" />
            </Field>
            <Field label="Notes" htmlFor="description" className="sm:col-span-2">
              <Textarea id="description" name="description" rows={2} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="is_surprise" value="true" defaultChecked className="h-4 w-4 rounded" />
              Keep it a surprise until I mark it given
            </label>
            <input type="hidden" name="currency" value={currency} />
            <div className="sm:col-span-2">
              <Button type="submit" loading={pending}>
                Save gift
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'gifts' ? (
        gifts.length === 0 ? (
          <Card className="p-10 text-center">
            <Gift className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">No gifts tracked yet</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gifts.map((gift) => (
              <Card key={gift.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{gift.title}</h3>
                  <Badge
                    tone={
                      gift.status === 'given' || gift.status === 'received'
                        ? 'success'
                        : gift.status === 'idea'
                          ? 'outline'
                          : 'info'
                    }
                  >
                    {gift.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {gift.occasion.replace(/_/g, ' ')}
                  {gift.occasion_date && ` · ${formatDate(gift.occasion_date)}`}
                </p>
                {gift.description && (
                  <p className="mt-3 flex-1 text-sm text-muted-foreground">{gift.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {gift.amount_cents
                      ? formatMoney(gift.amount_cents, gift.currency ?? currency)
                      : '—'}
                  </span>
                  <div className="flex items-center gap-1">
                    {gift.url && (
                      <a
                        href={gift.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open link"
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                    {gift.created_by === meId && (
                      <button
                        type="button"
                        aria-label={`Delete ${gift.title}`}
                        onClick={() => run(() => deleteGiftAction(gift.id))}
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Card className="p-5">
            <h2 className="font-semibold">Add to your wishlist</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your partner can see this — that is the point.
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = event.currentTarget;
                run(() => saveWishlistItemAction(new FormData(form)), form);
              }}
            >
              <Field label="What would you love?" required htmlFor="wl-title">
                <Input id="wl-title" name="title" required />
              </Field>
              <Field label="Link" htmlFor="wl-url">
                <Input id="wl-url" name="url" type="url" placeholder="https://" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Approx. price" htmlFor="wl-price">
                  <Input id="wl-price" name="price" type="number" step="0.01" min="0" />
                </Field>
                <Field label="Priority" htmlFor="wl-priority">
                  <Select id="wl-priority" name="priority" defaultValue="normal">
                    <option value="low">Nice to have</option>
                    <option value="normal">Would love it</option>
                    <option value="high">Really want it</option>
                    <option value="dream">Dream item</option>
                  </Select>
                </Field>
              </div>
              <Button type="submit" loading={pending}>
                Add to wishlist
              </Button>
            </form>
          </Card>

          <div className="space-y-3">
            {wishlist.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                No wishlist items yet.
              </Card>
            ) : (
              wishlist.map((item) => (
                <Card key={item.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {members.find((m) => m.id === item.user_id)?.name ?? 'Member'} ·{' '}
                      <span className="capitalize">{item.priority}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {item.price_cents && (
                      <span className="text-sm font-medium">
                        {formatMoney(item.price_cents, item.currency ?? currency)}
                      </span>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${item.title}`}
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
