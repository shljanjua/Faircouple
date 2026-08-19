'use client';

import { useState } from 'react';
import { resendVerificationAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Alert, Input } from '@/components/ui';

export function ResendVerification({ email: initialEmail }: { email: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function resend() {
    if (!email) {
      setState('error');
      setMessage('Enter the email address you signed up with.');
      return;
    }

    setState('loading');
    const result = await resendVerificationAction(email);

    if (!result.ok) {
      setState('error');
      setMessage(result.error);
      return;
    }

    setState('sent');
    setMessage(result.message ?? 'Confirmation email sent again.');
  }

  if (state === 'sent') {
    return <Alert tone="success">{message}</Alert>;
  }

  return (
    <div className="space-y-3">
      {state === 'error' && <Alert tone="danger">{message}</Alert>}
      <Input
        type="email"
        value={email}
        placeholder="you@example.com"
        onChange={(event) => setEmail(event.target.value)}
        aria-label="Email address"
      />
      <Button variant="outline" className="w-full" loading={state === 'loading'} onClick={resend}>
        Resend confirmation email
      </Button>
    </div>
  );
}
