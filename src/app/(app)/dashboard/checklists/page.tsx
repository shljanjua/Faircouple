import type { Metadata } from 'next';
import { query, toBool } from '@/lib/db';
import { getChecklistTemplates } from '@/lib/queries';
import { getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { ChecklistsWorkspace } from '@/components/app/checklists-workspace';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Checklists', path: '/dashboard/checklists', noIndex: true });
}

export default async function ChecklistsPage() {
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="✅"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const [checklists, items, templates] = await Promise.all([
    query<any>(
      `SELECT * FROM checklists WHERE couple_id = ? AND archived_at IS NULL ORDER BY created_at DESC`,
      [context.couple.id]
    ),
    query<any>(
      `SELECT i.* FROM checklist_items i
         JOIN checklists c ON c.id = i.checklist_id
        WHERE c.couple_id = ? AND c.archived_at IS NULL
        ORDER BY i.sort_order ASC`,
      [context.couple.id]
    ),
    getChecklistTemplates(),
  ]);

  const lists = checklists.map((list) => ({
    ...list,
    items: items
      .filter((item) => item.checklist_id === list.id)
      .map((item) => ({ ...item, is_done: toBool(item.is_done) })),
  }));

  return (
    <ChecklistsWorkspace
      checklists={lists}
      templates={templates}
      members={context.members.map((member) => ({
        id: member.user_id,
        name: member.profile?.full_name ?? 'Member',
      }))}
      meId={context.me.user_id}
    />
  );
}
