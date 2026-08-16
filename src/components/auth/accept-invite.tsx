'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitationAction } from '@/app/actions/couple';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui';

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-5 space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <Button
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvitationAction(token);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push('/dashboard');
            router.refresh();
          })
        }
      >
        Accept and join
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => router.push('/dashboard')}>
        Not now
      </Button>
    </div>
  );
}
