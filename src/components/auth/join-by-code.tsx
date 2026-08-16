'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { joinByCodeAction } from '@/app/actions/join';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui';

export function JoinByCode({ code }: { code: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState('Partner B');

  return (
    <div className="mt-5 space-y-4 text-left">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Your role label" hint="Shown next to your entries." htmlFor="role">
        <Input id="role" value={role} onChange={(event) => setRole(event.target.value)} maxLength={40} />
      </Field>
      <Button
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await joinByCodeAction(code, role);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push('/dashboard');
            router.refresh();
          })
        }
      >
        Join this space
      </Button>
    </div>
  );
}
