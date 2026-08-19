import type { Metadata } from 'next';
import { query, toBool } from '@/lib/db';
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

  const assets = await query<any>(
    `SELECT * FROM media_assets WHERE couple_id = ? AND kind IN ('photo','video')
      ORDER BY created_at DESC LIMIT 300`,
    [context.couple.id]
  );

  return (
    <GalleryWorkspace
      coupleId={context.couple.id}
      meId={context.me.user_id}
      assets={assets.map((asset) => ({ ...asset, is_private: toBool(asset.is_private) }))}
    />
  );
}
