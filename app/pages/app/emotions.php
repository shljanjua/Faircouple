<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];
$partner  = $context['partner'];

if (Request::isPost()) {
    $action = Request::input('action', 'log');

    if ($action === 'delete') {
        $id = Request::input('id');
        Db::delete('emotion_logs', 'id = ? AND user_id = ? AND couple_id = ?', [$id, $user['id'], $coupleId]);
        Flash::success('Entry deleted.');
        Response::redirect('/dashboard/emotions');
    }

    if ($action === 'acknowledge') {
        Db::run(
            'UPDATE emotion_logs SET acknowledged_by = ?, acknowledged_at = UTC_TIMESTAMP()
              WHERE id = ? AND couple_id = ? AND user_id <> ?',
            [$user['id'], Request::input('id'), $coupleId, $user['id']]
        );
        Flash::success('Acknowledged — they will see that you read it.');
        Response::redirect('/dashboard/emotions');
    }

    // Logging a new emotion.
    $limitError = Plans::check('emotion_logs', 'emotion_logs', 'logged_at >= ?', [date('Y-m-01 00:00:00')]);
    if ($limitError !== null) {
        Flash::error($limitError);
        Response::redirect('/dashboard/emotions');
    }

    $slug = Request::input('emotion_slug');
    if ($slug === '') {
        Flash::error('Pick an emotion first.');
        Response::redirect('/dashboard/emotions');
    }

    $scope = Request::input('scope', 'self');
    $isPrivate = Request::bool('is_private');

    Db::insert('emotion_logs', [
        'couple_id'     => $coupleId,
        'user_id'       => $user['id'],
        'about_user_id' => $scope === 'partner' ? ($partner['user_id'] ?? null) : null,
        'scope'         => in_array($scope, ['self', 'partner', 'relationship'], true) ? $scope : 'self',
        'emotion_slug'  => $slug,
        'intensity'     => max(1, min(10, Request::int('intensity', 5))),
        'mood_score'    => Request::input('mood_score') === '' ? null : Request::int('mood_score'),
        'energy'        => Request::input('energy') === '' ? null : Request::int('energy'),
        'trigger_text'  => Request::nullable('trigger'),
        'need_text'     => Request::nullable('need'),
        'note'          => Request::nullable('note'),
        'tags'          => json_encode(array_values(array_filter(array_map('trim', explode(',', Request::input('tags')))))),
        'is_private'    => $isPrivate,
        'shared_at'     => $isPrivate ? null : Str::now(),
    ]);

    if (!$isPrivate && $partner) {
        Audit::notify(
            $partner['user_id'],
            ($user['display_name'] ?: $user['full_name'] ?: 'Your partner') . ' shared how they feel',
            $scope === 'partner' ? 'It is about you — read it before replying.' : null,
            '/dashboard/emotions',
            'emotion',
            '💗',
            $coupleId
        );
    }

    Flash::success('Logged.');
    Response::redirect('/dashboard/emotions');
}

$types = Db::all('SELECT * FROM emotion_types WHERE is_active = 1 ORDER BY sort_order ASC');

$byValence = ['positive' => [], 'neutral' => [], 'negative' => []];
foreach ($types as $type) {
    $byValence[$type['valence']][] = $type;
}

$logs = Db::all(
    'SELECT e.*, t.label, t.emoji, t.valence, p.full_name, p.display_name
       FROM emotion_logs e
       LEFT JOIN emotion_types t ON t.slug = e.emotion_slug
       LEFT JOIN profiles p ON p.id = e.user_id
      WHERE e.couple_id = ? AND (e.is_private = 0 OR e.user_id = ?)
      ORDER BY e.logged_at DESC LIMIT 60',
    [$coupleId, $user['id']]
);

// 30-day mood, both partners side by side.
$mood = Db::all(
    'SELECT DATE(logged_at) AS day, user_id, AVG(COALESCE(mood_score, intensity)) AS score
       FROM emotion_logs
      WHERE couple_id = ? AND logged_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
      GROUP BY DATE(logged_at), user_id
      ORDER BY day ASC',
    [$coupleId]
);

$moodByDay = [];
foreach ($mood as $row) {
    $moodByDay[$row['day']][$row['user_id'] === $user['id'] ? 'me' : 'them'] = (float) $row['score'];
}

View::begin('layouts/app', ['title' => 'Emotions', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Emotions</h1>
  <p>Name it, rate it, and say what you need. Mark anything private and only you will ever see the words.</p>
</div>

<div class="grid grid-sidebar">
  <div class="stack">
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="log">

      <div class="card-head"><h2>How do you feel right now?</h2></div>
      <div class="card-body">
        <div class="field">
          <span class="label">Pick one <span class="required">*</span></span>
          <?php foreach (['positive' => 'Good', 'neutral' => 'Neutral', 'negative' => 'Difficult'] as $valence => $label): ?>
            <?php if ($byValence[$valence] === []) { continue; } ?>
            <p class="tiny muted mt-2"><?= $label ?></p>
            <div class="row" style="gap:0.35rem">
              <?php foreach ($byValence[$valence] as $type): ?>
                <label class="badge" style="cursor:pointer;padding:0.35rem 0.6rem">
                  <input type="radio" name="emotion_slug" value="<?= Str::e($type['slug']) ?>" required
                         style="margin-right:0.25rem;accent-color:hsl(var(--primary))">
                  <?= Str::e($type['emoji']) ?> <?= Str::e($type['label']) ?>
                </label>
              <?php endforeach; ?>
            </div>
          <?php endforeach; ?>
        </div>

        <div class="field-row mt-3">
          <div class="field">
            <label for="intensity">
              Intensity <output id="out-intensity" class="tabular bold">5</output>/10
            </label>
            <input type="range" min="1" max="10" id="intensity" name="intensity" value="5" data-output="out-intensity">
          </div>

          <div class="field">
            <label for="scope">This is about</label>
            <select class="select" id="scope" name="scope">
              <option value="self">Me</option>
              <option value="partner">My partner</option>
              <option value="relationship">The relationship</option>
            </select>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="trigger">What set it off?</label>
            <input class="input" id="trigger" name="trigger" maxlength="200" placeholder="A comment at dinner…">
          </div>
          <div class="field">
            <label for="need">What do you need right now?</label>
            <input class="input" id="need" name="need" maxlength="200" placeholder="Twenty minutes and no phones">
          </div>
        </div>

        <div class="field">
          <label for="note">Anything else</label>
          <textarea class="textarea" rows="3" id="note" name="note"></textarea>
        </div>

        <label class="checkbox mt-2">
          <input type="checkbox" name="is_private" value="1">
          <span class="small muted">Keep this private. It still counts in your own trend, but your partner never sees it.</span>
        </label>

        <button class="btn mt-3" type="submit">Log this feeling</button>
      </div>
    </form>

    <div class="card">
      <div class="card-head"><h2>Recent entries</h2></div>
      <div class="card-body">
        <?php if ($logs === []): ?>
          <div class="empty">
            <p class="empty-emoji">💭</p>
            <p class="bold">Nothing logged yet</p>
            <p>Log one a day for two weeks and the pattern becomes obvious.</p>
          </div>
        <?php else: ?>
          <ul class="list-plain">
            <?php foreach ($logs as $log): ?>
              <?php $isMine = $log['user_id'] === $user['id']; ?>
              <li class="card card-flat">
                <div class="card-body" style="padding:0.9rem 1rem">
                  <div class="row-between">
                    <span class="row" style="gap:0.6rem">
                      <span style="font-size:1.5rem"><?= Str::e($log['emoji'] ?: '💬') ?></span>
                      <span>
                        <span class="bold"><?= Str::e($log['label'] ?: $log['emotion_slug']) ?></span>
                        <span class="muted small">· <?= (int) $log['intensity'] ?>/10</span>
                        <span class="tiny muted" style="display:block">
                          <?= Str::e($isMine ? 'You' : ($log['display_name'] ?: $log['full_name'] ?: 'Partner')) ?>
                          · <?= Str::e(Str::timeAgo($log['logged_at'])) ?>
                          <?php if ($log['scope'] !== 'self'): ?>
                            · about <?= Str::e($log['scope'] === 'partner' ? 'their partner' : 'the relationship') ?>
                          <?php endif; ?>
                        </span>
                      </span>
                    </span>

                    <span class="row" style="gap:0.35rem">
                      <?php if (Str::bool($log['is_private'])): ?>
                        <span class="badge">🔒 private</span>
                      <?php endif; ?>
                      <?php if (!$isMine && !$log['acknowledged_at']): ?>
                        <form method="post">
                          <?= Csrf::field() ?>
                          <input type="hidden" name="action" value="acknowledge">
                          <input type="hidden" name="id" value="<?= Str::e($log['id']) ?>">
                          <button class="btn btn-sm btn-ghost" type="submit">Acknowledge</button>
                        </form>
                      <?php elseif ($log['acknowledged_at']): ?>
                        <span class="badge badge-success">seen</span>
                      <?php endif; ?>
                      <?php if ($isMine): ?>
                        <form method="post" data-confirm="Delete this entry?">
                          <?= Csrf::field() ?>
                          <input type="hidden" name="action" value="delete">
                          <input type="hidden" name="id" value="<?= Str::e($log['id']) ?>">
                          <button class="btn btn-sm btn-ghost" type="submit" aria-label="Delete">✕</button>
                        </form>
                      <?php endif; ?>
                    </span>
                  </div>

                  <?php if ($log['trigger_text'] || $log['need_text'] || $log['note']): ?>
                    <div class="small mt-2">
                      <?php if ($log['trigger_text']): ?>
                        <p><span class="muted">Trigger:</span> <?= Str::e($log['trigger_text']) ?></p>
                      <?php endif; ?>
                      <?php if ($log['need_text']): ?>
                        <p><span class="muted">Needs:</span> <?= Str::e($log['need_text']) ?></p>
                      <?php endif; ?>
                      <?php if ($log['note']): ?>
                        <p class="muted"><?= Str::e($log['note']) ?></p>
                      <?php endif; ?>
                    </div>
                  <?php endif; ?>
                </div>
              </li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>
      </div>
    </div>
  </div>

  <aside class="stack">
    <div class="card">
      <div class="card-head"><h2>Last 30 days</h2></div>
      <div class="card-body">
        <?php if ($moodByDay === []): ?>
          <p class="small muted">The chart appears once you have a few entries.</p>
        <?php else: ?>
          <div class="chart" style="height:8rem">
            <?php foreach ($moodByDay as $day => $scores): ?>
              <div class="chart-col" title="<?= Str::e($day) ?>">
                <span class="chart-bar" style="height:<?= max(2, (int) round(($scores['me'] ?? 0) * 9)) ?>%"></span>
                <span class="chart-bar is-b" style="height:<?= max(2, (int) round(($scores['them'] ?? 0) * 9)) ?>%"></span>
              </div>
            <?php endforeach; ?>
          </div>
          <p class="tiny muted mt-2">Solid = you. Faded = your partner. Taller is a better day.</p>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <h2 style="font-size:1rem">Why both sides matter</h2>
        <p class="small muted mt-2">
          One person&rsquo;s mood chart is a diary. Two charts side by side show whether a bad week was
          shared or one-sided — and that is the part worth talking about.
        </p>
      </div>
    </div>
  </aside>
</div>

<?php View::end(); ?>
