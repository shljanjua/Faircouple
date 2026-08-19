import 'server-only';
import { headers } from 'next/headers';
import { execute, uuid } from '@/lib/db';

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
    await execute(
      `INSERT INTO audit_logs
         (id, actor_id, actor_email, action, entity_type, entity_id, summary, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        input.actorId ?? null,
        input.actorEmail ?? null,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.summary ?? null,
        input.changes ? JSON.stringify(input.changes) : null,
        headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          headerList.get('x-real-ip') ??
          null,
        headerList.get('user-agent')?.slice(0, 250) ?? null,
      ]
    );
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
    await execute(
      `INSERT INTO notifications (id, user_id, couple_id, type, title, body, link, emoji)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        params.userId,
        params.coupleId ?? null,
        params.type ?? 'system',
        params.title,
        params.body ?? null,
        params.link ?? null,
        params.emoji ?? null,
      ]
    );
  } catch {
    // Non-critical.
  }
}
