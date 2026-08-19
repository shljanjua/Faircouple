<?php
declare(strict_types=1);

/** The audit trail and in-app notifications. */
final class Audit
{
    /** Records an action with the actor, IP and user agent. */
    public static function record(
        string $action,
        ?string $entityType = null,
        ?string $entityId = null,
        ?string $summary = null,
        array $changes = [],
        ?string $actorId = null,
        ?string $actorEmail = null
    ): void {
        $user = Auth::user();

        Db::insert('audit_logs', [
            'actor_id'    => $actorId ?? ($user['id'] ?? null),
            'actor_email' => $actorEmail ?? ($user['email'] ?? null),
            'action'      => $action,
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'summary'     => $summary ? mb_substr($summary, 0, 480) : null,
            'changes'     => $changes === [] ? null : json_encode($changes, JSON_UNESCAPED_UNICODE),
            'ip_address'  => Request::ip(),
            'user_agent'  => Request::userAgent(),
        ]);
    }

    /** Drops a notification in the other partner's bell menu. */
    public static function notify(
        string $userId,
        string $title,
        ?string $body = null,
        ?string $link = null,
        string $type = 'system',
        ?string $emoji = null,
        ?string $coupleId = null
    ): void {
        if ($userId === '') {
            return;
        }

        Db::insert('notifications', [
            'user_id'   => $userId,
            'couple_id' => $coupleId ?? Auth::coupleId(),
            'type'      => $type,
            'title'     => mb_substr($title, 0, 190),
            'body'      => $body ? mb_substr($body, 0, 480) : null,
            'link'      => $link,
            'emoji'     => $emoji,
        ]);
    }

    /** @return array<int,array<string,mixed>> */
    public static function recent(string $userId, int $limit = 12): array
    {
        $limit = max(1, min(50, $limit));
        return Db::all(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT {$limit}",
            [$userId]
        );
    }

    public static function unreadCount(string $userId): int
    {
        return Db::count('notifications', 'user_id = ? AND read_at IS NULL', [$userId]);
    }

    public static function markAllRead(string $userId): void
    {
        Db::run('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL', [$userId]);
    }
}
