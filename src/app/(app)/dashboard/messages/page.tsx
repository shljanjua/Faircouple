import type { Metadata } from 'next';
import { query, queryOne, execute, uuid, parseJson } from '@/lib/db';
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

  let conversation = await queryOne<any>(
    `SELECT * FROM conversations WHERE couple_id = ? AND kind = 'direct' LIMIT 1`,
    [context.couple.id]
  );

  if (!conversation) {
    const id = uuid();
    await execute(
      `INSERT INTO conversations (id, couple_id, kind, title) VALUES (?, ?, 'direct', 'Private chat')`,
      [id, context.couple.id]
    );
    conversation = { id };
  }

  const messages = await query<any>(
    `SELECT * FROM messages WHERE couple_id = ? AND deleted_at IS NULL
      ORDER BY created_at ASC LIMIT 200`,
    [context.couple.id]
  );

  return (
    <Messenger
      coupleId={context.couple.id}
      conversationId={conversation?.id ?? ''}
      initialMessages={messages.map((message) => ({
        ...message,
        reactions: parseJson<Record<string, string[]>>(message.reactions, {}),
      }))}
      meId={context.me.user_id}
      meName={context.me.profile?.full_name ?? 'You'}
      meAvatar={context.me.profile?.avatar_url ?? null}
      partnerId={context.partner?.user_id ?? null}
      partnerName={context.partner?.profile?.full_name ?? 'Your partner'}
      partnerAvatar={context.partner?.profile?.avatar_url ?? null}
    />
  );
}
