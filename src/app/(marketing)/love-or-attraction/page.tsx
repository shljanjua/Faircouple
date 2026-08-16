import type { Metadata } from 'next';
import { buildMetadata, breadcrumbSchema, faqSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { LoveAttractionQuiz } from '@/components/marketing/love-attraction-quiz';
import { SectionHeading } from '@/components/ui';
import { getSessionUser } from '@/lib/auth';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Love or Attraction Test — free assessment for couples',
    description:
      'Take the free Love vs Attraction test. Twenty questions separating consistency from intensity — answer independently from your partner and compare the two results.',
    path: '/love-or-attraction',
    keywords: [
      'love vs attraction test',
      'is it love or attraction',
      'love or infatuation quiz',
      'relationship test free',
      'signs of real love',
    ],
  });
}

const FAQS = [
  {
    question: 'What is the difference between love and attraction?',
    answer:
      'Attraction is measured in peaks — intensity, novelty and chemistry. Love is measured in averages — consistency, mutual effort, repair after conflict and concrete plans. Both can be present; the problem is when only attraction is.',
  },
  {
    question: 'How accurate is this test?',
    answer:
      'It measures what you report, honestly answered. It is not a diagnosis. Its real value comes from taking it independently from your partner and comparing the two results — the gap is more informative than either score.',
  },
  {
    question: 'Should my partner take it too?',
    answer:
      'Yes, separately and without seeing your answers. Two people describing the same relationship very differently is the single most useful signal the test produces.',
  },
  {
    question: 'Is the test free?',
    answer:
      'Completely. You can take it without an account. Creating a free account saves your result so you can retake it in eight weeks and compare.',
  },
];

export default async function LoveOrAttractionPage() {
  const user = await getSessionUser();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Love or attraction', path: '/love-or-attraction' },
          ]),
          faqSchema(FAQS),
        ]}
      />

      <section className="border-b border-border bg-secondary/20 py-14">
        <div className="container">
          <SectionHeading
            eyebrow="Free assessment"
            title="Is it love, or is it attraction?"
            description="Attraction arrives instantly and asks nothing of you. Love arrives slowly and asks for everything. Twenty questions, two minutes, no account needed."
          />
        </div>
      </section>

      <section className="py-14">
        <div className="container max-w-3xl">
          <LoveAttractionQuiz signedIn={Boolean(user)} />
        </div>
      </section>

      <section className="border-t border-border bg-secondary/20 py-14">
        <div className="container max-w-3xl">
          <h2 className="text-2xl font-bold">Questions about the test</h2>
          <div className="mt-6 divide-y divide-border">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                  {faq.question}
                  <span className="text-xl text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
