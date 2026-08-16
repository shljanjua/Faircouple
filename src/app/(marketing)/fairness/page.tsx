import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildMetadata, breadcrumbSchema, howToSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { ButtonLink } from '@/components/ui/button';
import { Alert, Badge, Card, SectionHeading } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'The Fairness Framework — 10 areas every relationship is measured on',
    description:
      'The complete fairness framework used by FairCouples: ten areas, thirty behaviours and the fair rule that keeps each one honest. Free to read, free to use.',
    path: '/fairness',
    keywords: [
      'relationship fairness',
      'fair relationship checklist',
      'equal relationship rules',
      'relationship balance test',
      'healthy relationship framework',
    ],
  });
}

const CYCLE = [
  { emoji: '✨', name: 'Attraction', body: 'Chemistry, curiosity and interest.' },
  { emoji: '💬', name: 'Communication', body: 'Learning how to talk, listen and be understood.' },
  { emoji: '🔐', name: 'Trust building', body: 'Consistency over time turns interest into safety.' },
  { emoji: '⚡', name: 'Conflict testing', body: 'The first real disagreements reveal how you repair.' },
  { emoji: '💞', name: 'Deeper bonding', body: 'Shared history, shared plans, genuine intimacy.' },
  { emoji: '🏡', name: 'Long-term stability', body: 'Sustained fairness, effort and direction.' },
];

export default async function FairnessPage() {
  const supabase = createClient();
  const { data: categories } = await supabase
    .from('fairness_categories')
    .select('*, criteria:fairness_criteria(*)')
    .eq('is_active', true)
    .order('sort_order');

  const list = ((categories ?? []) as any[]).map((category) => ({
    ...category,
    criteria: (category.criteria ?? []).sort(
      (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    ),
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Fairness framework', path: '/fairness' },
          ]),
          howToSchema({
            name: 'How to check whether a relationship is fair',
            description:
              'Score ten areas independently, compare both sides, and act on the biggest gap.',
            steps: [
              { name: 'Score yourself', text: 'Rate how well you upheld each of the ten areas this week.' },
              { name: 'Score your partner', text: 'Rate how well they upheld the same ten areas.' },
              {
                name: 'Have them do the same, separately',
                text: 'Independent answers are what make the comparison meaningful.',
              },
              {
                name: 'Compare the two',
                text: 'Look at the balance index and the biggest perception gap.',
              },
              {
                name: 'Agree one action each',
                text: 'One concrete change per person, reviewed the following week.',
              },
            ],
          }),
        ]}
      />

      <section className="border-b border-border bg-secondary/20 py-16">
        <div className="container">
          <SectionHeading
            eyebrow="The framework"
            title="A healthy relationship is structure + effort + respect + consistency"
            description="Not just love. Not just attraction. Here is the structure, in ten areas — the same framework the app scores you both against."
          />
        </div>
      </section>

      <section className="py-16">
        <div className="container max-w-4xl">
          <Card className="border-primary/30 bg-primary/5 p-6">
            <h2 className="font-display text-xl font-bold">The fairness formula</h2>
            <div className="mt-4 space-y-1.5 font-mono text-sm">
              <p>Effort (Partner A) ≈ Effort (Partner B)</p>
              <p>Respect (A) = Respect (B)</p>
              <p>Loyalty (A) = Loyalty (B)</p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              If this balance breaks, problems start. A perfect 50/50 does not exist daily — some
              days one gives 70% and the other 30%. Over time it should average out.{' '}
              <strong className="text-foreground">
                If one person is always giving more, it becomes toxic.
              </strong>
            </p>
          </Card>

          <div className="mt-12 space-y-6">
            {list.map((category, index) => (
              <Card key={category.id} id={category.slug} className="p-6">
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden>
                    {category.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
                      {index + 1}. {category.name}
                      {category.is_dealbreaker && <Badge tone="danger">Non-negotiable</Badge>}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>

                    <ul className="mt-4 space-y-2">
                      {category.criteria.map((criterion: any) => (
                        <li key={criterion.id} className="flex gap-2.5">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                          <span className="text-sm">
                            {criterion.text}
                            {criterion.help_text && (
                              <span className="block text-xs text-muted-foreground">
                                {criterion.help_text}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-4 rounded-lg border-l-4 border-primary bg-primary/5 p-3 text-sm">
                      <strong>Fair rule: </strong>
                      {category.fair_rule}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/20 py-16">
        <div className="container max-w-4xl">
          <SectionHeading
            eyebrow="The cycle"
            title="The healthy relationship cycle"
            description="If one stage is weak, the relationship becomes unstable."
          />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CYCLE.map((stage, index) => (
              <li key={stage.name}>
                <Card className="h-full p-5">
                  <span className="text-2xl" aria-hidden>
                    {stage.emoji}
                  </span>
                  <h3 className="mt-2 font-semibold">
                    {index + 1}. {stage.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{stage.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16">
        <div className="container max-w-3xl">
          <SectionHeading eyebrow="Reality check" title="What fair actually looks like day to day" />
          <div className="mt-8 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/60">
                  <th className="px-4 py-3 text-left font-semibold">Situation</th>
                  <th className="px-4 py-3 text-left font-semibold">Fair behaviour</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['One is busy', 'The other understands'],
                  ['One is upset', 'The other supports'],
                  ['One spends', 'The other contributes later'],
                  ['One makes a mistake', 'The other forgives, but sets a boundary'],
                  ['One raises a concern', 'The other takes it seriously, immediately'],
                ].map(([situation, behaviour]) => (
                  <tr key={situation} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{situation}</td>
                    <td className="px-4 py-3 text-muted-foreground">{behaviour}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Alert tone="warning" className="mt-8">
            If abuse, manipulation or repeated dishonesty is involved, no score matters. Contact your
            local emergency service or a domestic abuse helpline.
          </Alert>

          <div className="mt-10 text-center">
            <h2 className="text-2xl font-bold">Score it instead of arguing about it</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Both of you answer these ten areas independently. The app compares the two sides and
              shows exactly where effort is drifting apart.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/signup" size="lg">
                Start free
              </ButtonLink>
              <ButtonLink href="/love-or-attraction" variant="outline" size="lg">
                Is it love or attraction?
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Prefer to read first?{' '}
              <Link href="/blog/fair-relationship-checklist" className="text-primary underline">
                The full checklist article
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
