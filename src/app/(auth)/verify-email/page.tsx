import type { Metadata } from 'next';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { ResendVerification } from '@/components/auth/resend-verification';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Confirm your email', path: '/verify-email', noIndex: true });
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  return (
    <div className="space-y-5 text-center">
      <MailCheck className="mx-auto h-12 w-12 text-primary" aria-hidden />
      <h1 className="font-display text-2xl font-bold">Confirm your email address</h1>
      <p className="text-sm text-muted-foreground">
        We sent a confirmation link
        {searchParams.email ? (
          <>
            {' '}
            to <strong className="text-foreground">{searchParams.email}</strong>
          </>
        ) : null}
        . Click it to activate your account — then invite your partner.
      </p>
      <ResendVerification email={searchParams.email ?? ''} />
      <Link href="/signin" className="block text-sm font-medium text-primary underline underline-offset-4">
        Back to sign in
      </Link>
    </div>
  );
}
