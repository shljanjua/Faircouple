<?php
declare(strict_types=1);

/**
 * Streaks & milestones — an elegant, calm picture of what the two of you have
 * built. A connection streak, and gentle milestones that celebrate consistency
 * rather than gamifying the relationship.
 */

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

$streak     = LoveCare::streak($coupleId);
$milestones = LoveCare::milestones($coupleId);

// The couple's age, if we know when they came together.
$since = $context['couple']['anniversary_date'] ?? null;
$together = null;
if ($since) {
    try {
        $d = (new DateTimeImmutable('today'))->diff(new DateTimeImmutable(substr((string) $since, 0, 10)));
        $parts = [];
        if ($d->y) { $parts[] = $d->y . ' year' . ($d->y === 1 ? '' : 's'); }
        if ($d->m) { $parts[] = $d->m . ' month' . ($d->m === 1 ? '' : 's'); }
        if (!$parts && $d->days >= 0) { $parts[] = $d->days . ' day' . ($d->days === 1 ? '' : 's'); }
        $together = implode(', ', $parts);
    } catch (Throwable) {
        $together = null;
    }
}

// Whether a mood is logged today, to nudge keeping the streak alive.
$loggedToday = (bool) Db::one(
    'SELECT id FROM love_moods WHERE couple_id = ? AND user_id = ? AND mood_date = ? LIMIT 1',
    [$coupleId, $user['id'], Str::today()]
);

View::begin('layouts/app', ['title' => 'Streaks & milestones', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Your milestones</h1>
  <p>Not points to chase — a quiet record of the small, consistent things that add up to a relationship.</p>
</div>

<!-- Connection streak ------------------------------------------------------ -->
<div class="card streak-hero">
  <div class="streak-flame">🔥</div>
  <p class="streak-num"><?= (int) $streak ?></p>
  <p class="streak-label"><?= $streak === 1 ? 'day' : 'days' ?> connected</p>
  <?php if ($together): ?>
    <p class="streak-since">Together <?= Str::e($together) ?></p>
  <?php endif; ?>
  <?php if ($streak > 0 && !$loggedToday): ?>
    <a class="btn btn-sm mt-2" href="/dashboard/love">Check in today to keep it going →</a>
  <?php elseif ($loggedToday): ?>
    <p class="streak-today">You've both got today covered ❤️</p>
  <?php else: ?>
    <a class="btn btn-sm mt-2" href="/dashboard/love">Share how you feel to begin your streak →</a>
  <?php endif; ?>
</div>

<!-- Milestones ------------------------------------------------------------- -->
<div class="milestone-grid mt-3">
  <?php foreach ($milestones as $m): ?>
    <?php
    $span = max(1, ($m['next'] ?? $m['count']) - $m['prev']);
    $progress = $m['maxed'] ? $m['count'] : ($m['count'] - $m['prev']);
    $percent = $m['maxed'] ? 100 : (int) round(min(1, $progress / $span) * 100);
    ?>
    <div class="card milestone-card">
      <div class="milestone-top">
        <span class="milestone-emoji"><?= $m['emoji'] ?></span>
        <span class="milestone-count"><?= number_format($m['count']) ?></span>
      </div>
      <p class="milestone-label"><?= Str::e($m['label']) ?></p>
      <span class="meter mt-1">
        <span class="meter-fill meter-primary" style="width:<?= $percent ?>%"></span>
      </span>
      <p class="milestone-next">
        <?php if ($m['maxed']): ?>
          🏆 Every milestone reached
        <?php else: ?>
          <?= number_format($m['next'] - $m['count']) ?> to go until <?= number_format($m['next']) ?>
        <?php endif; ?>
      </p>
    </div>
  <?php endforeach; ?>
</div>

<div class="card mt-3">
  <div class="card-body">
    <p class="small muted">
      Milestones grow as you use your space together — a message here, a note of appreciation there,
      a memory saved, a trip planned. They're a reflection, not a scoreboard.
    </p>
  </div>
</div>

<?php View::end(); ?>
