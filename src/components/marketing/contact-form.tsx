'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input, Select, Textarea } from '@/components/ui';

export function ContactForm() {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('loading');
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Could not send your message.');
      setState('sent');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Could not send your message.');
    }
  }

  if (state === 'sent') {
    return (
      <div className="mt-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden />
        <h3 className="mt-3 font-semibold">Message received</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We reply within one business day. Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      {state === 'error' && <Alert tone="danger">{message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" />
        </Field>
        <Field label="Email" required htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      </div>

      <Field label="Topic" htmlFor="category">
        <Select id="category" name="category" defaultValue="general">
          <option value="general">General question</option>
          <option value="billing">Billing or refund</option>
          <option value="technical">Something is broken</option>
          <option value="privacy">Privacy or data request</option>
          <option value="partnership">Partnership or press</option>
        </Select>
      </Field>

      <Field label="Subject" htmlFor="subject">
        <Input id="subject" name="subject" />
      </Field>

      <Field label="Message" required htmlFor="message">
        <Textarea id="message" name="message" rows={6} required />
      </Field>

      {/* Honeypot — bots fill this, humans never see it. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <Button type="submit" size="lg" className="w-full" loading={state === 'loading'}>
        Send message
      </Button>

      <p className="text-xs text-muted-foreground">
        By sending this you agree to our privacy policy. We only use your address to reply.
      </p>
    </form>
  );
}
