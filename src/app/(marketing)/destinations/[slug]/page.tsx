import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Clock, MapPin, Star, Wallet } from 'lucide-react';
import { getDestinationBySlug, getDestinations } from '@/lib/queries';
import {
  buildMetadata,
  breadcrumbSchema,
  touristDestinationSchema,
  faqSchema,
} from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { Badge, Card, Stat } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { formatMoney } from '@/lib/currency';

export const revalidate = 3600;

const getDestination = getDestinationBySlug;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const destination = await getDestination(params.slug);
  if (!destination) return buildMetadata({ title: 'Destination not found', noIndex: true });

  return buildMetadata({
    title: destination.meta_title ?? `${destination.name} honeymoon guide`,
    description:
      destination.meta_description ??
      `${destination.summary} Plan it with FairCouples: day-by-day itinerary, shared budget and packing checklist.`,
    path: `/destinations/${destination.slug}`,
    image: destination.hero_image ?? undefined,
    keywords: destination.keywords ?? [
      `${destination.name} honeymoon`,
      `${destination.name} itinerary`,
      `${destination.name} for couples`,
    ],
  });
}

export default async function DestinationPage({ params }: { params: { slug: string } }) {
  const destination = await getDestination(params.slug);
  if (!destination) notFound();

  const related = (await getDestinations({ countryCode: destination.country_code, limit: 4 }))
    .filter((item) => item.id !== destination.id)
    .slice(0, 3);

  const attractions = destination.attractions ?? [];

  const faqs = [
    {
      question: `How much does a trip to ${destination.name} cost for two?`,
      answer: destination.avg_daily_cost_usd
        ? `Around $${destination.avg_daily_cost_usd} a day for two people including accommodation, food and local transport — so roughly $${
            destination.avg_daily_cost_usd * (destination.ideal_days ?? 5)
          } for a ${destination.ideal_days ?? 5}-day trip, before flights.`
        : `Costs vary by season. Use the FairCouples trip budget to track the real number as you book.`,
    },
    {
      question: `When is the best time to visit ${destination.name}?`,
      answer: destination.best_months?.length
        ? `${destination.best_months.join(', ')} — the shoulder months usually give the best balance of weather, prices and crowds.`
        : 'Shoulder season usually gives the best balance of weather, prices and crowds.',
    },
    {
      question: `How many days do you need in ${destination.name}?`,
      answer: `${destination.ideal_days ?? 5} days is the sweet spot for a couple. The itinerary generator will lay those days out around your pace.`,
    },
    {
      question: `Is ${destination.name} good for a honeymoon?`,
      answer: destination.is_honeymoon
        ? `Yes — it scores ${destination.honeymoon_score}/100 on our honeymoon index, which weights romance, privacy, scenery and ease of travel.`
        : `It is a strong couples destination, though not primarily a honeymoon spot. Filter for honeymoon destinations if that is what you are planning.`,
    },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Destinations', path: '/destinations' },
            { name: destination.name, path: `/destinations/${destination.slug}` },
          ]),
          touristDestinationSchema({
            name: destination.name,
            slug: destination.slug,
            description: destination.summary ?? '',
            image: destination.hero_image,
            latitude: destination.latitude,
            longitude: destination.longitude,
            country: destination.country_code,
            rating: destination.rating,
            highlights: destination.highlights,
          }),
          faqSchema(faqs),
        ]}
      />

      <article>
        <header className="relative">
          {destination.hero_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${destination.hero_image}?auto=format&fit=crop&w=1800&q=75`}
              alt={`${destination.name}, ${destination.country?.name}`}
              className="h-[320px] w-full object-cover sm:h-[420px]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <div className="container absolute inset-x-0 bottom-0 pb-8">
            <nav aria-label="Breadcrumb" className="mb-3 text-sm text-white/80">
              <Link href="/destinations" className="hover:underline">
                Destinations
              </Link>
              <span className="mx-2">/</span>
              <Link href={`/countries/${destination.country?.slug}`} className="hover:underline">
                {destination.country?.name}
              </Link>
            </nav>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              {destination.name}
            </h1>
            <p className="mt-2 max-w-2xl text-white/90">{destination.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {destination.is_honeymoon && (
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  💍 Honeymoon score {destination.honeymoon_score}/100
                </span>
              )}
              {(destination.tags ?? []).slice(0, 4).map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="container py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Daily cost for two"
              value={
                destination.avg_daily_cost_usd
                  ? formatMoney(destination.avg_daily_cost_usd * 100, 'USD', { showDecimals: false })
                  : '—'
              }
              hint="Accommodation, food, local transport"
              icon={<Wallet className="h-5 w-5" aria-hidden />}
            />
            <Stat
              label="Ideal length"
              value={`${destination.ideal_days ?? 5} days`}
              icon={<Clock className="h-5 w-5" aria-hidden />}
            />
            <Stat
              label="Best months"
              value={(destination.best_months ?? []).slice(0, 3).join(', ') || '—'}
              icon={<Calendar className="h-5 w-5" aria-hidden />}
            />
            <Stat
              label="Rating"
              value={`${destination.rating ?? 4.5} / 5`}
              hint={destination.budget_level ? `${destination.budget_level} budget` : undefined}
              icon={<Star className="h-5 w-5" aria-hidden />}
            />
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-10">
              {destination.highlights?.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold">What you should not miss</h2>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {destination.highlights.map((highlight: string) => (
                      <li key={highlight} className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span className="text-sm">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {attractions.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold">Attractions worth booking</h2>
                  <div className="mt-5 space-y-3">
                    {attractions.map((attraction: any) => (
                      <Card key={attraction.id} className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                              {attraction.name}
                              {attraction.is_must_see && <Badge tone="primary">Must see</Badge>}
                              {attraction.is_romantic && <Badge tone="danger">Romantic</Badge>}
                            </h3>
                            {attraction.description && (
                              <p className="mt-1.5 text-sm text-muted-foreground">
                                {attraction.description}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right text-sm">
                            <p className="font-medium">
                              {attraction.ticket_price_usd
                                ? formatMoney(Number(attraction.ticket_price_usd) * 100, 'USD')
                                : 'Free'}
                            </p>
                            {attraction.duration_minutes && (
                              <p className="text-xs text-muted-foreground">
                                ~{Math.round(attraction.duration_minutes / 60)}h
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-2xl font-bold">Planning a trip to {destination.name}</h2>
                <div className="prose-cms mt-4">
                  <p>
                    {destination.description ??
                      `${destination.summary} A ${destination.ideal_days ?? 5}-day trip is enough to see the highlights without spending the whole time in transit.`}
                  </p>
                  <h3>Budget honestly, and split it fairly</h3>
                  <p>
                    Expect around{' '}
                    {destination.avg_daily_cost_usd
                      ? formatMoney(destination.avg_daily_cost_usd * 100, 'USD', { showDecimals: false })
                      : 'a moderate amount'}{' '}
                    a day for two, before flights. In FairCouples you can log each cost as you book,
                    split it 50/50 or proportionally to income, and see who is owed what without
                    anybody keeping a mental tally.
                  </p>
                  <h3>Keep every booking in one place</h3>
                  <p>
                    Upload flight tickets, hotel confirmations, transfer vouchers and attraction
                    passes to the ticket vault. Both partners can open them, including on a phone at
                    the airport.
                  </p>
                  <h3>Pack from a checklist, not from memory</h3>
                  <p>
                    Use a climate-specific packing template and assign items to each partner — the
                    person who packs the chargers is not automatically the person who packs the
                    passports.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold">Frequently asked</h2>
                <div className="mt-5 divide-y divide-border">
                  {faqs.map((faq) => (
                    <details key={faq.question} className="group py-4">
                      <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                        {faq.question}
                        <span
                          className="text-xl text-muted-foreground transition-transform group-open:rotate-45"
                          aria-hidden
                        >
                          +
                        </span>
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <Card className="bg-gradient-to-br from-rose-500/10 to-fuchsia-500/10 p-6">
                <h2 className="font-semibold">Plan this trip together</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generate a {destination.ideal_days ?? 5}-day itinerary built from the attractions
                  above, split the costs fairly and store every booking in one vault.
                </p>
                <ButtonLink href="/signup" className="mt-4 w-full">
                  Start planning free
                </ButtonLink>
              </Card>

              <Card className="p-5">
                <h2 className="font-semibold">Country facts</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Country</dt>
                    <dd className="text-right font-medium">
                      {destination.country?.flag_emoji} {destination.country?.name}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Currency</dt>
                    <dd className="text-right font-medium">{destination.country?.currency_code}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Region</dt>
                    <dd className="text-right font-medium">{destination.country?.region}</dd>
                  </div>
                  {destination.country?.best_season && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Best season</dt>
                      <dd className="text-right font-medium">{destination.country.best_season}</dd>
                    </div>
                  )}
                  {destination.country?.is_schengen && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Schengen</dt>
                      <dd className="text-right font-medium">Yes</dd>
                    </div>
                  )}
                </dl>
                <Link
                  href={`/countries/${destination.country?.slug}`}
                  className="mt-4 block text-sm font-medium text-primary underline"
                >
                  Full {destination.country?.name} guide
                </Link>
              </Card>

              {related && related.length > 0 && (
                <Card className="p-5">
                  <h2 className="font-semibold">Also in {destination.country?.name}</h2>
                  <ul className="mt-3 space-y-3">
                    {related.map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={`/destinations/${item.slug}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {item.name}
                        </Link>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </aside>
          </div>
        </div>
      </article>
    </>
  );
}
