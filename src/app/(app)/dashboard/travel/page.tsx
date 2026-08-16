import type { Metadata } from 'next';
import Link from 'next/link';
import { Plane } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCoupleContext, getEntitlements } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { TripForm } from '@/components/app/trip-form';
import { Badge, Card, EmptyState } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { formatMoney } from '@/lib/currency';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Trips', path: '/dashboard/travel', noIndex: true });
}

export default async function TravelPage() {
  const context = await getCoupleContext();
  const entitlements = await getEntitlements();

  if (!context) {
    return (
      <EmptyState
        icon="✈️"
        title="Create your relationship space first"
        action={<ButtonLink href="/onboarding">Set up my space</ButtonLink>}
      />
    );
  }

  const supabase = createClient();
  const [{ data: trips }, { data: destinations }] = await Promise.all([
    supabase
      .from('trips')
      .select('*, destination:destinations(name, slug, hero_image, country_code)')
      .eq('couple_id', context.couple.id)
      .order('start_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('destinations')
      .select('id, name, country_code, is_honeymoon')
      .eq('is_active', true)
      .order('popularity', { ascending: false })
      .limit(200),
  ]);

  const list = (trips ?? []) as any[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Trips</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan the trip, generate the itinerary, split the cost and keep every booking in one vault.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        <TripForm
          destinations={(destinations ?? []) as any[]}
          currency={context.couple.currency}
        />

        <div className="space-y-4">
          {list.length === 0 ? (
            <Card className="p-10 text-center">
              <Plane className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-medium">No trips yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse the{' '}
                <Link href="/destinations" className="font-medium text-primary underline">
                  destination guides
                </Link>{' '}
                for costs and best months, then plan it here.
              </p>
            </Card>
          ) : (
            list.map((trip) => (
              <Link key={trip.id} href={`/dashboard/travel/${trip.id}`} className="block">
                <Card className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex">
                    {(trip.cover_image || trip.destination?.hero_image) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${trip.cover_image || trip.destination?.hero_image}?auto=format&fit=crop&w=400&q=60`}
                        alt=""
                        className="hidden h-auto w-40 object-cover sm:block"
                      />
                    )}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{trip.title}</h2>
                          <p className="text-sm text-muted-foreground">
                            {trip.destination?.name ?? 'Destination to confirm'}
                          </p>
                        </div>
                        <Badge
                          tone={
                            trip.status === 'completed'
                              ? 'success'
                              : trip.status === 'booked' || trip.status === 'ongoing'
                                ? 'info'
                                : 'outline'
                          }
                        >
                          {trip.status}
                        </Badge>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs text-muted-foreground">Dates</dt>
                          <dd>
                            {trip.start_date ? formatDate(trip.start_date) : 'TBC'}
                            {trip.end_date ? ` → ${formatDate(trip.end_date)}` : ''}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Budget</dt>
                          <dd>
                            {trip.budget_cents
                              ? formatMoney(trip.budget_cents, trip.currency, { showDecimals: false })
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Type</dt>
                          <dd className="capitalize">{trip.trip_type}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          )}

          {!entitlements.limits.itinerary_generator && (
            <Card className="border-primary/30 bg-primary/5 p-4 text-sm">
              The day-by-day <strong>itinerary generator</strong> is available on Essential and
              above.{' '}
              <Link href="/pricing" className="font-medium text-primary underline">
                Compare plans
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
