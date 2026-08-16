import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { VaultWorkspace } from '@/components/app/vault-workspace';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Ticket vault', path: '/dashboard/documents', noIndex: true });
}

export default async function DocumentsPage() {
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="🎫"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const supabase = createClient();
  const [{ data: documents }, { data: trips }] = await Promise.all([
    supabase
      .from('travel_documents')
      .select('*')
      .eq('couple_id', context.couple.id)
      .order('depart_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('trips')
      .select('id, title')
      .eq('couple_id', context.couple.id)
      .neq('status', 'cancelled'),
  ]);

  return (
    <VaultWorkspace
      coupleId={context.couple.id}
      meId={context.me.user_id}
      documents={(documents ?? []) as any[]}
      trips={(trips ?? []) as any[]}
      currency={context.couple.currency}
    />
  );
}
