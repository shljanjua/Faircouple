<?php
declare(strict_types=1);

$categories   = Db::all('SELECT * FROM fairness_categories WHERE is_active = 1 ORDER BY sort_order ASC');
$testimonials = Db::all('SELECT * FROM testimonials WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 6');
$destinations = Db::all('SELECT * FROM destinations WHERE is_active = 1 AND is_featured = 1 ORDER BY popularity DESC LIMIT 6');
$posts        = Db::all('SELECT slug, title, excerpt, reading_minutes, published_at FROM blog_posts WHERE status = "published" ORDER BY published_at DESC LIMIT 3');
$faqs         = Db::all('SELECT question, answer FROM faqs WHERE is_active = 1 AND (page_path = "/" OR page_path IS NULL) ORDER BY sort_order ASC LIMIT 8');
$plans        = Plans::active();
$currency     = Currency::preferred();

Seo::softwareApplication();
Seo::faq($faqs);
Seo::reviews($testimonials);

View::begin('layouts/public', [
    'title'       => Settings::text('site_name', 'FairCouples') . ' — A Private Space to Love, Understand & Grow Together',
    'description' => 'FairCouples is a private space for two people to love, understand, remember and grow together — daily feelings, little love notes, Open-when letters, your shared story, and a fairness engine that helps you notice what needs care. Free forever plan.',
]);
?>

<section class="hero">
  <div class="container">
    <p class="eyebrow">💗 A private space for two people who choose each other</p>
    <h1>Love. Understand. Remember. Grow — together.</h1>
    <p class="lead">
      A warm, private home for your relationship: share how you feel each day, send a little love,
      keep your memories and plan your future side by side. And underneath it all, a quiet
      intelligence that helps you notice what needs care — across ten areas that decide whether
      a relationship holds.
    </p>

    <div class="row mt-3">
      <a class="btn btn-lg" href="/signup">Create your couple space — free</a>
      <a class="btn btn-lg btn-outline" href="/love-or-attraction">Is it love or attraction?</a>
    </div>

    <p class="small muted mt-3">
      Free forever plan · Works long-distance · One subscription covers both partners
    </p>
    <p class="small mt-2" style="font-style:italic;color:hsl(var(--muted-fg))">
      Measure less. Understand more. Love better. ❤️
    </p>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <div class="grid grid-4">
      <?php
      $stats = [
          ['10 areas', 'Emotional connection to deal breakers, each with a fair rule'],
          ['2 sides', 'Both partners answer independently — nobody fills it in for two'],
          ['0–100', 'A balance index that says whether effort is actually even'],
          ['5 currencies', 'USD, GBP, EUR, CAD and AUD, picked by your country'],
      ];
      foreach ($stats as [$value, $label]): ?>
        <div class="card stat">
          <p class="stat-value" style="font-size:1.5rem"><?= Str::e($value) ?></p>
          <p class="stat-hint"><?= Str::e($label) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <h2>Everything a couple actually argues about, in one place</h2>
    <p class="muted mt-2" style="max-width:62ch">
      Not a mood diary. A measurement tool with the practical planning attached — money, gifts, checklists,
      tickets and travel — so the conversation has evidence behind it.
    </p>

    <div class="grid grid-3 mt-4">
      <?php
      $features = [
          ['⚖️', 'Fairness scoring', 'Ten areas, thirty behaviours. Both of you score yourself and each other; the report shows the gap.'],
          ['😊', 'Emotions, both sides', '30 emotions with intensity, triggers and what you need. Mark an entry private and only you see it.'],
          ['💬', 'Private messaging', 'Text, photos, reactions and smileys — separate from every other app on your phone.'],
          ['💸', 'Fair money splitting', 'Split equally or by income. Log expenses, settle up, and stop guessing who paid for what.'],
          ['✈️', 'Travel & itineraries', 'Pick a destination and get a day-by-day plan. Packing lists for every climate and trip type.'],
          ['🎫', 'Ticket vault', 'Flights, hotels, attraction passes, insurance and visas — reachable by both of you when you need them.'],
          ['🎁', 'Gifts & wishlists', 'Ideas, occasions, budgets and a surprise mode, so nobody has to guess or hint.'],
          ['💕', 'Love vs Attraction', 'Twenty questions that separate consistency from intensity. Answer it independently.'],
          ['📊', 'Weekly report', 'A balance index, perception gaps, risk level and a plain-language verdict, emailed to you both.'],
      ];
      foreach ($features as [$emoji, $title, $body]): ?>
        <div class="card feature">
          <span class="feature-icon"><?= $emoji ?></span>
          <h3><?= Str::e($title) ?></h3>
          <p><?= Str::e($body) ?></p>
        </div>
      <?php endforeach; ?>
    </div>

    <div class="row mt-4">
      <a class="btn btn-outline" href="/features">See every feature</a>
    </div>
  </div>
</section>

<section class="section" style="background:hsl(var(--secondary) / 0.4)">
  <div class="container">
    <h2>The ten areas we measure</h2>
    <p class="muted mt-2" style="max-width:62ch">
      Each area carries a fair rule — the one sentence that decides whether it is balanced.
      Every relationship type falls under the same framework: partners, spouses, a mother and son,
      siblings, close friends.
    </p>

    <div class="grid grid-2 mt-4">
      <?php foreach ($categories as $category): ?>
        <div class="card">
          <div class="card-body">
            <div class="row" style="align-items:flex-start;gap:0.75rem">
              <span style="font-size:1.6rem;line-height:1"><?= Str::e($category['emoji']) ?></span>
              <div style="flex:1;min-width:0">
                <h3 style="font-family:var(--font);font-size:1rem">
                  <?= Str::e($category['name']) ?>
                  <?php if (Str::bool($category['is_dealbreaker'])): ?>
                    <span class="badge badge-danger">Non-negotiable</span>
                  <?php endif; ?>
                </h3>
                <p class="small muted mt-1"><?= Str::e($category['description']) ?></p>
                <p class="small mt-2"><strong>Fair rule:</strong> <?= Str::e($category['fair_rule']) ?></p>
              </div>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

    <div class="row mt-4">
      <a class="btn" href="/fairness">Read the full framework</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="grid grid-sidebar">
      <div>
        <h2>The fairness formula</h2>
        <p class="muted mt-2">
          A relationship stays healthy when four things are roughly symmetrical. Not identical — symmetrical.
        </p>

        <div class="card mt-3">
          <div class="card-body center" style="font-family:var(--font-display);font-size:1.15rem;line-height:2">
            Effort<sub>one</sub> &nbsp;≈&nbsp; Effort<sub>other</sub><br>
            Respect &nbsp;=&nbsp; Respect<br>
            Loyalty &nbsp;=&nbsp; Loyalty
          </div>
        </div>

        <div class="alert alert-warning mt-3">
          <div>
            <strong>The reality check</strong>
            Some days one gives 70% and the other gives 30% — that is normal, and it should swap.
            If the same person is always the one giving more, that is not love, it is a pattern. And patterns
            turn into resentment.
          </div>
        </div>
      </div>

      <div>
        <h2 style="font-size:1.3rem">The healthy cycle</h2>
        <ol class="list-plain mt-2">
          <?php
          $cycle = [
              ['✨', 'Attraction', 'Chemistry, curiosity, interest.'],
              ['💬', 'Communication', 'Learning how to talk and be understood.'],
              ['🔐', 'Trust building', 'Consistency over time becomes safety.'],
              ['⚡', 'Conflict testing', 'The first real disagreements show how you repair.'],
              ['💞', 'Deeper bonding', 'Shared history, shared plans, real intimacy.'],
              ['🏡', 'Long-term stability', 'Sustained fairness, effort and direction.'],
          ];
          foreach ($cycle as $index => [$emoji, $name, $detail]): ?>
            <li class="card">
              <div class="card-body" style="padding:0.85rem 1rem">
                <p class="bold"><?= $emoji ?> <?= (int) ($index + 1) ?>. <?= Str::e($name) ?></p>
                <p class="small muted"><?= Str::e($detail) ?></p>
              </div>
            </li>
          <?php endforeach; ?>
        </ol>
      </div>
    </div>
  </div>
</section>

<?php if ($destinations !== []): ?>
<section class="section" style="background:hsl(var(--secondary) / 0.4)">
  <div class="container">
    <div class="row-between">
      <div>
        <h2>Plan the trip together</h2>
        <p class="muted mt-2">Honeymoons and couples travel, with real costs, the right months and a generated day-by-day plan.</p>
      </div>
      <a class="btn btn-outline" href="/destinations">All destinations</a>
    </div>

    <div class="grid grid-3 mt-4">
      <?php foreach ($destinations as $destination): ?>
        <a class="card" href="/destinations/<?= Str::e($destination['slug']) ?>" style="overflow:hidden;color:inherit">
          <?php if ($destination['hero_image']): ?>
            <img src="<?= Str::e($destination['hero_image']) ?>?w=600&q=70" alt=""
                 loading="lazy" style="aspect-ratio:16/10;object-fit:cover;width:100%">
          <?php endif; ?>
          <div class="card-body" style="padding:1rem">
            <p class="bold"><?= Str::e($destination['name']) ?></p>
            <p class="small muted"><?= Str::e(Str::excerpt($destination['summary'], 90)) ?></p>
            <p class="tiny muted mt-2">
              <?php if ($destination['avg_daily_cost_usd']): ?>
                ≈ $<?= (int) $destination['avg_daily_cost_usd'] ?>/day
              <?php endif; ?>
              <?php if ($destination['ideal_days']): ?>
                · <?= (int) $destination['ideal_days'] ?> days
              <?php endif; ?>
            </p>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if ($testimonials !== []): ?>
<section class="section">
  <div class="container">
    <h2>What couples say</h2>
    <div class="grid grid-3 mt-4">
      <?php foreach ($testimonials as $testimonial): ?>
        <figure class="card">
          <div class="card-body">
            <p style="font-size:0.95rem">&ldquo;<?= Str::e($testimonial['quote']) ?>&rdquo;</p>
            <figcaption class="small muted mt-3">
              <strong style="color:hsl(var(--foreground))"><?= Str::e($testimonial['author_name']) ?></strong><br>
              <?= Str::e(trim(($testimonial['author_role'] ?? '') . ' · ' . ($testimonial['author_location'] ?? ''), ' ·')) ?>
            </figcaption>
          </div>
        </figure>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if ($plans !== []): ?>
<section class="section" style="background:hsl(var(--secondary) / 0.4)">
  <div class="container">
    <div class="row-between">
      <div>
        <h2>One subscription covers both of you</h2>
        <p class="muted mt-2">When one partner subscribes, both get the full plan. You never pay twice.</p>
      </div>
      <a class="btn btn-outline" href="/pricing">Compare the plans</a>
    </div>

    <div class="grid grid-4 mt-4">
      <?php foreach ($plans as $plan):
          $price = Plans::price($plan, $currency, 'year') ?? Plans::price($plan, $currency, 'lifetime');
      ?>
        <div class="card price-card <?= Str::bool($plan['is_featured']) ? 'is-featured' : '' ?>">
          <?php if ($plan['badge']): ?><span class="badge badge-primary"><?= Str::e($plan['badge']) ?></span><?php endif; ?>
          <h3 style="font-family:var(--font);font-size:1.05rem;margin-top:0.5rem"><?= Str::e($plan['name']) ?></h3>
          <p class="price-amount">
            <?php if (Str::bool($plan['is_free'])): ?>
              Free
            <?php elseif ($price): ?>
              <?= Str::e(Currency::pretty((int) $price['amount_cents'], $currency)) ?>
              <span class="small muted" style="font-family:var(--font);font-weight:400">
                /<?= $price['billing_interval'] === 'lifetime' ? 'once' : Str::e($price['billing_interval']) ?>
              </span>
            <?php else: ?>
              —
            <?php endif; ?>
          </p>
          <p class="small muted"><?= Str::e($plan['tagline']) ?></p>
          <a class="btn <?= Str::bool($plan['is_featured']) ? '' : 'btn-outline' ?> btn-block mt-3"
             href="<?= Str::bool($plan['is_free']) ? '/signup' : '/signup?plan=' . Str::e($plan['slug']) ?>">
            <?= Str::bool($plan['is_free']) ? 'Start free' : 'Choose ' . Str::e($plan['name']) ?>
          </a>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if ($faqs !== []): ?>
<section class="section">
  <div class="container container-narrow">
    <h2>Common questions</h2>
    <div class="mt-4">
      <?php foreach ($faqs as $faq): ?>
        <details class="accordion">
          <summary><?= Str::e($faq['question']) ?></summary>
          <div class="accordion-body"><?= Str::e($faq['answer']) ?></div>
        </details>
      <?php endforeach; ?>
    </div>
    <p class="mt-3"><a href="/faq">All questions →</a></p>
  </div>
</section>
<?php endif; ?>

<?php if ($posts !== []): ?>
<section class="section-tight">
  <div class="container">
    <div class="row-between">
      <h2 style="font-size:1.4rem">From the blog</h2>
      <a href="/blog">All articles →</a>
    </div>
    <div class="grid grid-3 mt-3">
      <?php foreach ($posts as $post): ?>
        <a class="card" href="/blog/<?= Str::e($post['slug']) ?>" style="color:inherit">
          <div class="card-body">
            <p class="bold"><?= Str::e($post['title']) ?></p>
            <p class="small muted mt-1"><?= Str::e(Str::excerpt($post['excerpt'], 110)) ?></p>
            <p class="tiny muted mt-2"><?= (int) $post['reading_minutes'] ?> min read · <?= Str::e(Str::date($post['published_at'])) ?></p>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="section">
  <div class="container">
    <div class="card card-accent">
      <div class="card-body center" style="padding:3rem 1.5rem">
        <h2>Structure + effort + respect + consistency</h2>
        <p class="muted mt-2" style="max-width:52ch;margin-inline:auto">
          That is the whole formula. Start measuring it this week — the free plan gives you
          daily emotions, the weekly fairness score and your own private space.
        </p>
        <div class="row mt-3" style="justify-content:center">
          <a class="btn btn-lg" href="/signup">Create a free account</a>
          <a class="btn btn-lg btn-outline" href="/pricing">See the plans</a>
        </div>
      </div>
    </div>
  </div>
</section>

<?php View::end(); ?>
