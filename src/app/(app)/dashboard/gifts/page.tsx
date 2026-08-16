import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = createClient();
  const [{ data: gifts }, { data: wishlist }] = await Promise.all([
    supabase
      .from('gifts')
      .select('*')
      .eq('couple_id', context.couple.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('wishlist_items')
      .select('*')
      .eq('couple_id', context.couple.id)
      .order('created_at', { ascending: false }),
  ]);

  // Surprises created by the other partner are hidden until they are given.
  const visibleGifts = ((gifts ?? []) as any[]).filter(
    (gift) =>
      gift.created_by === context.me.user_id ||
      !gift.is_surprise ||
      ['given', 'received'].includes(gift.status)
  );

  return (
    <GiftsWorkspace
      gifts={visibleGifts}
      wishlist={(wishlist ?? []) as any[]}
      currency={context.couple.currency}
      meId={context.me.user_id}
      members={context.members.map((member) => ({
        id: member.user_id,
        name: member.profile?.full_name ?? 'Member',
      }))}
      hiddenCount={((gifts ?? []) as any[]).length - visibleGifts.length}
    />
  );
}
