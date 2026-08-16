import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { getSessionUser } from '@/lib/auth';
import { Card } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Account suspended', noIndex: true });
}

export default async function AccountSuspendedPage() {
  const user = await getSessionUser();

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-16">
      <Card className="max-w-lg p-8 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-bold">Your account is on hold</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {user?.profile.suspended_reason ??
            'This account has been suspended pending a review of our acceptable use policy.'}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Your data has not been deleted. If you believe this is a mistake,{' '}
          <Link href="/contact" className="font-medium text-primary underline">
            contact support
          </Link>{' '}
          and we will look at it within one business day.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          Read our{' '}
          <Link href="/acceptable-use" className="underline">
            acceptable use policy
          </Link>{' '}
          and{' '}
          <Link href="/terms-of-service" className="underline">
            terms of service
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
