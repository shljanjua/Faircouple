'use client';

import { useState, useTransition } from 'react';
import { cancelSubscriptionAction } from '@/app/actions/billing';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui';

export function CancelSubscription({ subscriptionId }: { subscriptionId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  if (status) {
    return <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>;
  }

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Cancel subscription
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted-foreground">
        You keep access until the end of the paid period.
      </span>
      <Button
        variant="destructive"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelSubscriptionAction(subscriptionId);
            setStatus(
              result.ok
                ? { ok: true, message: result.message ?? 'Cancelled.' }
                : { ok: false, message: result.error }
            );
          })
        }
      >
        Yes, cancel
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Keep my plan
      </Button>
    </div>
  );
}
