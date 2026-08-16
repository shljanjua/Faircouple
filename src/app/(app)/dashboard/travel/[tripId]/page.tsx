import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { query, queryOne, parseJson, toBool } from '@/lib/db';
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

  const tripRow = await queryOne<any>(
    `SELECT t.*, d.id AS destination_id, d.name AS destination_name, d.slug AS destination_slug,
            d.hero_image AS destination_image, d.ideal_days AS destination_ideal_days,
            c.name AS country_name, c.flag_emoji AS country_flag
       FROM trips t
       LEFT JOIN destinations d ON d.id = t.destination_id
       LEFT JOIN countries c ON c.code = t.country_code
      WHERE t.id = ? AND t.couple_id = ?
      LIMIT 1`,
    [params.tripId, context.couple.id]
  );

  if (!tripRow) notFound();

  const trip = {
    ...tripRow,
    destination: tripRow.destination_id
      ? {
          id: tripRow.destination_id,
          name: tripRow.destination_name,
          slug: tripRow.destination_slug,
          hero_image: tripRow.destination_image,
          ideal_days: tripRow.destination_ideal_days,
          country: { name: tripRow.country_name, flag_emoji: tripRow.country_flag },
        }
      : null,
  };

  const [itineraryRow, documents, packingRows, packingItemRows, expenses, templates] =
    await Promise.all([
      queryOne<any>(
        `SELECT * FROM itineraries WHERE trip_id = ? ORDER BY created_at DESC LIMIT 1`,
        [params.tripId]
      ),
      query<any>(`SELECT * FROM travel_documents WHERE trip_id = ? ORDER BY depart_at ASC`, [
        params.tripId,
      ]),
      query<any>(`SELECT * FROM packing_lists WHERE trip_id = ?`, [params.tripId]),
      query<any>(
        `SELECT i.* FROM packing_items i
           JOIN packing_lists l ON l.id = i.list_id
          WHERE l.trip_id = ? ORDER BY i.sort_order ASC`,
        [params.tripId]
      ),
      query<any>(`SELECT * FROM expenses WHERE trip_id = ?`, [params.tripId]),
      query<any>(
        `SELECT id, name, emoji, category FROM checklist_templates
          WHERE category IN ('packing','travel','honeymoon') ORDER BY sort_order ASC`
      ),
    ]);

  let itinerary: any = null;
  if (itineraryRow) {
    const days = await query<any>(
      `SELECT * FROM itinerary_days WHERE itinerary_id = ? ORDER BY day_number ASC`,
      [itineraryRow.id]
    );
    const items = days.length
      ? await query<any>(
          `SELECT * FROM itinerary_items WHERE day_id IN (${days.map(() => '?').join(',')})
            ORDER BY sort_order ASC`,
          days.map((day) => day.id)
        )
      : [];

    itinerary = {
      ...itineraryRow,
      interests: parseJson<string[]>(itineraryRow.interests, []),
      days: days.map((day) => ({
        ...day,
        items: items
          .filter((item) => item.day_id === day.id)
          .map((item) => ({ ...item, is_done: toBool(item.is_done) })),
      })),
    };
  }

  const packingLists = packingRows.map((list) => ({
    ...list,
    items: packingItemRows
      .filter((item) => item.list_id === list.id)
      .map((item) => ({
        ...item,
        is_packed: toBool(item.is_packed),
        is_essential: toBool(item.is_essential),
      })),
  }));

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
        documents={documents}
        packingLists={packingLists}
        expenses={expenses}
        templates={templates}
        members={context.members.map((member) => ({
          id: member.user_id,
          name: member.profile?.full_name ?? 'Member',
        }))}
        canGenerate={entitlements.limits.itinerary_generator}
      />
    </div>
  );
}
