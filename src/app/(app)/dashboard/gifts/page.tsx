import type { Metadata } from 'next';
import { query, toBool } from '@/lib/db';
import { getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { GiftsWorkspace } from '@/components/app/gifts-workspace';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Gifts', path: '/dashboard/gifts', noIndex: true });
}

export default async function GiftsPage() {
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="🎁"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const [gifts, wishlist] = await Promise.all([
    query<any>(`SELECT * FROM gifts WHERE couple_id = ? ORDER BY created_at DESC`, [
      context.couple.id,
    ]),
    query<any>(`SELECT * FROM wishlist_items WHERE couple_id = ? ORDER BY created_at DESC`, [
      context.couple.id,
    ]),
  ]);

  // Surprises created by the other partner are hidden until they are given.
  const visibleGifts = gifts
    .map((gift) => ({ ...gift, is_surprise: toBool(gift.is_surprise) }))
    .filter(
      (gift) =>
        gift.created_by === context.me.user_id ||
        !gift.is_surprise ||
        ['given', 'received'].includes(gift.status)
    );

  return (
    <GiftsWorkspace
      gifts={visibleGifts}
      wishlist={wishlist}
      currency={context.couple.currency}
      meId={context.me.user_id}
      members={context.members.map((member) => ({
        id: member.user_id,
        name: member.profile?.full_name ?? 'Member',
      }))}
      hiddenCount={gifts.length - visibleGifts.length}
    />
  );
}
