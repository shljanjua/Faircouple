'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { saveCheckinAction } from '@/app/actions/entries';
import { Button } from '@/components/ui/button';
import { Alert, Card, Field, Input, Textarea } from '@/components/ui';

export function CheckinForm({ date, existing }: { date: string; existing: any | null }) {
  const [dayRating, setDayRating] = useState(existing?.day_rating ?? 7);
  const [connection, setConnection] = useState(existing?.connection ?? 7);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('day_rating', String(dayRating));
    formData.set('connection', String(connection));
    startTransition(async () => {
      const result = await saveCheckinAction(formData);
      setStatus(result.ok ? { ok: true, message: 'Saved.' } : { ok: false, message: result.error });
      setTimeout(() => setStatus(null), 2500);
    });
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Your check-in</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Answer for yourself only — your partner writes their own.
      </p>

      {status && (
        <Alert tone={status.ok ? 'success' : 'danger'} className="mt-4">
          {status.message}
        </Alert>
      )}

      <form onSubmit={onSubmit} className="mt-5 space-y-5">
        <input type="hidden" name="checkin_date" value={date} />

        <div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="day_rating" className="font-medium">
              How was your day?
            </label>
            <span className="font-bold tabular-nums">{dayRating}/10</span>
          </div>
          <input
            id="day_rating"
            type="range"
            min={1}
            max={10}
            value={dayRating}
            onChange={(e) => setDayRating(Number(e.target.value))}
            className="mt-2"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="connection" className="font-medium">
              How connected did you feel to your partner?
            </label>
            <span className="font-bold tabular-nums">{connection}/10</span>
          </div>
          <input
            id="connection"
            type="range"
            min={1}
            max={10}
            value={connection}
            onChange={(e) => setConnection(Number(e.target.value))}
            className="mt-2"
          />
        </div>

        <Field label="One thing you are grateful for" htmlFor="gratitude">
          <Input
            id="gratitude"
            name="gratitude"
            defaultValue={existing?.gratitude ?? ''}
            placeholder="You handled the call with my mother"
          />
        </Field>

        <Field label="Highlight of the day" htmlFor="highlight">
          <Input id="highlight" name="highlight" defaultValue={existing?.highlight ?? ''} />
        </Field>

        <Field label="Hardest part of the day" htmlFor="challenge">
          <Input id="challenge" name="challenge" defaultValue={existing?.challenge ?? ''} />
        </Field>

        <Field
          label="What you need from your partner tomorrow"
          hint="One specific, doable thing."
          htmlFor="need_from_partner"
        >
          <Textarea
            id="need_from_partner"
            name="need_from_partner"
            rows={3}
            defaultValue={existing?.need_from_partner ?? ''}
          />
        </Field>

        <Button type="submit" className="w-full" loading={pending}>
          {existing ? 'Update check-in' : 'Save check-in'}
        </Button>
      </form>
    </Card>
  );
}
