import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  Check,
  Gift,
  Heart,
  Images,
  ListChecks,
  Lock,
  MessageCircle,
  Plane,
  Scale,
  Ticket,
  Wallet,
} from 'lucide-react';
import { buildMetadata, breadcrumbSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { ButtonLink } from '@/components/ui/button';
import { Card, SectionHeading } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Features — fairness scoring, emotions, budgets and travel',
    description:
      'Every FairCouples feature: the 10-area fairness framework, emotion tracking for both partners, private messaging, fair expense splitting, gift planner, ticket vault and the itinerary generator.',
    path: '/features',
    keywords: [
      'couples app features',
      'relationship tracker',
      'fair expense split',
      'couples itinerary generator',
      'couples ticket vault',
    ],
  });
}

const SECTIONS = [
  {
    id: 'fairness',
    icon: Scale,
    eyebrow: 'Measurement',
    title: 'The 10-area fairness framework',
    body: 'Emotional connection, communication, respect and boundaries, trust and loyalty, financial fairness, time and attention, conflict management, affection and care, growth and future alignment, and deal breakers. Each area carries a fair rule that stops it becoming a scorecard for one person.',
    points: [
      'You rate yourself and your partner — separately, in your own account',
      'Thirty specific behaviours, not vague feelings',
      'A balance index from 0–100 for whether effort is even',
      'Weighted scoring: deal breakers count more than affection',
      'Private entries stay hidden from your partner but count in your own trends',
    ],
  },
  {
    id: 'emotions',
    icon: Heart,
    eyebrow: 'Emotions',
    title: 'Both partners log their own feelings',
    body: 'Thirty emotions across positive, neutral and difficult, each with an intensity from 1 to 10. Log how you feel about yourself, about your partner, or about the relationship — and say what you need instead of hoping it is guessed.',
    points: [
      'Emotions about your partner, not just about yourself',
      'Trigger and need fields so a feeling turns into an action',
      'Acknowledgement: your partner marks that they have read it',
      'A 30-day mood chart comparing both of you side by side',
      'Works across time zones — nobody has to be online at once',
    ],
  },
  {
    id: 'reports',
    icon: BarChart3,
    eyebrow: 'Reports',
    title: 'One report, two viewpoints',
    body: 'The report compares what you said about yourself against what your partner said about you. The gap between those two numbers is usually the real argument.',
    points: [
      'Balance index and weighted overall fairness score',
      'Per-area breakdown showing exactly where effort tilts',
      'Perception gaps flagged automatically',
      '12-week trend line — a bad week is normal, a bad quarter is not',
      'Risk levels: healthy, watch, strained, critical',
      'Weekly report emailed to both partners',
    ],
  },
  {
    id: 'messaging',
    icon: MessageCircle,
    eyebrow: 'Together',
    title: 'Private messaging, photos and reactions',
    body: 'A chat that belongs only to the two of you, with real-time delivery, image sharing, forty smileys and six reactions.',
    points: [
      'Real-time delivery with read receipts',
      'Photo sharing straight into your shared gallery',
      'Emoji picker and message reactions',
      'Every file stored privately and served through signed links',
    ],
  },
  {
    id: 'money',
    icon: Wallet,
    eyebrow: 'Money',
    title: 'Fair money — not identical money',
    body: 'Two people earning different amounts splitting 50/50 are splitting identically, which is a different thing. Set incomes once and every shared cost splits proportionally.',
    points: [
      'Equal, proportional or custom splits per expense',
      'Automatic “who owes whom” and one-tap settle up',
      'Budgets for the household, each trip and gifts',
      'Category breakdown chart for every month',
      'Multi-currency: log an expense in any of five currencies',
    ],
  },
  {
    id: 'gifts',
    icon: Gift,
    eyebrow: 'Gifts',
    title: 'Gift planner with surprise mode',
    body: 'Track ideas, budgets and occasions — and keep surprises genuinely hidden from your partner until you mark them given.',
    points: [
      'Surprise gifts are invisible to the recipient in their own account',
      'Wishlists both partners can see',
      'A gift balance counter, because gifts should be mutual',
      'Occasion reminders for birthdays and anniversaries',
    ],
  },
  {
    id: 'travel',
    icon: Plane,
    eyebrow: 'Travel',
    title: 'Trips, itineraries and the ticket vault',
    body: 'Pick a destination from the guides, set your pace, and generate a day-by-day plan. Every booking lives in one vault both of you can reach.',
    points: [
      'Itinerary generator: relaxed, balanced or packed pacing',
      'Interests-aware — romance, food, culture, nature, adventure',
      'Real costs and best months for every destination',
      'Upload flight, hotel, train, attraction, insurance and visa documents',
      'Climate-specific packing checklists with items assigned to each partner',
      'Trip budget tracking against actual spend',
    ],
  },
  {
    id: 'checklists',
    icon: ListChecks,
    eyebrow: 'Rituals',
    title: 'Checklists that split the mental load',
    body: 'Fifteen ready templates: the weekly fairness ritual, conflict repair, monthly money talk, date-night rotation, and packing lists for every climate.',
    points: [
      'Assign items to a specific partner',
      'Essential items flagged so nothing critical is missed',
      'Progress bars per list',
      'Build your own from scratch',
    ],
  },
];

export default async function FeaturesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
        ])}
      />

      <section className="border-b border-border bg-secondary/20 py-16">
        <div className="container">
          <SectionHeading
            eyebrow="Features"
            title="Everything a couple actually needs, in one place"
            description="Measurement on one side, logistics on the other. Both partners see the same truth."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:bg-secondary"
              >
                {section.title.split(' ').slice(0, 3).join(' ')}
              </a>
            ))}
          </div>
        </div>
      </section>

      {SECTIONS.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          className={index % 2 === 1 ? 'border-y border-border bg-secondary/20 py-16' : 'py-16'}
        >
          <div className="container">
            <div
              className={`grid items-center gap-10 lg:grid-cols-2 ${
                index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
              }`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {section.eyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-bold">{section.title}</h2>
                <p className="mt-4 text-muted-foreground">{section.body}</p>
                <ul className="mt-6 space-y-3">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                      <span className="text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Card className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-rose-500/10 to-fuchsia-500/10 p-10">
                <section.icon className="h-24 w-24 text-primary/50" aria-hidden />
              </Card>
            </div>
          </div>
        </section>
      ))}

      <section className="border-t border-border py-16">
        <div className="container">
          <SectionHeading
            eyebrow="Privacy"
            title="Private by design, not by promise"
            description="Every couple's data is isolated at the database level with row-level security."
          />
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-3">
            {[
              {
                icon: Lock,
                title: 'Private entries',
                body: 'Anything you mark private is never shown to your partner — but still counts in your own trends.',
              },
              {
                icon: Images,
                title: 'Signed media links',
                body: 'Photos and documents are stored privately and served through short-lived signed URLs.',
              },
              {
                icon: Ticket,
                title: 'Full data export',
                body: 'Download everything you have entered at any time, or delete your account permanently.',
              },
            ].map((item) => (
              <Card key={item.title} className="p-6">
                <item.icon className="h-7 w-7 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/20 py-16">
        <div className="container text-center">
          <h2 className="text-3xl font-bold">Start free. Upgrade only if it helps.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            One subscription covers both partners. Pay in USD, GBP, EUR, CAD or AUD.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/signup" size="lg">
              Create a free account
            </ButtonLink>
            <ButtonLink href="/pricing" variant="outline" size="lg">
              Compare plans
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Not sure yet?{' '}
            <Link href="/love-or-attraction" className="font-medium text-primary underline">
              Take the free Love vs Attraction test
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
