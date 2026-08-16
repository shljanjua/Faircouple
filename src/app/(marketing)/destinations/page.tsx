import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildMetadata, breadcrumbSchema, absoluteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { Badge, Card, SectionHeading } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { formatMoney } from '@/lib/currency';
import { cn } from '@/lib/utils';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { type?: string; region?: string; budget?: string };
}): Promise<Metadata> {
  const filters = [searchParams.type, searchParams.region, searchParams.budget].filter(Boolean);
  const suffix = filters.length ? ` — ${filters.join(', ')}` : '';

  return buildMetadata({
    title: `Honeymoon & couples travel destinations${suffix}`,
    description:
      'Browse honeymoon and couples destinations across Europe, the USA, Canada, Australia and beyond — with real daily costs, best months to travel and ready-made day-by-day itineraries.',
    path: '/destinations',
    keywords: [
      'honeymoon destinations',
      'best places for couples',
      'romantic destinations europe',
      'couples travel guide',
      'honeymoon ideas 2026',
    ],
  });
}

const TYPES = [
  { value: '', label: 'All' },
  { value: 'honeymoon', label: '💍 Honeymoon' },
  { value: 'beach', label: '🏖️ Beach' },
  { value: 'city', label: '🏙️ City' },
  { value: 'mountain', label: '🏔️ Mountain' },
  { value: 'island', label: '🏝️ Island' },
  { value: 'historic', label: '🏛️ Historic' },
  { value: 'lake', label: '🌊 Lake' },
  { value: 'countryside', label: '🌿 Countryside' },
  { value: 'ski', label: '⛷️ Ski' },
];

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: { type?: string; region?: string; budget?: string; q?: string };
}) {
  const supabase = createClient();

  let query = supabase
    .from('destinations')
    .select('*, country:countries(name, slug, flag_emoji, region)')
    .eq('is_active', true)
    .order('popularity', { ascending: false })
    .limit(120);

  if (searchParams.type === 'honeymoon') query = query.eq('is_honeymoon', true);
  else if (searchParams.type) query = query.eq('destination_type', searchParams.type);
  if (searchParams.budget) query = query.eq('budget_level', searchParams.budget);
  if (searchParams.q) query = query.ilike('name', `%${searchParams.q}%`);

  const [{ data: destinations }, { data: countries }] = await Promise.all([
    query,
    supabase
      .from('countries')
      .select('code, name, slug, flag_emoji, region, avg_daily_cost_usd, summary, is_featured')
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  let list = (destinations ?? []) as any[];
  if (searchParams.region) {
    list = list.filter((destination) => destination.country?.region === searchParams.region);
  }

  const regions = Array.from(
    new Set(((countries ?? []) as any[]).map((country) => country.region).filter(Boolean))
  ).sort();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Destinations', path: '/destinations' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Honeymoon and couples travel destinations',
            numberOfItems: list.length,
            itemListElement: list.slice(0, 30).map((destination, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: destination.name,
              url: absoluteUrl(`/destinations/${destination.slug}`),
            })),
          },
        ]}
      />

      <section className="border-b border-border bg-secondary/20 py-14">
        <div className="container">
          <SectionHeading
            eyebrow="Travel guides"
            title="Where should the two of you go next?"
            description="Real daily costs for two, the months actually worth travelling in, and a day-by-day itinerary you can generate in one click."
          />
        </div>
      </section>

      <section className="py-10">
        <div className="container space-y-6">
          <form method="get" className="flex flex-wrap gap-3">
            <input
              type="search"
              name="q"
              defaultValue={searchParams.q ?? ''}
              placeholder="Search destinations…"
              aria-label="Search destinations"
              className="h-10 min-w-[200px] flex-1 rounded-lg border border-input bg-background px-3 text-sm"
            />
            <select
              name="region"
              defaultValue={searchParams.region ?? ''}
              aria-label="Filter by region"
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">All regions</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            <select
              name="budget"
              defaultValue={searchParams.budget ?? ''}
              aria-label="Filter by budget"
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">Any budget</option>
              <option value="budget">Budget</option>
              <option value="moderate">Moderate</option>
              <option value="premium">Premium</option>
              <option value="luxury">Luxury</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Filter
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {TYPES.map((type) => {
              const active = (searchParams.type ?? '') === type.value;
              const params = new URLSearchParams();
              if (type.value) params.set('type', type.value);
              if (searchParams.region) params.set('region', searchParams.region);
              if (searchParams.budget) params.set('budget', searchParams.budget);
              return (
                <Link
                  key={type.value || 'all'}
                  href={`/destinations${params.toString() ? `?${params}` : ''}`}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:bg-secondary'
                  )}
                >
                  {type.label}
                </Link>
              );
            })}
          </div>

          <p className="text-sm text-muted-foreground">{list.length} destinations</p>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((destination) => (
              <Link key={destination.id} href={`/destinations/${destination.slug}`} className="group">
                <Card className="h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    {destination.hero_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${destination.hero_image}?auto=format&fit=crop&w=800&q=70`}
                        alt={`${destination.name}, ${destination.country?.name}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium">
                      {destination.country?.flag_emoji} {destination.country?.name}
                    </span>
                    {destination.is_honeymoon && (
                      <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                        💍 {destination.honeymoon_score}/100
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h2 className="font-semibold group-hover:text-primary">{destination.name}</h2>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {destination.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      {destination.avg_daily_cost_usd && (
                        <Badge tone="outline">
                          {formatMoney(destination.avg_daily_cost_usd * 100, 'USD', {
                            showDecimals: false,
                          })}
                          /day
                        </Badge>
                      )}
                      {destination.ideal_days && <Badge tone="outline">{destination.ideal_days} days</Badge>}
                      {destination.budget_level && (
                        <Badge tone="outline" className="capitalize">
                          {destination.budget_level}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {list.length === 0 && (
            <Card className="p-10 text-center">
              <p className="font-medium">No destinations match those filters</p>
              <ButtonLink href="/destinations" variant="outline" className="mt-4">
                Clear filters
              </ButtonLink>
            </Card>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-secondary/20 py-14">
        <div className="container">
          <SectionHeading
            eyebrow="By country"
            title="Browse country guides"
            description="Costs, seasons, visa notes and the best places for couples in each country."
          />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {((countries ?? []) as any[]).map((country) => (
              <Link
                key={country.code}
                href={`/countries/${country.slug}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary"
              >
                <span>
                  {country.flag_emoji} {country.name}
                </span>
                {country.avg_daily_cost_usd && (
                  <span className="text-xs text-muted-foreground">
                    ${country.avg_daily_cost_usd}/day
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
