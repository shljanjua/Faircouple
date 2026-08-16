'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui';
import type { ActionResult } from '@/app/actions/couple';

/**
 * Wraps any admin form with pending state + result feedback, so every admin
 * screen behaves identically without repeating boilerplate.
 */
export function AdminForm({
  action,
  children,
  submitLabel = 'Save changes',
  resetOnSuccess = false,
  className,
  footer,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
  footer?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await action(formData);
      setStatus(
        result.ok
          ? { ok: true, message: result.message ?? 'Saved.' }
          : { ok: false, message: result.error }
      );
      if (result.ok && resetOnSuccess) form.reset();
      setTimeout(() => setStatus(null), 5000);
    });
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      {status && (
        <Alert tone={status.ok ? 'success' : 'danger'} className="mb-4">
          {status.message}
        </Alert>
      )}
      {children}
      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {footer}
      </div>
    </form>
  );
}

export function ActionButton({
  action,
  label,
  confirm,
  variant = 'outline',
  size = 'sm',
  onDone,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  confirm?: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
  onDone?: (result: ActionResult) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (message) {
    return <span className="text-xs text-muted-foreground">{message}</span>;
  }

  if (confirm && confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{confirm}</span>
        <Button
          variant="destructive"
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await action();
              setMessage(result.ok ? (result.message ?? 'Done') : result.error);
              onDone?.(result);
              setTimeout(() => setMessage(null), 4000);
            })
          }
        >
          Confirm
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      loading={pending}
      onClick={() => {
        if (confirm) {
          setConfirming(true);
          return;
        }
        startTransition(async () => {
          const result = await action();
          setMessage(result.ok ? (result.message ?? 'Done') : result.error);
          onDone?.(result);
          setTimeout(() => setMessage(null), 4000);
        });
      }}
    >
      {label}
    </Button>
  );
}
