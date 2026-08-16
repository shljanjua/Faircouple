import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  Heart,
  Lock,
  MessageCircle,
  Plane,
  Scale,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getPublicSettings } from '@/lib/settings';
import { buildMetadata, faqSchema, softwareApplicationSchema, howToSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { ButtonLink } from '@/components/ui/button';
import { Badge, Card, SectionHeading } from '@/components/ui';
import { PricingTable } from '@/components/marketing/pricing-table';
import { formatMoney } from '@/lib/currency';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    path: '/',
    keywords: [
      'relationship app for couples',
      'fairness in relationships',
      'couples emotion tracker',
      'relationship compatibility test',
      'couples budget app',
      'honeymoon itinerary planner',
      'love vs attraction test',
      'shared expense splitter for couples',
    ],
  });
}

const FEATURES = [
  {
    icon: Scale,
    title: 'The 10-area fairness score',
    body:
      'Emotional connection, communication, respect, trust, money, time, conflict, affection, growth and deal breakers — each with a fair rule that keeps it honest.',
    href: '/fairness',
  },
  {
    icon: Heart,
    title: 'Emotions, from both sides',
    body:
      'Log what you feel about yourself, about your partner and about the relationship. Private entries stay private; shared ones invite a reply.',
    href: '/features#emotions',
  },
  {
    icon: BarChart3,
    title: 'Balance index & reports',
    body:
      'One number for whether effort is even. Trends over weeks show whether a bad patch is a blip or a pattern.',
    href: '/features#reports',
  },
  {
    icon: MessageCircle,
    title: 'Private couple messaging',
    body:
      'Encrypted-in-transit chat with photos, smileys and reactions — separate from the noise of every other app.',
    href: '/features#messaging',
  },
  {
    icon: Wallet,
    title: 'Fair money, not equal money',
    body:
      'Split by income or 50/50, settle up in one tap, and plan gifts without one-sided expectations.',
    href: '/features#money',
  },
  {
    icon: Plane,
    title: 'Trips, tickets and itineraries',
    body:
      'Generate a day-by-day plan, store flight and hotel confirmations in one vault, and pack from climate-specific checklists.',
    href: '/features#travel',
  },
];

const STEPS = [
  {
    name: 'Create your space',
    text: 'Sign up, pick your currency and invite your partner by email — even from another country.',
  },
  {
    name: 'Both of you answer separately',
    text: 'Each partner scores the same ten areas independently. Nobody fills it in for two.',
  },
  {
    name: 'Read one shared report',
    text: 'See the balance index, the biggest gaps and where your perceptions differ.',
  },
  {
    name: 'Fix one thing a week',
    text: 'Agree a single concrete action, then watch the trend line over the following weeks.',
  },
];

export default async function HomePage() {
  const supabase = createClient();
  const settings = await getPublicSettings();

  const [{ data: plans }, { data: destinations }, { data: testimonials }, { data: faqs }, { data: posts }] =
    await Promise.all([
      supabase
        .from('plans')
        .select('*, prices:plan_prices(*)')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('destinations')
        .select('name, slug, city, hero_image, summary, honeymoon_score, avg_daily_cost_usd, country_code')
        .eq('is_featured', true)
        .eq('is_active', true)
        .order('popularity', { ascending: false })
        .limit(6),
      supabase
        .from('testimonials')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .limit(6),
      supabase.from('faqs').select('question, answer').eq('is_active', true).eq('page_path', '/').order('sort_order').limit(8),
      supabase
        .from('blog_posts')
        .select('slug, title, excerpt, reading_minutes, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(3),
    ]);

  const paidPrices = (plans ?? [])
    .flatMap((p: any) => p.prices ?? [])
    .filter((price: any) => price.currency === 'USD' && price.interval === 'month' && price.amount_cents > 0)
    .map((price: any) => price.amount_cents / 100);

  return (
    <>
      <JsonLd
        data={[
          softwareApplicationSchema({
            settings,
            lowPrice: paidPrices.length ? Math.min(...paidPrices) : 9.99,
            highPrice: paidPrices.length ? Math.max(...paidPrices) : 19.99,
            currency: 'USD',
          }),
          howToSchema({
            name: 'How to measure fairness in a relationship',
            description:
              'A four-step method for measuring effort, respect and loyalty between two partners.',
            steps: STEPS,
          }),
          ...(faqs?.length ? [faqSchema(faqs as any)] : []),
        ]}
      />

      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-pattern absolute inset-0 opacity-[0.35]" aria-hidden />
        <div
          className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-br from-rose-400/25 via-pink-400/15 to-fuchsia-400/10 blur-3xl"
          aria-hidden
        />
        <div className="container relative py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="primary" className="mb-5 animate-fade-in">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Built on one idea: relationships fail on imbalance, not on love
            </Badge>

            <h1 className="animate-slide-up text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
              Is your relationship <span className="gradient-text">actually fair</span> — or does it
              only feel that way?
            </h1>

            <p className="mx-auto mt-6 max-w-2xl animate-slide-up text-lg text-muted-foreground">
              FairCouples measures effort, respect and loyalty from <strong>both</strong> sides. Each
              partner answers privately — even from another continent — and you both read the same
              report. Then plan the trips, budgets and gifts that follow.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/signup" size="lg" className="w-full sm:w-auto">
                Start free — no card needed
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/love-or-attraction" variant="outline" size="lg" className="w-full sm:w-auto">
                Take the Love vs Attraction test
              </ButtonLink>
            </div>

            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {[
                'One subscription covers both partners',
                'USD, GBP, EUR, CAD & AUD',
                'Private by default',
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <FairnessFormula />
        </div>
      </section>

      {/* ------------------------------------------------------ Features */}
      <section className="border-t border-border bg-secondary/20 py-20">
        <div className="container">
          <SectionHeading
            eyebrow="Everything in one place"
            title="Six systems that keep a relationship balanced"
            description="Measurement on one side, logistics on the other. Both partners see the same truth."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Link key={feature.title} href={feature.href} className="group">
                <Card className="h-full p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <feature.icon className="h-8 w-8 text-primary" aria-hidden />
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Learn more
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- How it works */}
      <section className="py-20">
        <div className="container">
          <SectionHeading
            eyebrow="How it works"
            title="Four steps, twenty minutes a week"
            description="The whole method fits in one Sunday evening conversation."
          />
          <ol className="mt-12 grid gap-6 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.name} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-base font-semibold">{step.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------ Destinations */}
      {destinations && destinations.length > 0 && (
        <section className="border-t border-border bg-secondary/20 py-20">
          <div className="container">
            <SectionHeading
              eyebrow="Travel together"
              title="Honeymoons and couples trips, planned properly"
              description="Real daily costs, best months and a day-by-day itinerary you can generate in one click."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {destinations.map((destination: any) => (
                <Link key={destination.slug} href={`/destinations/${destination.slug}`} className="group">
                  <Card className="h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      {destination.hero_image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${destination.hero_image}?auto=format&fit=crop&w=800&q=70`}
                          alt={destination.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                      {destination.honeymoon_score && (
                        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold">
                          💍 {destination.honeymoon_score}/100
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold">{destination.name}</h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                        {destination.summary}
                      </p>
                      {destination.avg_daily_cost_usd && (
                        <p className="mt-3 text-sm font-medium">
                          {formatMoney(destination.avg_daily_cost_usd * 100, 'USD', {
                            showDecimals: false,
                          })}
                          <span className="font-normal text-muted-foreground"> / day for two</span>
                        </p>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="mt-10 text-center">
              <ButtonLink href="/destinations" variant="outline">
                Browse all destinations
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------- Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <section className="py-20">
          <div className="container">
            <SectionHeading
              eyebrow="Real couples"
              title="What changes when both people can see the same numbers"
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t: any) => (
                <Card key={t.id} className="flex h-full flex-col p-6">
                  <div className="flex gap-0.5 text-amber-500" aria-label={`${t.rating} out of 5`}>
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <span key={i} aria-hidden>
                        ★
                      </span>
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-sm leading-relaxed">“{t.quote}”</blockquote>
                  <footer className="mt-5 text-sm">
                    <p className="font-semibold">{t.author_name}</p>
                    <p className="text-muted-foreground">
                      {[t.author_role, t.author_location].filter(Boolean).join(' · ')}
                    </p>
                  </footer>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Pricing */}
      <section className="border-t border-border bg-secondary/20 py-20" id="pricing">
        <div className="container">
          <SectionHeading
            eyebrow="Pricing"
            title="One subscription covers both partners"
            description="Choose your currency at signup — USD, GBP, EUR, CAD or AUD. Cancel any time."
          />
          <div className="mt-12">
            <PricingTable plans={(plans ?? []) as any} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Blog */}
      {posts && posts.length > 0 && (
        <section className="py-20">
          <div className="container">
            <SectionHeading eyebrow="From the blog" title="Read before your next conversation" />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {posts.map((post: any) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                  <Card className="h-full p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">
                      {post.reading_minutes} min read
                    </p>
                    <h3 className="mt-2 font-semibold group-hover:text-primary">{post.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- FAQ */}
      {faqs && faqs.length > 0 && (
        <section className="border-t border-border py-20">
          <div className="container max-w-3xl">
            <SectionHeading eyebrow="FAQ" title="Questions couples ask first" />
            <div className="mt-10 divide-y divide-border">
              {faqs.map((faq: any) => (
                <details key={faq.question} className="group py-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-left font-medium">
                    {faq.question}
                    <span className="text-xl text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-muted-foreground">
              More questions?{' '}
              <Link href="/faq" className="font-medium text-primary underline underline-offset-4">
                See the full FAQ
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- CTA */}
      <section className="py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 px-8 py-16 text-center text-white">
            <h2 className="text-3xl font-bold sm:text-4xl">Stop guessing who is giving more.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/90">
              Six weeks of entries from both of you turns an argument into a chart. Start free —
              upgrade only if it helps.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink
                href="/signup"
                size="lg"
                className="w-full bg-white text-rose-600 hover:bg-white/90 sm:w-auto"
              >
                Create your free account
              </ButtonLink>
              <ButtonLink
                href="/pricing"
                size="lg"
                variant="outline"
                className="w-full border-white/40 text-white hover:bg-white/10 sm:w-auto"
              >
                Compare plans
              </ButtonLink>
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/80">
              <Lock className="h-4 w-4" aria-hidden />
              Row-level data isolation. Private entries are never shown to your partner.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function FairnessFormula() {
  const rows = [
    { label: 'Effort', a: 68, b: 62, note: 'Within 6 points — balanced' },
    { label: 'Respect', a: 90, b: 88, note: 'Equal, both directions' },
    { label: 'Loyalty', a: 95, b: 72, note: 'Gap worth a conversation' },
  ];

  return (
    <div className="mx-auto mt-16 max-w-3xl">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">The fairness formula</p>
          <Badge tone="warning">Balance 84 / 100</Badge>
        </div>
        <div className="space-y-5 p-5">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="text-xs text-muted-foreground">{row.note}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-8 text-right text-xs text-muted-foreground">A</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${row.a}%` }} />
                </div>
                <span className="w-9 text-xs tabular-nums text-muted-foreground">{row.a}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="w-8 text-right text-xs text-muted-foreground">B</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${row.b}%` }} />
                </div>
                <span className="w-9 text-xs tabular-nums text-muted-foreground">{row.b}</span>
              </div>
            </div>
          ))}
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            A perfect 50/50 does not exist daily — some days one gives 70% and the other 30%. Over
            time it should average out. If one person is <em>always</em> giving more, that is what
            this chart catches.
          </p>
        </div>
      </Card>
    </div>
  );
}
