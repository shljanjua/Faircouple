import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getActivePlans, getFaqs } from '@/lib/queries';
import { getSessionUser, getEntitlements } from '@/lib/auth';
import { buildMetadata, breadcrumbSchema, faqSchema, productSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { PricingTable } from '@/components/marketing/pricing-table';
import { SectionHeading, Card, Badge } from '@/components/ui';
import { LIMIT_LABELS, formatLimit, mergeLimits } from '@/lib/plans';
import { currencyForCountry } from '@/lib/currency';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Pricing — plans in USD, GBP, EUR, CAD & AUD',
    description:
      'FairCouples pricing. One subscription covers both partners. Free forever plan, 14-day trial on paid plans, cancel any time. Pay in your own currency.',
    path: '/pricing',
    keywords: ['couples app pricing', 'relationship app subscription', 'faircouples pricing'],
  });
}

export default async function PricingPage() {
  const [user, entitlements] = await Promise.all([getSessionUser(), getEntitlements()]);

  const headerList = headers();
  const detectedCountry =
    headerList.get('x-vercel-ip-country') ??
    headerList.get('cf-ipcountry') ??
    headerList.get('x-country-code') ??
    null;

  const currency = user?.profile.currency ?? currencyForCountry(detectedCountry);

  const [allPlans, faqs] = await Promise.all([
    getActivePlans(),
    getFaqs({ category: 'billing' }),
  ]);
  const comparisonKeys = Object.keys(LIMIT_LABELS) as (keyof typeof LIMIT_LABELS)[];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Pricing', path: '/pricing' },
          ]),
          ...allPlans
            .filter((plan) => !plan.is_free)
            .map((plan) => {
              const price = plan.prices?.find(
                (p: any) => p.currency === currency && p.interval !== 'lifetime'
              );
              return productSchema({
                name: plan.name,
                description: plan.description ?? plan.tagline ?? '',
                price: (price?.amount_cents ?? 0) / 100,
                currency,
                slug: plan.slug,
              });
            }),
          ...(faqs.length ? [faqSchema(faqs as any)] : []),
        ]}
      />

      <section className="border-b border-border bg-secondary/20 py-16">
        <div className="container">
          <SectionHeading
            eyebrow="Pricing"
            title="One subscription. Both partners."
            description="Nobody pays twice. Choose your currency, switch it any time before you subscribe, and cancel from Settings whenever you want."
          />
        </div>
      </section>

      <section className="py-14">
        <div className="container">
          <PricingTable
            plans={allPlans}
            defaultCurrency={currency}
            currentPlanSlug={entitlements.planSlug}
            signedIn={Boolean(user)}
          />
        </div>
      </section>

      <section className="border-t border-border bg-secondary/20 py-16">
        <div className="container">
          <SectionHeading
            eyebrow="Compare"
            title="Every limit, side by side"
            description="“Unlimited” means exactly that — no soft caps or throttling."
          />
          <div className="mt-10 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className="bg-secondary/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Feature
                  </th>
                  {allPlans.map((plan) => (
                    <th
                      key={plan.id}
                      className="bg-secondary/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <span className="flex items-center gap-2">
                        {plan.name}
                        {plan.is_featured && <Badge tone="primary">Popular</Badge>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonKeys.map((key) => (
                  <tr key={key}>
                    <td className="border-t border-border px-4 py-3 font-medium">
                      {LIMIT_LABELS[key]}
                    </td>
                    {allPlans.map((plan) => {
                      const limits = mergeLimits(plan.limits);
                      return (
                        <td key={plan.id} className="border-t border-border px-4 py-3 text-muted-foreground">
                          {formatLimit(limits[key])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="py-16">
          <div className="container max-w-3xl">
            <SectionHeading eyebrow="Billing FAQ" title="Before you subscribe" />
            <div className="mt-10 space-y-3">
              {faqs.map((faq: any) => (
                <Card key={faq.question} className="p-5">
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
