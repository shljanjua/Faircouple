import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: emotionTypes }, { data: logs }] = await Promise.all([
    supabase.from('emotion_types').select('*').eq('is_active', true).order('sort_order'),
    supabase
      .from('emotion_logs')
      .select('*')
      .eq('couple_id', context.couple.id)
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: false })
      .limit(200),
  ]);

  return (
    <EmotionsWorkspace
      emotionTypes={(emotionTypes ?? []) as any[]}
      logs={(logs ?? []) as any[]}
      meId={context.me.user_id}
      meName={context.me.profile?.full_name ?? 'You'}
      partnerId={context.partner?.user_id ?? null}
      partnerName={context.partner?.profile?.full_name ?? 'Your partner'}
    />
  );
}
