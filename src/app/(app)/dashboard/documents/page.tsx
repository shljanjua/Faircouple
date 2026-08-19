import type { Metadata } from 'next';
import { query } from '@/lib/db';
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

  const [documents, trips] = await Promise.all([
    query<any>(
      `SELECT * FROM travel_documents WHERE couple_id = ?
        ORDER BY depart_at IS NULL ASC, depart_at ASC`,
      [context.couple.id]
    ),
    query<{ id: string; title: string }>(
      `SELECT id, title FROM trips WHERE couple_id = ? AND status <> 'cancelled'`,
      [context.couple.id]
    ),
  ]);

  return (
    <VaultWorkspace
      coupleId={context.couple.id}
      meId={context.me.user_id}
      documents={documents}
      trips={trips}
      currency={context.couple.currency}
    />
  );
}
