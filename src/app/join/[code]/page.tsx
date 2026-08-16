import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { Card } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { Logo } from '@/components/marketing/logo';
import { JoinByCode } from '@/components/auth/join-by-code';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Join a relationship space', noIndex: true });
}

/** Joining by the space's short invite code, rather than an emailed token. */
export default async function JoinPage({ params }: { params: { code: string } }) {
  const user = await getSessionUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/join/${params.code}`)}`);

  const supabase = createClient();
  const { data: couple } = await supabase
    .from('couples')
    .select('id, name, relationship_type, owner_id')
    .eq('invite_code', params.code.toUpperCase())
    .maybeSingle();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <Logo className="justify-center" />
        <Card className="p-6 text-center">
          {couple ? (
            <>
              <h1 className="font-display text-xl font-bold">
                Join {(couple as any).name ?? 'this space'}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You will get your own entries and your own private notes.
              </p>
              <JoinByCode code={params.code.toUpperCase()} />
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold">Code not recognised</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Check the code with your partner, or ask them to email you an invitation instead.
              </p>
              <ButtonLink href="/dashboard" className="mt-5">
                Go to my dashboard
              </ButtonLink>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
