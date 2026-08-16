import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { CompatibilityWorkspace } from '@/components/app/compatibility-workspace';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Compatibility', path: '/dashboard/compatibility', noIndex: true });
}

export default async function CompatibilityPage() {
  const user = await getSessionUser();
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="✨"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const supabase = createClient();

  const [{ data: assessments }, { data: scores }] = await Promise.all([
    supabase
      .from('assessments')
      .select('*')
      .eq('couple_id', context.couple.id)
      .order('taken_at', { ascending: false })
      .limit(20),
    supabase
      .from('compatibility_scores')
      .select('*')
      .eq('couple_id', context.couple.id)
      .order('period', { ascending: false })
      .limit(12),
  ]);

  const all = (assessments ?? []) as any[];

  return (
    <CompatibilityWorkspace
      meId={user!.id}
      meName={context.me.profile?.full_name ?? 'You'}
      partnerId={context.partner?.user_id ?? null}
      partnerName={context.partner?.profile?.full_name ?? 'Your partner'}
      myLove={all.find((a) => a.kind === 'love_vs_attraction' && a.user_id === user!.id) ?? null}
      partnerLove={
        all.find((a) => a.kind === 'love_vs_attraction' && a.user_id !== user!.id) ?? null
      }
      myCompatibility={all.find((a) => a.kind === 'compatibility' && a.user_id === user!.id) ?? null}
      partnerCompatibility={
        all.find((a) => a.kind === 'compatibility' && a.user_id !== user!.id) ?? null
      }
      history={(scores ?? []) as any[]}
    />
  );
}
