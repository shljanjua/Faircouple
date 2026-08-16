import type { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { buildMetadata } from '@/lib/seo';
import { Badge, Card, Stat, Table, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Destinations', noIndex: true });
}

export default async function AdminDestinationsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createAdminClient();

  let query = supabase
    .from('destinations')
    .select('*, country:countries(name, flag_emoji, region)')
    .order('popularity', { ascending: false })
    .limit(200);

  if (searchParams.q) query = query.ilike('name', `%${searchParams.q}%`);

  const [{ data: destinations }, { count: countryCount }, { count: attractionCount }] =
    await Promise.all([
      query,
      supabase.from('countries').select('code', { count: 'exact', head: true }),
      supabase.from('attractions').select('id', { count: 'exact', head: true }),
    ]);

  const list = (destinations ?? []) as any[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Destinations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The travel catalogue behind the public guides and the itinerary generator.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Destinations" value={list.length} />
        <Stat label="Countries" value={countryCount ?? 0} />
        <Stat label="Attractions" value={attractionCount ?? 0} />
      </div>

      <Card className="p-4">
        <form method="get" className="flex gap-3">
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Search destinations…"
            aria-label="Search destinations"
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Search
          </button>
        </form>
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>Destination</Th>
            <Th>Country</Th>
            <Th>Type</Th>
            <Th>Daily cost</Th>
            <Th>Honeymoon</Th>
            <Th className="text-right">Public page</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((destination) => (
            <tr key={destination.id}>
              <Td>
                <span className="font-medium">{destination.name}</span>
                <span className="block text-xs text-muted-foreground">/{destination.slug}</span>
              </Td>
              <Td className="text-muted-foreground">
                {destination.country?.flag_emoji} {destination.country?.name}
              </Td>
              <Td className="capitalize text-muted-foreground">{destination.destination_type}</Td>
              <Td className="text-muted-foreground">
                {destination.avg_daily_cost_usd ? `$${destination.avg_daily_cost_usd}` : '—'}
              </Td>
              <Td>
                {destination.is_honeymoon ? (
                  <Badge tone="primary">{destination.honeymoon_score ?? 0}/100</Badge>
                ) : (
                  <Badge tone="outline">no</Badge>
                )}
              </Td>
              <Td className="text-right">
                <Link
                  href={`/destinations/${destination.slug}`}
                  target="_blank"
                  className="text-sm text-primary underline"
                >
                  View
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Card className="p-5 text-sm text-muted-foreground">
        Destinations, countries and attractions are seeded from{' '}
        <code>supabase/migrations/0003_seed.sql</code>. To add more, insert rows into the{' '}
        <code>destinations</code> and <code>attractions</code> tables — the public guides, sitemap
        and itinerary generator pick them up automatically.
      </Card>
    </div>
  );
}
