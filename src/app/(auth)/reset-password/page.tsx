import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Choose a new password',
    path: '/reset-password',
    noIndex: true,
  });
}

export default function ResetPasswordPage() {
  // The reset token arrives in the query string, so the form reads
  // useSearchParams and must sit behind a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
