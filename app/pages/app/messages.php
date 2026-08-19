<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$partner  = $context['partner'];

$conversation = Db::one('SELECT * FROM conversations WHERE couple_id = ? AND kind = "direct" LIMIT 1', [$coupleId]);

if (!$conversation) {
    $id = Db::insert('conversations', ['couple_id' => $coupleId, 'kind' => 'direct', 'title' => 'Private chat']);
    $conversation = Db::one('SELECT * FROM conversations WHERE id = ? LIMIT 1', [$id]);
}

/* ------------------------------------------------------------------ Posting */

if (Request::isPost()) {
    $action = Request::input('action', 'send');

    if ($action === 'delete') {
        Db::run(
            'UPDATE messages SET deleted_at = UTC_TIMESTAMP()
              WHERE id = ? AND sender_id = ? AND couple_id = ?',
            [Request::input('id'), $user['id'], $coupleId]
        );
        Response::redirect('/dashboard/messages');
    }

    if ($action === 'react') {
        $message = Db::one('SELECT reactions FROM messages WHERE id = ? AND couple_id = ? LIMIT 1', [Request::input('id'), $coupleId]);
        if ($message) {
            $emoji = Request::input('emoji');
            $reactions = Str::json($message['reactions']);
            $people = $reactions[$emoji] ?? [];

            if (in_array($user['id'], $people, true)) {
                $people = array_values(array_diff($people, [$user['id']]));
            } else {
                $people[] = $user['id'];
            }

            if ($people === []) {
                unset($reactions[$emoji]);
            } else {
                $reactions[$emoji] = $people;
            }

            Db::run('UPDATE messages SET reactions = ? WHERE id = ?', [json_encode($reactions), Request::input('id')]);
        }
        Response::redirect('/dashboard/messages');
    }

    // Sending — the monthly limit is enforced here, where it cannot be bypassed.
    $limitError = Plans::check('messages', 'messages', 'sender_id = ? AND created_at >= ?', [$user['id'], date('Y-m-01 00:00:00')]);
    if ($limitError !== null) {
        Flash::error($limitError);
        Response::redirect('/dashboard/messages');
    }

    $body = trim(Request::raw('body'));
    $messageType = 'text';
    $attachment = null;

    // An optional photo travels with the message.
    if (!empty($_FILES['photo']['name'])) {
        $quotaError = Plans::storageProblem($coupleId, (int) ($_FILES['photo']['size'] ?? 0));
        if ($quotaError !== null) {
            Flash::error($quotaError);
            Response::redirect('/dashboard/messages');
        }

        $stored = Storage::store($_FILES['photo'], 'couple-media', $coupleId, $user['id'], 'chat');
        if (!$stored['ok']) {
            Flash::error($stored['error']);
            Response::redirect('/dashboard/messages');
        }

        $attachment = $stored;
        $messageType = 'image';

        // Chat photos also land in the shared gallery.
        Db::insert('media_assets', [
            'couple_id'  => $coupleId,
            'user_id'    => $user['id'],
            'bucket'     => 'couple-media',
            'path'       => $stored['path'],
            'file_name'  => $stored['name'],
            'mime_type'  => $stored['mime'],
            'size_bytes' => $stored['size'],
            'kind'       => 'photo',
            'album'      => 'Chat',
        ]);
    }

    if ($messageType === 'text' && $body === '') {
        Response::redirect('/dashboard/messages');
    }

    Db::insert('messages', [
        'conversation_id' => $conversation['id'],
        'couple_id'       => $coupleId,
        'sender_id'       => $user['id'],
        'body'            => $messageType === 'text' ? mb_substr($body, 0, 4000) : null,
        'message_type'    => $messageType,
        'attachment_path' => $attachment['path'] ?? null,
        'attachment_name' => $attachment['name'] ?? null,
        'attachment_size' => $attachment['size'] ?? null,
        'attachment_mime' => $attachment['mime'] ?? null,
    ]);

    Db::run(
        'UPDATE conversations SET last_message_at = UTC_TIMESTAMP(), last_message_preview = ? WHERE id = ?',
        [mb_substr($body !== '' ? $body : 'Photo', 0, 120), $conversation['id']]
    );

    if ($partner) {
        Audit::notify(
            $partner['user_id'],
            'New message from ' . ($user['display_name'] ?: $user['full_name'] ?: 'your partner'),
            mb_substr($body !== '' ? $body : 'Sent a photo', 0, 100),
            '/dashboard/messages',
            'message',
            '💬',
            $coupleId
        );
    }

    Response::redirect('/dashboard/messages');
}

/* ------------------------------------------------------------------ Reading */

$messages = Db::all(
    'SELECT * FROM messages WHERE conversation_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 300',
    [$conversation['id']]
);

Db::run(
    'UPDATE messages SET read_at = UTC_TIMESTAMP()
      WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL',
    [$conversation['id'], $user['id']]
);

$newest = $messages === [] ? '' : (string) end($messages)['created_at'];
$emojis = ['😀','😂','🥰','😍','😘','😉','😌','😴','🤗','🤔','😢','😭','😤','😡','🥺','😳','🙈','🤷','👍','👎',
           '👏','🙏','💪','❤️','💔','💕','💗','💐','🌹','🔥','✨','🎉','🎁','☕','🍕','🍷','✈️','🏖️','🌙','☀️'];

View::begin('layouts/app', ['title' => 'Messages', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Private messages</h1>
  <p>Just the two of you — text, photos and reactions, separate from every other app on your phone.</p>
</div>

<div class="card chat">
  <div class="card-head">
    <div class="row" style="gap:0.6rem">
      <?= View::avatar($partner['avatar_url'] ?? null, $partner['full_name'] ?? 'Partner', 36) ?>
      <span>
        <span class="bold"><?= Str::e($partner['display_name'] ?? $partner['full_name'] ?? 'Waiting for your partner') ?></span>
        <span class="tiny muted" style="display:block">
          <?= $partner ? 'Private to this space' : 'Invite them to start chatting' ?>
        </span>
      </span>
    </div>
  </div>

  <div class="chat-log" id="chat-log"
       data-poll-url="/dashboard/messages/poll?c=<?= Str::e($conversation['id']) ?>"
       data-after="<?= Str::e($newest) ?>">
    <?php if ($messages === []): ?>
      <p class="center muted small" style="padding:2rem">No messages yet. Say the first thing.</p>
    <?php endif; ?>

    <?php foreach ($messages as $message): ?>
      <?php View::partial('partials/message-bubble', ['message' => $message, 'meId' => $user['id']]); ?>
    <?php endforeach; ?>
  </div>

  <details>
    <summary class="small muted" style="padding:0.5rem 0.75rem;cursor:pointer">Smileys</summary>
    <div class="emoji-grid">
      <?php foreach ($emojis as $emoji): ?>
        <button type="button" data-emoji="<?= Str::e($emoji) ?>" data-emoji-target="message-body"
                aria-label="Insert <?= Str::e($emoji) ?>"><?= $emoji ?></button>
      <?php endforeach; ?>
    </div>
  </details>

  <form method="post" enctype="multipart/form-data" class="chat-compose">
    <?= Csrf::field() ?>
    <input type="hidden" name="action" value="send">

    <label class="btn btn-ghost btn-icon" title="Send a photo">
      <?= View::icon('image') ?>
      <span class="sr-only">Attach a photo</span>
      <input type="file" name="photo" accept="image/*" class="sr-only"
             onchange="this.form.querySelector('button[type=submit]').focus()">
    </label>

    <label class="sr-only" for="message-body">Message</label>
    <input class="input" id="message-body" name="body" style="flex:1"
           placeholder="<?= $partner ? 'Write a message…' : 'Invite your partner to start chatting' ?>"
           autocomplete="off" maxlength="4000">

    <button class="btn btn-icon" type="submit" aria-label="Send"><?= View::icon('arrow-right') ?></button>
  </form>
</div>

<p class="tiny muted mt-2">
  Photos sent here also appear in <a href="/dashboard/gallery">Photos</a>. Nothing in this chat is visible
  to anybody but the two of you.
</p>

<?php View::end(); ?>
