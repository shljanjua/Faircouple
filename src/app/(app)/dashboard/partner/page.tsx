import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getCoupleContext, getSessionUser } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { PartnerWorkspace } from '@/components/app/partner-workspace';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { SITE_URL } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Partner', path: '/dashboard/partner', noIndex: true });
}

export default async function PartnerPage() {
  const user = await getSessionUser();
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="👫"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const supabase = createClient();
  const { data: invitations } = await supabase
    .from('couple_invitations')
    .select('*')
    .eq('couple_id', context.couple.id)
    .order('created_at', { ascending: false });

  return (
    <PartnerWorkspace
      couple={context.couple}
      members={context.members.map((member) => ({
        id: member.id,
        userId: member.user_id,
        name: member.profile?.full_name ?? member.profile?.email ?? 'Member',
        email: member.profile?.email ?? '',
        avatar: member.profile?.avatar_url ?? null,
        role: member.member_role,
        displayRole: member.display_role,
        incomeShare: member.income_share,
        joinedAt: member.joined_at,
      }))}
      invitations={(invitations ?? []) as any[]}
      meId={user!.id}
      isOwner={context.couple.owner_id === user!.id}
      siteUrl={SITE_URL}
    />
  );
}
