'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPasswordAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui';

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await resetPasswordAction(token, password, confirm);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push('/signin?notice=password-updated');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You will be signed out of other devices once it is changed.
        </p>
      </div>

      {!token && (
        <Alert tone="warning">
          This reset link is missing its token. Request a new one from the{' '}
          <Link href="/forgot-password" className="underline">
            forgot-password page
          </Link>
          .
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="New password"
          required
          htmlFor="password"
          hint="At least 8 characters, with an uppercase letter and a number."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="Confirm new password" required htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!token}>
          Update password
        </Button>
      </form>
    </div>
  );
}
