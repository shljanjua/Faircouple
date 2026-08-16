import type { Metadata } from 'next';
import Link from 'next/link';
import { getFaqs } from '@/lib/queries';
import { buildMetadata, breadcrumbSchema, faqSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { Card, SectionHeading } from '@/components/ui';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'FAQ — how FairCouples works',
    description:
      'Answers about how FairCouples measures fairness, what your partner can and cannot see, billing in five currencies, privacy and data deletion.',
    path: '/faq',
    keywords: ['faircouples faq', 'couples app questions', 'relationship app privacy'],
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  product: 'How it works',
  billing: 'Billing & plans',
  privacy: 'Privacy & data',
  travel: 'Travel planning',
};

export default async function FaqPage() {
  const list = await getFaqs();
  const grouped = new Map<string, any[]>();
  for (const faq of list) {
    const key = faq.category ?? 'general';
    grouped.set(key, [...(grouped.get(key) ?? []), faq]);
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'FAQ', path: '/faq' },
          ]),
          faqSchema(list.map((faq) => ({ question: faq.question, answer: faq.answer }))),
        ]}
      />

      <section className="border-b border-border bg-secondary/20 py-14">
        <div className="container">
          <SectionHeading
            eyebrow="FAQ"
            title="Everything couples ask before signing up"
            description="Still unsure? Email support@faircouples.com and a human replies within one business day."
          />
        </div>
      </section>

      <section className="py-12">
        <div className="container max-w-3xl space-y-10">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xl font-bold">{CATEGORY_LABELS[category] ?? category}</h2>
              <div className="mt-4 divide-y divide-border">
                {items.map((faq) => (
                  <details key={faq.id} className="group py-4">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                      {faq.question}
                      <span
                        className="text-xl text-muted-foreground transition-transform group-open:rotate-45"
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          ))}

          {list.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">
              No FAQ entries have been published yet.
            </Card>
          )}

          <Card className="p-6 text-center">
            <h2 className="font-semibold">Still have a question?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <Link href="/contact" className="font-medium text-primary underline">
                Contact us
              </Link>{' '}
              — we reply within one business day.
            </p>
          </Card>
        </div>
      </section>
    </>
  );
}
