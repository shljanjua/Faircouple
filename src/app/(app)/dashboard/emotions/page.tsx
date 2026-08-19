import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { getEmotionTypes } from '@/lib/queries';
import { getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { EmotionsWorkspace } from '@/components/app/emotions-workspace';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Emotions', path: '/dashboard/emotions', noIndex: true });
}

export default async function EmotionsPage() {
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="💗"
        title="Create your relationship space first"
        description="Emotions are logged inside a shared space so both partners can see each other's entries."
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [emotionTypes, logs] = await Promise.all([
    getEmotionTypes(),
    query<any>(
      `SELECT *, trigger_text AS \`trigger\`, need_text AS need FROM emotion_logs
        WHERE couple_id = ? AND logged_at >= ?
        ORDER BY logged_at DESC LIMIT 200`,
      [context.couple.id, since.toISOString().slice(0, 19).replace('T', ' ')]
    ),
  ]);

  return (
    <EmotionsWorkspace
      emotionTypes={emotionTypes as any[]}
      logs={logs.map((log) => ({ ...log, is_private: log.is_private === 1 }))}
      meId={context.me.user_id}
      meName={context.me.profile?.full_name ?? 'You'}
      partnerId={context.partner?.user_id ?? null}
      partnerName={context.partner?.profile?.full_name ?? 'Your partner'}
    />
  );
}
