<?php
declare(strict_types=1);

/** Returns messages newer than the client already has. Polled every 6 seconds. */

$user = Auth::user();
if (!$user) {
    Response::json(['messages' => []], 401);
}

$coupleId = Auth::coupleId();
if (!$coupleId) {
    Response::json(['messages' => []], 403);
}

$conversationId = (string) ($_GET['c'] ?? '');
$after = (string) ($_GET['after'] ?? '');

$conversation = Db::one(
    'SELECT id FROM conversations WHERE id = ? AND couple_id = ? LIMIT 1',
    [$conversationId, $coupleId]
);

if (!$conversation) {
    Response::json(['messages' => []], 404);
}

$rows = $after !== ''
    ? Db::all(
        'SELECT * FROM messages
          WHERE conversation_id = ? AND deleted_at IS NULL AND created_at > ?
          ORDER BY created_at ASC LIMIT 50',
        [$conversationId, $after]
    )
    : Db::all(
        'SELECT * FROM messages WHERE conversation_id = ? AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 30',
        [$conversationId]
    );

if ($after === '') {
    $rows = array_reverse($rows);
}

$payload = [];
foreach ($rows as $row) {
    $payload[] = [
        'id'   => $row['id'],
        'html' => View::capture('partials/message-bubble', ['message' => $row, 'meId' => $user['id']]),
    ];
}

// Anything the partner just sent counts as read the moment it is displayed.
Db::run(
    'UPDATE messages SET read_at = UTC_TIMESTAMP()
      WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL',
    [$conversationId, $user['id']]
);

Response::json([
    'messages' => $payload,
    'after'    => $rows === [] ? $after : (string) end($rows)['created_at'],
]);
