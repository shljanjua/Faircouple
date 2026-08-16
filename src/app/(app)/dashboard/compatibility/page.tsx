import type { Metadata } from 'next';
import { query, parseJson } from '@/lib/db';
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

  const [assessments, scores] = await Promise.all([
    query<any>(
      `SELECT * FROM assessments WHERE couple_id = ? ORDER BY taken_at DESC LIMIT 20`,
      [context.couple.id]
    ),
    query<any>(
      `SELECT * FROM compatibility_scores WHERE couple_id = ? ORDER BY period DESC LIMIT 12`,
      [context.couple.id]
    ),
  ]);

  const all = assessments.map((row) => ({
    ...row,
    answers: parseJson<Record<string, number>>(row.answers, {}),
    details: parseJson<any>(row.details, {}),
  }));

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
      history={scores}
    />
  );
}
