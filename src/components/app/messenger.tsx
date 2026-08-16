'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Loader2, Send, Smile, Trash2 } from 'lucide-react';
import { saveMediaAssetAction } from '@/app/actions/vault';
import {
  deleteMessageAction,
  fetchMessagesAction,
  markConversationReadAction,
  reactToMessageAction,
  sendMessageAction,
} from '@/app/actions/entries';
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
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const latestRef = useRef<string | null>(
    initialMessages.length ? initialMessages[initialMessages.length - 1].created_at : null
  );

  useEffect(() => {
    if (messages.length) latestRef.current = messages[messages.length - 1].created_at;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // MySQL has no realtime channel, so the client polls for anything new. The
  // request only asks for messages created after the newest one it already has.
  useEffect(() => {
    if (!partnerId) return;

    let cancelled = false;

    const poll = async () => {
      const newest = latestRef.current;
      const result = await fetchMessagesAction(conversationId, newest);
      if (cancelled || !result.ok) return;

      const incoming = (result.data as Message[] | undefined) ?? [];
      if (!incoming.length) return;

      setMessages((prev) => {
        const seen = new Set(prev.map((message) => message.id));
        const additions = incoming.filter((message) => !seen.has(message.id));
        return additions.length ? [...prev, ...additions] : prev;
      });
    };

    const timer = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [conversationId, partnerId]);

  // Mark the partner's messages as read.
  useEffect(() => {
    const hasUnread = messages.some((m) => m.sender_id !== meId && !m.read_at);
    if (!hasUnread) return;
    void markConversationReadAction(conversationId);
  }, [messages, meId, conversationId]);

  // Attachments are served through the authenticated /api/files route.
  useEffect(() => {
    const missing = messages.filter(
      (m) => m.message_type === 'image' && m.attachment_path && !imageUrls[m.attachment_path]
    );
    if (!missing.length) return;

    setImageUrls((prev) => {
      const next = { ...prev };
      for (const message of missing) {
        const path = message.attachment_path!;
        next[path] = `/api/files/couple-media/${path.split('/').map(encodeURIComponent).join('/')}`;
      }
      return next;
    });
  }, [messages, imageUrls]);

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

    const upload = new FormData();
    upload.set('bucket', 'couple-media');
    upload.set('prefix', 'chat');
    upload.set('file', file);

    const response = await fetch('/api/upload', { method: 'POST', body: upload });
    const payload = await response.json().catch(() => ({ error: 'Upload failed.' }));

    if (!response.ok || !payload.path) {
      setUploading(false);
      setError(payload.error ?? 'Upload failed.');
      return;
    }

    const formData = new FormData();
    formData.set('conversation_id', conversationId);
    formData.set('message_type', 'image');
    formData.set('attachment_path', payload.path);
    formData.set('attachment_name', file.name);
    formData.set('attachment_size', String(file.size));
    formData.set('attachment_mime', file.type);

    const result = await sendMessageAction(formData);

    // Chat photos also land in the shared gallery.
    const asset = new FormData();
    asset.set('path', payload.path);
    asset.set('file_name', file.name);
    asset.set('mime_type', file.type);
    asset.set('size_bytes', String(file.size));
    asset.set('kind', 'photo');
    asset.set('album', 'Chat');
    void saveMediaAssetAction(asset);

    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const created = result.data as Message | undefined;
    if (created) {
      setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
    }
  }

  async function react(messageId: string, emoji: string) {
    const result = await reactToMessageAction(messageId, emoji);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const reactions = result.data as Record<string, string[]>;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
  }

  async function remove(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const result = await deleteMessageAction(messageId);
    if (!result.ok) setError(result.error);
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
