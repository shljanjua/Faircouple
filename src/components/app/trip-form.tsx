'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { saveTripAction } from '@/app/actions/travel';
import { Button } from '@/components/ui/button';
import { Alert, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { CURRENCY_LIST } from '@/lib/currency';

export function TripForm({
  destinations,
  currency,
}: {
  destinations: { id: string; name: string; country_code: string; is_honeymoon: boolean }[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await saveTripAction(formData);
      if (!result.ok) {
        setStatus({ ok: false, message: result.error });
        return;
      }
      form.reset();
      setStatus({ ok: true, message: 'Trip created.' });
      if (result.data) router.push(`/dashboard/travel/${result.data}`);
    });
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Plan a trip</h2>
      {status && (
        <Alert tone={status.ok ? 'success' : 'danger'} className="mt-3">
          {status.message}
        </Alert>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field label="Trip title" required htmlFor="title">
          <Input id="title" name="title" required placeholder="Our honeymoon" />
        </Field>

        <Field label="Destination" htmlFor="destination_id">
          <Select id="destination_id" name="destination_id" defaultValue="">
            <option value="">— Choose later —</option>
            <optgroup label="Honeymoon favourites">
              {destinations
                .filter((destination) => destination.is_honeymoon)
                .map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="All destinations">
              {destinations
                .filter((destination) => !destination.is_honeymoon)
                .map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
            </optgroup>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" htmlFor="start_date">
            <Input id="start_date" name="start_date" type="date" />
          </Field>
          <Field label="End date" htmlFor="end_date">
            <Input id="end_date" name="end_date" type="date" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trip type" htmlFor="trip_type">
            <Select id="trip_type" name="trip_type" defaultValue="vacation">
              <option value="honeymoon">Honeymoon</option>
              <option value="anniversary">Anniversary</option>
              <option value="vacation">Vacation</option>
              <option value="weekend">Weekend break</option>
              <option value="roadtrip">Road trip</option>
              <option value="adventure">Adventure</option>
              <option value="family">Family</option>
              <option value="business">Business</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue="planning">
              <option value="idea">Idea</option>
              <option value="planning">Planning</option>
              <option value="booked">Booked</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Travellers" htmlFor="travelers">
            <Input id="travelers" name="travelers" type="number" min="1" max="20" defaultValue={2} />
          </Field>
          <Field label="Budget" htmlFor="budget">
            <Input id="budget" name="budget" type="number" step="1" min="0" />
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

        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={2} placeholder="Anything you both agreed on already" />
        </Field>

        <Button type="submit" className="w-full" loading={pending}>
          Create trip
        </Button>
      </form>
    </Card>
  );
}
