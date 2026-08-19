import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCountryBySlug, getDestinations } from '@/lib/queries';
import { query } from '@/lib/db';
import { buildMetadata, breadcrumbSchema, faqSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { Badge, Card, Stat } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { formatMoney } from '@/lib/currency';

export const revalidate = 3600;

const getCountry = getCountryBySlug;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const country = await getCountry(params.slug);
  if (!country) return buildMetadata({ title: 'Country not found', noIndex: true });

  return buildMetadata({
    title: country.meta_title ?? `${country.name} travel guide for couples`,
    description:
      country.meta_description ??
      `${country.summary} Costs, best months and romantic destinations across ${country.name}.`,
    path: `/countries/${country.slug}`,
    image: country.hero_image ?? undefined,
    keywords: [
      `${country.name} honeymoon`,
      `${country.name} couples travel`,
      `${country.name} travel cost`,
      `romantic places in ${country.name}`,
    ],
  });
}

export default async function CountryPage({ params }: { params: { slug: string } }) {
  const country = await getCountry(params.slug);
  if (!country) notFound();

  const [list, neighbours] = await Promise.all([
    getDestinations({ countryCode: country.code, limit: 60 }),
    query<any>(
      `SELECT name, slug, flag_emoji, avg_daily_cost_usd FROM countries
        WHERE region = ? AND code <> ? AND is_active = 1 LIMIT 6`,
      [country.region, country.code]
    ),
  ]);

  const faqs = [
    {
      question: `How expensive is ${country.name} for a couple?`,
      answer: country.avg_daily_cost_usd
        ? `Budget around $${country.avg_daily_cost_usd} a day for two, covering accommodation, food and local transport.`
        : `Costs vary widely by region and season — track the real number in your FairCouples trip budget.`,
    },
    {
      question: `When is the best time to visit ${country.name}?`,
      answer: country.best_season
        ? `${country.best_season} generally gives the best mix of weather, prices and availability.`
        : 'Shoulder season usually gives the best balance of weather and price.',
    },
    {
      question: `Do we need a visa for ${country.name}?`,
      answer:
        country.visa_note ??
        `Check the entry requirements for your nationality before booking. ${
          country.is_schengen ? `${country.name} is part of the Schengen Area.` : ''
        }`,
    },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Destinations', path: '/destinations' },
            { name: country.name, path: `/countries/${country.slug}` },
          ]),
          faqSchema(faqs),
        ]}
      />

      <section className="border-b border-border bg-secondary/20 py-14">
        <div className="container">
          <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
            <Link href="/destinations" className="hover:text-primary">
              Destinations
            </Link>
            <span className="mx-2">/</span>
            <span>{country.name}</span>
          </nav>
          <h1 className="font-display text-4xl font-bold">
            {country.flag_emoji} {country.name} for couples
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{country.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {country.is_schengen && <Badge tone="info">Schengen Area</Badge>}
            {country.is_tier1 && <Badge tone="outline">Tier-1 destination</Badge>}
            <Badge tone="outline">{country.region}</Badge>
            <Badge tone="outline">{country.currency_code}</Badge>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Daily cost for two"
              value={
                country.avg_daily_cost_usd
                  ? formatMoney(country.avg_daily_cost_usd * 100, 'USD', { showDecimals: false })
                  : '—'
              }
            />
            <Stat label="Best season" value={country.best_season ?? '—'} />
            <Stat label="Capital" value={country.capital ?? '—'} />
            <Stat label="Destinations covered" value={list.length} />
          </div>

          <h2 className="mt-12 text-2xl font-bold">Where to go in {country.name}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((destination) => (
              <Link key={destination.id} href={`/destinations/${destination.slug}`} className="group">
                <Card className="h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    {destination.hero_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${destination.hero_image}?auto=format&fit=crop&w=700&q=70`}
                        alt={destination.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold group-hover:text-primary">{destination.name}</h3>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {destination.summary}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {list.length === 0 && (
            <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
              Destination guides for {country.name} are coming soon.
            </Card>
          )}

          <div className="mt-12 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <div className="prose-cms">
              <h2>Travelling {country.name} as a couple</h2>
              <p>
                {country.description ??
                  `${country.summary} Plan the route together, agree the budget before you book, and keep every confirmation in one place.`}
              </p>
              <h3>What it costs</h3>
              <p>
                A realistic daily figure for two is{' '}
                {country.avg_daily_cost_usd
                  ? formatMoney(country.avg_daily_cost_usd * 100, 'USD', { showDecimals: false })
                  : 'season-dependent'}
                , excluding flights. Log costs as you book them and split them fairly — equally, or
                proportionally to income.
              </p>
              <h3>Frequently asked</h3>
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <h4>{faq.question}</h4>
                  <p>{faq.answer}</p>
                </div>
              ))}
            </div>

            <aside className="space-y-5">
              <Card className="bg-gradient-to-br from-rose-500/10 to-fuchsia-500/10 p-6">
                <h2 className="font-semibold">Plan a {country.name} trip</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generate a day-by-day itinerary, store the tickets and split the cost fairly.
                </p>
                <ButtonLink href="/signup" className="mt-4 w-full">
                  Start free
                </ButtonLink>
              </Card>

              {neighbours && neighbours.length > 0 && (
                <Card className="p-5">
                  <h2 className="font-semibold">Nearby in {country.region}</h2>
                  <ul className="mt-3 space-y-2">
                    {neighbours.map((neighbour) => (
                      <li key={neighbour.slug}>
                        <Link
                          href={`/countries/${neighbour.slug}`}
                          className="flex items-center justify-between text-sm hover:text-primary"
                        >
                          <span>
                            {neighbour.flag_emoji} {neighbour.name}
                          </span>
                          {neighbour.avg_daily_cost_usd && (
                            <span className="text-xs text-muted-foreground">
                              ${neighbour.avg_daily_cost_usd}/day
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
