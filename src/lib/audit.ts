import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';

export interface AuditInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  summary?: string;
  changes?: Record<string, unknown>;
}

export async function recordAudit(input: AuditInput) {
  try {
    const headerList = headers();
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      summary: input.summary ?? null,
      changes: input.changes ?? null,
      ip_address:
        headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        headerList.get('x-real-ip') ??
        null,
      user_agent: headerList.get('user-agent'),
    });
  } catch {
    // Auditing must never break the operation it is recording.
  }
}

export async function notifyUser(params: {
  userId: string;
  coupleId?: string | null;
  type?: string;
  title: string;
  body?: string;
  link?: string;
  emoji?: string;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from('notifications').insert({
      user_id: params.userId,
      couple_id: params.coupleId ?? null,
      type: params.type ?? 'system',
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
      emoji: params.emoji ?? null,
    });
  } catch {
    // Non-critical.
  }
}
