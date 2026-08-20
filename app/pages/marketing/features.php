<?php
declare(strict_types=1);

Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'Features', 'url' => '/features']]);
Seo::softwareApplication();

View::begin('layouts/public', [
    'title'       => 'Features — Love & Care, Letters, Storybook, Fairness, Money & Travel',
    'description' => 'Every FairCouples feature: the Love & Care hub, Open-when letters, voice notes, Our Story & Storybook, love language, date-night generator, couple challenges, conflict repair, surprise mode and long-distance mode — plus the 10-area fairness engine, fair budgeting and full travel planning.',
]);

$groups = [
    [
        'title' => 'Love, every day',
        'lead'  => 'A warm, private home for your relationship — not accounting software.',
        'items' => [
            ['❤️', 'Love & Care hub', 'Each of you shares how you feel and what you need today, and sees the other’s side — with a gentle “relationship weather” and a connection streak that reflects your consistency.'],
            ['💌', 'Send a little love', 'One tap sends “I love you”, “I miss you”, “thinking of you”. Small gestures that arrive as a notification and are kept as a little inbox from their heart.'],
            ['✉️', 'Open-when letters', 'Write a sealed letter for a moment that hasn’t happened yet — a bad day, an argument, missing you. It stays hidden until they choose to open it.'],
            ['🌷', 'Gratitude, on purpose', 'A daily “I’m grateful for you because…”, kept as a running record of the good — and counted in your milestones.'],
            ['🎙️', 'Voice notes', 'Record a message right in the browser — a good-morning, an I-miss-you, a laugh. Stored privately and played back only by the two of you.'],
            ['🎵', 'Our Soundtrack', 'The songs of you two, tied to the moments — first dance, road trips, late-night talks. Add a link and play them when you like; one is “our song”.'],
        ],
    ],
    [
        'title' => 'Remember & grow together',
        'lead'  => 'Keep what matters, and keep getting closer.',
        'items' => [
            ['💕', 'Our Story & Storybook', 'A beautiful photo timeline of your milestones, plus a written, co-authored Storybook the two of you fill a chapter at a time, guided by evocative prompts.'],
            ['🌎', 'Bucket list', 'The things you want to do together — sunrise, Paris, the northern lights — ticked off as you go, with a warm progress bar.'],
            ['❤️', 'Love-language tool', 'Each of you scores the five languages and flags what you need most right now; the other sees exactly how to love you today.'],
            ['💞', 'Date-night generator', 'Pick a mood, place, budget and time and get a coherent plan — deterministic, so you can regenerate and save the keepers.'],
            ['🎯', 'Couple challenges', 'Short guided programmes — a 7-day connection challenge, a 14-day deep-talk, a long-distance closeness week — one prompt a day.'],
            ['💙', 'Guided conflict repair', 'A calm, five-step way through a disagreement: you each answer the same questions for yourself, then read both sides. Not to win — to understand.'],
            ['🎁', 'Surprise mode', 'Write something now and schedule it for later; it stays sealed until the exact moment you choose, then unlocks for them.'],
            ['✈️', 'Long-distance mode', 'Both your local clocks ticking live, how many hours apart you are, and a countdown to the next time you’re together.'],
        ],
    ],
    [
        'title' => 'Measure the relationship',
        'lead'  => 'The part nobody else does: two independent sets of answers, compared.',
        'items' => [
            ['⚖️', 'Ten-area fairness scoring', 'Emotional connection, communication, respect and boundaries, trust and loyalty, financial fairness, time and attention, conflict management, affection and care, growth and future alignment, deal breakers. Thirty specific behaviours sit underneath them.'],
            ['👥', 'Both partners, separately', 'Each of you scores yourself and the other. Nobody answers on anybody else’s behalf, and the report is built from both sides at once.'],
            ['📊', 'Balance index (0–100)', 'One number for whether effort is actually even this period, plus a weighted overall score across all ten areas.'],
            ['🔍', 'Perception gaps', 'Where what you said about yourself differs from what your partner said about you. That gap is usually the real argument.'],
            ['📈', '12-week trend', 'Effort per partner over time, so you can see whether a bad week was a blip or a slide.'],
            ['🚨', 'Risk levels & insights', 'Healthy, watch, strained or critical — with plain-language reasons and the fair rule for each flagged area.'],
        ],
    ],
    [
        'title' => 'Say how you feel',
        'lead'  => 'Emotions logged as data, not as a diary nobody reads.',
        'items' => [
            ['😊', '30 emotions with intensity', 'Positive, neutral and difficult, each 1–10, tagged by whether it is about you, your partner or the relationship.'],
            ['🎯', 'Trigger and need', 'Two fields that turn “I feel ignored” into something actionable: what set it off, and what you need right now.'],
            ['🔒', 'Private mode', 'Any entry can stay visible only to you, while still counting in your own trend data.'],
            ['🤝', 'Acknowledgement', 'Your partner can mark that they have read it — so it never disappears unanswered.'],
            ['📅', 'Daily check-in', 'A 30-second ritual: day rating, connection, one gratitude, one challenge, one need.'],
            ['💕', 'Love vs Attraction', 'Twenty questions separating consistency from intensity. Free, and better when you both take it apart.'],
        ],
    ],
    [
        'title' => 'Talk and share',
        'lead'  => 'A private space that is not buried in a group chat.',
        'items' => [
            ['💬', 'Private messaging', 'Just the two of you. Text, smileys and reactions, with a message history that stays put.'],
            ['🖼️', 'Photo sharing', 'Shared albums for trips and ordinary days. Files sit outside the web root and are only served to the two of you.'],
            ['🔔', 'Partner activity', 'A notification when they log an entry or reply — never the content of a private note.'],
            ['🌍', 'Built for distance', 'Different countries, different time zones. Both sides log independently and both see the same report.'],
        ],
    ],
    [
        'title' => 'Plan the practical side',
        'lead'  => 'Money and logistics are where most arguments actually start.',
        'items' => [
            ['💸', 'Fair expense splitting', 'Split equally, by income, by percentage or not at all. Each expense records who paid and who owes.'],
            ['📉', 'Proportional by income', 'Enter what you each earn and the split adjusts automatically. Fair does not always mean identical.'],
            ['🧾', 'Budgets & settle up', 'Household, trip, event or gift budgets, with a one-click settle-up that clears the balance.'],
            ['🎁', 'Gifts & wishlists', 'Occasions, ideas, budgets, status and a surprise mode, so nobody has to hint.'],
            ['✅', 'Checklists', 'Packing lists for every climate, plus relationship rituals: the weekly fairness ritual, the repair conversation, the money review.'],
        ],
    ],
    [
        'title' => 'Travel together',
        'lead'  => 'Honeymoons and couples trips, from the idea to the boarding pass.',
        'items' => [
            ['🗺️', 'Destination guides', '54 destinations across 45 countries with daily costs, best months, honeymoon scores and highlights.'],
            ['🤖', 'Itinerary generator', 'Pick the pace and your interests and get a day-by-day plan built from real attractions — deterministic, so you both see the same thing.'],
            ['🧳', 'Packing lists', 'Beach, city, winter, hiking, tech, health and honeymoon — plus a pre-flight checklist.'],
            ['🎫', 'Ticket vault', 'Flights, hotels, trains, car hire, attraction passes, insurance, visas and passports, with departure reminders 14, 7 and 1 days out.'],
            ['💱', 'Five currencies', 'USD, GBP, EUR, CAD and AUD. Your country picks the default and you can change it any time.'],
        ],
    ],
    [
        'title' => 'Run it like a business',
        'lead'  => 'The admin panel controls everything without touching code.',
        'items' => [
            ['👤', 'Member management', 'Roles, suspensions, plan grants and deletion. The subscriber can have their partner removed from a space.'],
            ['💳', 'Stripe and PayPal', 'Both gateways, test or live, with signature-verified idempotent webhooks. Card details never touch this server.'],
            ['📦', 'Package builder', 'Create plans, set every limit, publish prices per currency and interval.'],
            ['📝', 'Blog, pages and FAQ', 'Full on-page SEO fields on every post and page, with the FAQ feeding rich results.'],
            ['🔎', 'SEO controls', 'Per-route metadata, redirects, sitemap, robots.txt and ten JSON-LD schema types.'],
            ['📧', 'SMTP & templates', 'Ten transactional emails, editable, with a delivery log and a test-send button.'],
        ],
    ],
];
?>

<section class="hero" style="padding-block:clamp(2.5rem,2rem+3vw,4rem)">
  <div class="container">
    <p class="eyebrow">Features</p>
    <h1>Everything in FairCouples</h1>
    <p class="lead">
      A private space to love, understand, remember and grow together — with a quiet fairness
      engine underneath and the practical planning attached. Here is the whole product, area by area.
    </p>
    <div class="row mt-3">
      <a class="btn" href="/signup">Start free</a>
      <a class="btn btn-outline" href="/pricing">See pricing</a>
    </div>
  </div>
</section>

<?php foreach ($groups as $index => $group): ?>
  <section class="section<?= $index % 2 === 1 ? '' : '-tight' ?>"
           <?= $index % 2 === 1 ? 'style="background:hsl(var(--secondary) / 0.4)"' : '' ?>>
    <div class="container">
      <h2><?= Str::e($group['title']) ?></h2>
      <p class="muted mt-2" style="max-width:60ch"><?= Str::e($group['lead']) ?></p>

      <div class="grid grid-3 mt-4">
        <?php foreach ($group['items'] as [$emoji, $title, $body]): ?>
          <div class="card feature">
            <span class="feature-icon"><?= $emoji ?></span>
            <h3><?= Str::e($title) ?></h3>
            <p><?= Str::e($body) ?></p>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  </section>
<?php endforeach; ?>

<section class="section">
  <div class="container">
    <div class="card card-accent">
      <div class="card-body center" style="padding:2.5rem 1.5rem">
        <h2>See it with your own week</h2>
        <p class="muted mt-2">The free plan includes the weekly fairness score and daily emotions. No card.</p>
        <a class="btn btn-lg mt-3" href="/signup">Create a free account</a>
      </div>
    </div>
  </div>
</section>

<?php View::end(); ?>
