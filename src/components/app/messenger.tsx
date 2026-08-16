'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Loader2, Send, Smile, Trash2 } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/client';
import { sendMessageAction } from '@/app/actions/entries';
import { Avatar, Card } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';

interface Message {
  id: string;
  sender_id: string;
  body: string | null;
  message_type: string;
  attachment_path: string | null;
  attachment_name: string | null;
  reactions: Record<string, string[]>;
  created_at: string;
  read_at: string | null;
}

const EMOJIS = [
  '😀', '😂', '🥰', '😍', '😘', '😉', '😌', '😴', '🤗', '🤔',
  '😢', '😭', '😤', '😡', '🥺', '😳', '🙈', '🤷', '👍', '👎',
  '👏', '🙏', '💪', '❤️', '💔', '💕', '💗', '💐', '🌹', '🔥',
  '✨', '🎉', '🎁', '☕', '🍕', '🍷', '✈️', '🏖️', '🌙', '☀️',
];

const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

export function Messenger({
  coupleId,
  conversationId,
  initialMessages,
  meId,
  meName,
  meAvatar,
  partnerId,
  partnerName,
  partnerAvatar,
}: {
  coupleId: string;
  conversationId: string;
  initialMessages: Message[];
  meId: string;
  meName: string;
  meAvatar: string | null;
  partnerId: string | null;
  partnerName: string;
  partnerAvatar: string | null;
}) {
  const supabase = getBrowserClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Live updates for the other partner's messages.
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${coupleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) =>
            prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((message) => (message.id === updated.id ? updated : message))
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, coupleId]);

  // Mark the partner's messages as read.
  useEffect(() => {
    const unread = messages.filter((m) => m.sender_id !== meId && !m.read_at).map((m) => m.id);
    if (!unread.length) return;
    void supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread)
      .then(() => undefined);
  }, [messages, meId, supabase]);

  // Sign image attachments so they can be displayed.
  useEffect(() => {
    const paths = messages
      .filter((m) => m.message_type === 'image' && m.attachment_path && !imageUrls[m.attachment_path])
      .map((m) => m.attachment_path!) as string[];
    if (!paths.length) return;

    void supabase.storage
      .from('couple-media')
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const item of data) {
          if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
        }
        setImageUrls((prev) => ({ ...prev, ...map }));
      });
  }, [messages, supabase, imageUrls]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);

    const formData = new FormData();
    formData.set('conversation_id', conversationId);
    formData.set('body', body);
    formData.set('message_type', 'text');

    const result = await sendMessageAction(formData);
    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDraft('');
    const created = result.data as Message | undefined;
    if (created) {
      setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
    }
  }

  async function uploadImage(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setError('Images must be under 20 MB.');
      return;
    }
    setUploading(true);
    setError(null);

    const extension = file.name.split('.').pop() ?? 'jpg';
    const path = `${coupleId}/${meId}/chat-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('couple-media')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const formData = new FormData();
    formData.set('conversation_id', conversationId);
    formData.set('message_type', 'image');
    formData.set('attachment_path', path);
    formData.set('attachment_name', file.name);
    formData.set('attachment_size', String(file.size));
    formData.set('attachment_mime', file.type);

    const result = await sendMessageAction(formData);

    await supabase.from('media_assets').insert({
      couple_id: coupleId,
      user_id: meId,
      bucket: 'couple-media',
      path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      kind: 'photo',
      album: 'Chat',
    });

    setUploading(false);

    if (!result.ok) {
      await supabase.storage.from('couple-media').remove([path]);
      setError(result.error);
      return;
    }

    const created = result.data as Message | undefined;
    if (created) {
      setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
    }
  }

  async function react(messageId: string, emoji: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    const reactions = { ...(message.reactions ?? {}) };
    const users = new Set(reactions[emoji] ?? []);
    if (users.has(meId)) users.delete(meId);
    else users.add(meId);
    reactions[emoji] = Array.from(users);
    if (!reactions[emoji].length) delete reactions[emoji];

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
    );
    await supabase.from('messages').update({ reactions }).eq('id', messageId);
  }

  async function remove(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Private messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Just the two of you — text, photos and reactions, separate from every other app.
        </p>
      </header>

      <Card className="flex h-[calc(100vh-16rem)] min-h-[480px] flex-col">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Avatar src={partnerAvatar} name={partnerName} size={40} />
          <div className="min-w-0">
            <p className="truncate font-medium">{partnerName}</p>
            <p className="text-xs text-muted-foreground">
              {partnerId ? 'End-to-end private to your space' : 'Waiting for them to join'}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet. Say the first thing.
            </p>
          )}

          {messages.map((message) => {
            const mine = message.sender_id === meId;
            return (
              <div
                key={message.id}
                className={cn('group flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}
              >
                <Avatar
                  src={mine ? meAvatar : partnerAvatar}
                  name={mine ? meName : partnerName}
                  size={32}
                  className="mt-1 shrink-0"
                />
                <div className={cn('max-w-[75%]', mine && 'items-end text-right')}>
                  <div
                    className={cn(
                      'inline-block rounded-2xl px-3.5 py-2 text-sm',
                      mine
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-secondary'
                    )}
                  >
                    {message.message_type === 'image' && message.attachment_path ? (
                      imageUrls[message.attachment_path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrls[message.attachment_path]}
                          alt={message.attachment_name ?? 'Shared photo'}
                          className="max-h-64 rounded-lg"
                        />
                      ) : (
                        <span className="flex items-center gap-2 text-xs">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> loading image…
                        </span>
                      )
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{message.body}</span>
                    )}
                  </div>

                  <div
                    className={cn(
                      'mt-1 flex items-center gap-2 text-[11px] text-muted-foreground',
                      mine && 'justify-end'
                    )}
                  >
                    <span>{timeAgo(message.created_at)}</span>
                    {mine && message.read_at && <span>· seen</span>}
                    <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => react(message.id, emoji)}
                          className="rounded px-0.5 hover:bg-secondary"
                          aria-label={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      {mine && (
                        <button
                          type="button"
                          onClick={() => remove(message.id)}
                          className="rounded px-0.5 hover:text-destructive"
                          aria-label="Delete message"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      )}
                    </span>
                  </div>

                  {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className={cn('mt-1 flex gap-1', mine && 'justify-end')}>
                      {Object.entries(message.reactions).map(([emoji, users]) => (
                        <span
                          key={emoji}
                          className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[11px]"
                        >
                          {emoji} {users.length}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-4 pb-2 text-xs text-destructive">{error}</p>}

        {showEmojis && (
          <div className="grid grid-cols-10 gap-1 border-t border-border p-3">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setDraft((prev) => prev + emoji)}
                className="rounded p-1 text-lg hover:bg-secondary"
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => setShowEmojis((v) => !v)}
            aria-label="Emoji picker"
            aria-expanded={showEmojis}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
          >
            <Smile className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Send a photo"
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-5 w-5" aria-hidden />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file);
              event.target.value = '';
            }}
          />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={partnerId ? 'Write a message…' : 'Invite your partner to start chatting'}
            aria-label="Message"
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </button>
        </form>
      </Card>
    </div>
  );
}
