import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { queryOne } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { AcceptInvite } from '@/components/auth/accept-invite';
import { Alert, Card } from '@/components/ui';
import { Logo } from '@/components/marketing/logo';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Accept your invitation', noIndex: true });
}

export default async function InvitePage({ params }: { params: { token: string } }) {
  const user = await getSessionUser();

  const invitation = await queryOne<any>(
    `SELECT i.*, c.name AS couple_name, c.relationship_type
       FROM couple_invitations i
       JOIN couples c ON c.id = i.couple_id
      WHERE i.token = ? LIMIT 1`,
    [params.token]
  );

  const invalid =
    !invitation || invitation.status !== 'pending' || new Date(invitation.expires_at) < new Date();

  if (!user) {
    const target = `/signup?invite=${params.token}${
      invitation ? `&email=${encodeURIComponent(invitation.email)}` : ''
    }`;
    redirect(invalid ? '/signup' : target);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <Logo className="justify-center" />

        {invalid ? (
          <Card className="p-6 text-center">
            <h1 className="font-display text-xl font-bold">This invitation is no longer valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              It may have expired, been revoked, or already been accepted. Ask your partner to send a
              new one.
            </p>
            <ButtonLink href="/dashboard" className="mt-5">
              Go to my dashboard
            </ButtonLink>
          </Card>
        ) : (
          <Card className="p-6">
            <h1 className="font-display text-xl font-bold">
              Join {invitation.couple_name ?? 'this relationship space'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You have been invited as{' '}
              <strong>{invitation.display_role ?? 'Partner B'}</strong>. You will log your
              own entries — nobody answers on your behalf.
            </p>

            {invitation.message && (
              <blockquote className="mt-4 border-l-4 border-primary bg-primary/5 p-3 text-sm italic">
                {invitation.message}
              </blockquote>
            )}

            {user.email.toLowerCase() !== String(invitation.email).toLowerCase() && (
              <Alert tone="warning" className="mt-4">
                This invitation was sent to <strong>{invitation.email}</strong> but you are
                signed in as <strong>{user.email}</strong>. Accepting will link this space to your
                current account.
              </Alert>
            )}

            <AcceptInvite token={params.token} />

            <p className="mt-4 text-center text-xs text-muted-foreground">
              By joining you agree to the{' '}
              <Link href="/terms-of-service" className="underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy-policy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
