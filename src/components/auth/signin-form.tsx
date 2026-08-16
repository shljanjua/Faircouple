'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { signInAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui';

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();

  const nextPath = params.get('next') || '/dashboard';
  const notice = params.get('notice');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.set('email', email.trim().toLowerCase());
    formData.set('password', password);

    const result = await signInAction(formData);

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to see this week&apos;s balance report.
        </p>
      </div>

      {notice === 'verified' && <Alert tone="success">Email confirmed. You can sign in now.</Alert>}
      {notice === 'password-updated' && (
        <Alert tone="success">Password updated. Use it to sign in below.</Alert>
      )}
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

        <Field label="Password" required htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to FairCouples?{' '}
        <Link href="/signup" className="font-medium text-primary underline underline-offset-4">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
