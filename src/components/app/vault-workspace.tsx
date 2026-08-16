'use client';

import { useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { Download, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  deleteTravelDocumentAction,
  getDocumentUrlAction,
  saveTravelDocumentAction,
} from '@/app/actions/vault';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { CURRENCY_LIST, formatMoney } from '@/lib/currency';
import { formatDate, formatDateTime } from '@/lib/utils';

const DOC_TYPES = [
  { value: 'flight', label: '✈️ Flight ticket' },
  { value: 'hotel', label: '🏨 Hotel booking' },
  { value: 'train', label: '🚆 Train ticket' },
  { value: 'bus', label: '🚌 Bus ticket' },
  { value: 'car_rental', label: '🚗 Car rental' },
  { value: 'cruise', label: '🛳️ Cruise' },
  { value: 'attraction', label: '🎟️ Attraction ticket' },
  { value: 'restaurant', label: '🍽️ Restaurant booking' },
  { value: 'insurance', label: '🛡️ Travel insurance' },
  { value: 'visa', label: '🛂 Visa / ESTA' },
  { value: 'passport', label: '📕 Passport' },
  { value: 'vaccination', label: '💉 Vaccination certificate' },
  { value: 'other', label: '📄 Other' },
];

export function VaultWorkspace({
  coupleId,
  meId,
  documents,
  trips,
  currency,
}: {
  coupleId: string;
  meId: string;
  documents: any[];
  trips: { id: string; title: string }[];
  currency: string;
}) {
  const supabase = getBrowserClient();
  const [showForm, setShowForm] = useState(documents.length === 0);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{
    path: string;
    name: string;
    mime: string;
    size: number;
  } | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [filter, setFilter] = useState('all');
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const upcoming = useMemo(
    () =>
      documents
        .filter((doc) => doc.depart_at && new Date(doc.depart_at) > new Date())
        .slice(0, 3),
    [documents]
  );

  const visible = useMemo(
    () => (filter === 'all' ? documents : documents.filter((doc) => doc.doc_type === filter)),
    [documents, filter]
  );

  async function uploadFile(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      setStatus({ ok: false, message: 'Files must be under 50 MB.' });
      return;
    }
    setUploading(true);
    const extension = file.name.split('.').pop() ?? 'pdf';
    const path = `${coupleId}/${meId}/${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from('documents').upload(path, file, {
      cacheControl: '3600',
    });

    setUploading(false);
    if (error) {
      setStatus({ ok: false, message: error.message });
      return;
    }
    setUploaded({ path, name: file.name, mime: file.type, size: file.size });
    setStatus({ ok: true, message: `${file.name} uploaded — now add the details.` });
  }

  async function open(path: string) {
    const result = await getDocumentUrlAction(path);
    if (result.ok && result.data) {
      window.open(result.data as string, '_blank', 'noopener,noreferrer');
    } else if (!result.ok) {
      setStatus({ ok: false, message: result.error });
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Ticket vault</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Flight tickets, hotel confirmations, attraction passes, insurance and visas — both of you
            can reach them, even offline on your phone.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add a document
        </Button>
      </header>

      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}

      {upcoming.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">Coming up</h2>
          <ul className="mt-3 space-y-2">
            {upcoming.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">
                  <strong>{doc.title}</strong>
                  {doc.origin && doc.destination && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {doc.origin} → {doc.destination}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-muted-foreground">{formatDateTime(doc.depart_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showForm && (
        <Card className="p-5">
          <h2 className="font-semibold">New document</h2>

          <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-center">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
                event.target.value = '';
              }}
            />
            {uploaded ? (
              <p className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-emerald-500" aria-hidden />
                {uploaded.name}
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setUploaded(null)}
                >
                  replace
                </button>
              </p>
            ) : (
              <Button variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
                <Upload className="h-4 w-4" aria-hidden />
                Upload PDF or photo
              </Button>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              PDF, JPG, PNG or Word. Up to 50 MB. Stored privately to your space.
            </p>
          </div>

          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              if (uploaded) {
                formData.set('file_path', uploaded.path);
                formData.set('file_name', uploaded.name);
                formData.set('file_mime', uploaded.mime);
                formData.set('file_size', String(uploaded.size));
              }
              startTransition(async () => {
                const result = await saveTravelDocumentAction(formData);
                setStatus(
                  result.ok
                    ? { ok: true, message: result.message ?? 'Saved.' }
                    : { ok: false, message: result.error }
                );
                if (result.ok) {
                  form.reset();
                  setUploaded(null);
                  setShowForm(false);
                }
              });
            }}
          >
            <Field label="Title" required htmlFor="title" className="sm:col-span-2">
              <Input id="title" name="title" required placeholder="BA2551 London → Naples" />
            </Field>

            <Field label="Type" htmlFor="doc_type">
              <Select id="doc_type" name="doc_type" defaultValue="flight">
                {DOC_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Trip" htmlFor="trip_id">
              <Select id="trip_id" name="trip_id" defaultValue="">
                <option value="">— Not linked —</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Provider" htmlFor="provider">
              <Input id="provider" name="provider" placeholder="British Airways" />
            </Field>
            <Field label="Confirmation code" htmlFor="confirmation_code">
              <Input id="confirmation_code" name="confirmation_code" placeholder="ABC123" />
            </Field>

            <Field label="From" htmlFor="origin">
              <Input id="origin" name="origin" placeholder="LGW" />
            </Field>
            <Field label="To" htmlFor="destination">
              <Input id="destination" name="destination" placeholder="NAP" />
            </Field>

            <Field label="Departs" htmlFor="depart_at">
              <Input id="depart_at" name="depart_at" type="datetime-local" />
            </Field>
            <Field label="Arrives" htmlFor="arrive_at">
              <Input id="arrive_at" name="arrive_at" type="datetime-local" />
            </Field>

            <Field label="Check-in" htmlFor="check_in">
              <Input id="check_in" name="check_in" type="date" />
            </Field>
            <Field label="Check-out" htmlFor="check_out">
              <Input id="check_out" name="check_out" type="date" />
            </Field>

            <Field label="Seat / room" htmlFor="seat">
              <Input id="seat" name="seat" />
            </Field>
            <Field label="Passenger names" htmlFor="passenger_names">
              <Input id="passenger_names" name="passenger_names" />
            </Field>

            <Field label="Amount paid" htmlFor="amount">
              <Input id="amount" name="amount" type="number" step="0.01" min="0" />
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

            <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" name="notes" rows={2} />
            </Field>

            <div className="flex gap-3 sm:col-span-2">
              <Button type="submit" loading={pending}>
                Save to vault
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={
            filter === 'all'
              ? 'rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
              : 'rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary'
          }
        >
          All ({documents.length})
        </button>
        {DOC_TYPES.filter((type) => documents.some((doc) => doc.doc_type === type.value)).map(
          (type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFilter(type.value)}
              className={
                filter === type.value
                  ? 'rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
                  : 'rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary'
              }
            >
              {type.label}
            </button>
          )
        )}
      </div>

      {visible.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Nothing in the vault yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload the confirmations you would panic about losing at an airport.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((doc) => (
            <Card key={doc.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{doc.title}</h3>
                <Badge tone="outline">{doc.doc_type.replace(/_/g, ' ')}</Badge>
              </div>

              <dl className="mt-3 flex-1 space-y-1 text-sm text-muted-foreground">
                {doc.provider && <dd>{doc.provider}</dd>}
                {doc.confirmation_code && (
                  <dd>
                    Ref: <span className="font-mono text-foreground">{doc.confirmation_code}</span>
                  </dd>
                )}
                {doc.origin && doc.destination && (
                  <dd>
                    {doc.origin} → {doc.destination}
                  </dd>
                )}
                {doc.depart_at && <dd>Departs {formatDateTime(doc.depart_at)}</dd>}
                {doc.check_in && (
                  <dd>
                    {formatDate(doc.check_in)}
                    {doc.check_out ? ` → ${formatDate(doc.check_out)}` : ''}
                  </dd>
                )}
                {doc.seat && <dd>Seat/room {doc.seat}</dd>}
                {doc.amount_cents ? (
                  <dd className="font-medium text-foreground">
                    {formatMoney(doc.amount_cents, doc.currency ?? currency)}
                  </dd>
                ) : null}
              </dl>

              <div className="mt-4 flex items-center gap-2">
                {doc.file_path && (
                  <Button size="sm" variant="outline" onClick={() => open(doc.file_path)}>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Open
                  </Button>
                )}
                <button
                  type="button"
                  aria-label={`Delete ${doc.title}`}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteTravelDocumentAction(doc.id);
                      if (!result.ok) setStatus({ ok: false, message: result.error });
                    })
                  }
                  className="ml-auto rounded p-1.5 text-muted-foreground hover:text-destructive"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
