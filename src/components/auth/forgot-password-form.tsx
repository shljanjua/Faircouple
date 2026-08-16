'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { requestPasswordResetAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    // The action always reports success, so the form cannot be used to
    // enumerate which addresses have accounts.
    const result = await requestPasswordResetAction(email);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <MailCheck className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
        <h1 className="font-display text-2xl font-bold">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          If an account exists for <strong className="text-foreground">{email}</strong>, a reset
          link is on its way. It expires in 60 minutes.
        </p>
        <Link
          href="/signin"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we will send you a link to choose a new one.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email address" required htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/signin" className="font-medium text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
