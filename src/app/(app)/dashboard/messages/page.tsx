import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getCoupleContext } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { Messenger } from '@/components/app/messenger';
import { EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Messages', path: '/dashboard/messages', noIndex: true });
}

export default async function MessagesPage() {
  const context = await getCoupleContext();

  if (!context) {
    return (
      <EmptyState
        icon="💬"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const supabase = createClient();

  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('couple_id', context.couple.id)
    .eq('kind', 'direct')
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from('conversations')
      .insert({ couple_id: context.couple.id, kind: 'direct', title: 'Private chat' })
      .select('*')
      .single();
    conversation = created;
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('couple_id', context.couple.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200);

  return (
    <Messenger
      coupleId={context.couple.id}
      conversationId={(conversation as any)?.id ?? ''}
      initialMessages={(messages ?? []) as any[]}
      meId={context.me.user_id}
      meName={context.me.profile?.full_name ?? 'You'}
      meAvatar={context.me.profile?.avatar_url ?? null}
      partnerId={context.partner?.user_id ?? null}
      partnerName={context.partner?.profile?.full_name ?? 'Your partner'}
      partnerAvatar={context.partner?.profile?.avatar_url ?? null}
    />
  );
}
