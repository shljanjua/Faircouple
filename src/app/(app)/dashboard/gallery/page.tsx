import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { GalleryWorkspace } from '@/components/app/gallery-workspace';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Photos', path: '/dashboard/gallery', noIndex: true });
}

export default async function GalleryPage() {
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="🖼️"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const supabase = createClient();
  const { data: assets } = await supabase
    .from('media_assets')
    .select('*')
    .eq('couple_id', context.couple.id)
    .in('kind', ['photo', 'video'])
    .order('created_at', { ascending: false })
    .limit(300);

  return (
    <GalleryWorkspace
      coupleId={context.couple.id}
      meId={context.me.user_id}
      assets={(assets ?? []) as any[]}
    />
  );
}
