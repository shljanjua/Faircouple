import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCoupleContext, getEntitlements } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { TripWorkspace } from '@/components/app/trip-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Trip', noIndex: true });
}

export default async function TripDetailPage({ params }: { params: { tripId: string } }) {
  const context = await getCoupleContext();
  if (!context) notFound();

  const entitlements = await getEntitlements();
  const supabase = createClient();

  const { data: trip } = await supabase
    .from('trips')
    .select('*, destination:destinations(*, country:countries(name, flag_emoji))')
    .eq('id', params.tripId)
    .eq('couple_id', context.couple.id)
    .maybeSingle();

  if (!trip) notFound();

  const [{ data: itineraries }, { data: documents }, { data: packingLists }, { data: expenses }, { data: templates }] =
    await Promise.all([
      supabase
        .from('itineraries')
        .select('*, days:itinerary_days(*, items:itinerary_items(*))')
        .eq('trip_id', params.tripId)
        .order('created_at', { ascending: false }),
      supabase
        .from('travel_documents')
        .select('*')
        .eq('trip_id', params.tripId)
        .order('depart_at', { ascending: true }),
      supabase
        .from('packing_lists')
        .select('*, items:packing_items(*)')
        .eq('trip_id', params.tripId),
      supabase.from('expenses').select('*').eq('trip_id', params.tripId),
      supabase
        .from('checklist_templates')
        .select('id, name, emoji, category')
        .in('category', ['packing', 'travel', 'honeymoon'])
        .order('sort_order'),
    ]);

  const itinerary = ((itineraries ?? []) as any[])[0] ?? null;
  if (itinerary?.days) {
    itinerary.days.sort((a: any, b: any) => a.day_number - b.day_number);
    for (const day of itinerary.days) {
      day.items?.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/travel"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All trips
      </Link>

      <TripWorkspace
        trip={trip as any}
        itinerary={itinerary}
        documents={(documents ?? []) as any[]}
        packingLists={((packingLists ?? []) as any[]).map((list) => ({
          ...list,
          items: (list.items ?? []).sort(
            (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
          ),
        }))}
        expenses={(expenses ?? []) as any[]}
        templates={(templates ?? []) as any[]}
        members={context.members.map((member) => ({
          id: member.user_id,
          name: member.profile?.full_name ?? 'Member',
        }))}
        canGenerate={entitlements.limits.itinerary_generator}
      />
    </div>
  );
}
