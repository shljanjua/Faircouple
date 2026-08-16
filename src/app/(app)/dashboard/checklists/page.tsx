import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = createClient();

  const [{ data: checklists }, { data: templates }] = await Promise.all([
    supabase
      .from('checklists')
      .select('*, items:checklist_items(*)')
      .eq('couple_id', context.couple.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('checklist_templates')
      .select('*')
      .eq('is_public', true)
      .order('sort_order'),
  ]);

  const lists = ((checklists ?? []) as any[]).map((list) => ({
    ...list,
    items: (list.items ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }));

  return (
    <ChecklistsWorkspace
      checklists={lists}
      templates={(templates ?? []) as any[]}
      members={context.members.map((member) => ({
        id: member.user_id,
        name: member.profile?.full_name ?? 'Member',
      }))}
      meId={context.me.user_id}
    />
  );
}
