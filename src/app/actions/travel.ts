'use server';

import { revalidatePath } from 'next/cache';
import { execute, query, queryOne, uuid, nowSql, parseJson } from '@/lib/db';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { limitReached, upgradeMessage } from '@/lib/plans';
import { generateItinerary, estimateCost, type Pace } from '@/lib/itinerary';
import type { ActionResult } from '@/app/actions/couple';

async function space() {
  const user = await getSessionUser();
  const context = await getCoupleContext();
  if (!user || !context) return null;
  return { user, context };
}

/** Confirms a trip belongs to the caller's space. */
async function ownsTrip(tripId: string, coupleId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM trips WHERE id = ? AND couple_id = ? LIMIT 1`,
    [tripId, coupleId]
  );
  return Boolean(row);
}

async function ownsItineraryItem(itemId: string, coupleId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT i.id FROM itinerary_items i
       JOIN itinerary_days d ON d.id = i.day_id
       JOIN itineraries it ON it.id = d.itinerary_id
      WHERE i.id = ? AND it.couple_id = ? LIMIT 1`,
    [itemId, coupleId]
  );
  return Boolean(row);
}

async function ownsPackingItem(itemId: string, coupleId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT i.id FROM packing_items i
       JOIN packing_lists l ON l.id = i.list_id
      WHERE i.id = ? AND l.couple_id = ? LIMIT 1`,
    [itemId, coupleId]
  );
  return Boolean(row);
}

export async function saveTripAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const tripId = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { ok: false, error: 'Give the trip a title.' };

  if (!tripId) {
    const entitlements = await getEntitlements();
    const row = await queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM trips WHERE couple_id = ? AND status <> 'cancelled'`,
      [ctx.context.couple.id]
    );
    if (limitReached(entitlements.limits, 'trips', Number(row?.total ?? 0))) {
      return { ok: false, error: upgradeMessage('trips') };
    }
  }

  const destinationId = String(formData.get('destination_id') ?? '') || null;
  let countryCode = String(formData.get('country_code') ?? '') || null;
  let coverImage = String(formData.get('cover_image') ?? '') || null;

  if (destinationId) {
    const destination = await queryOne<{ country_code: string; hero_image: string | null }>(
      `SELECT country_code, hero_image FROM destinations WHERE id = ? LIMIT 1`,
      [destinationId]
    );
    if (destination) {
      countryCode = countryCode ?? destination.country_code;
      coverImage = coverImage ?? destination.hero_image;
    }
  }

  const values = [
    destinationId,
    countryCode,
    title,
    String(formData.get('trip_type') ?? 'vacation'),
    String(formData.get('status') ?? 'planning'),
    String(formData.get('start_date') ?? '') || null,
    String(formData.get('end_date') ?? '') || null,
    Number(formData.get('travelers') ?? 2),
    formData.get('budget') ? Math.round(Number(formData.get('budget')) * 100) : null,
    String(formData.get('currency') ?? ctx.context.couple.currency),
    coverImage,
    String(formData.get('notes') ?? '').trim() || null,
  ];

  let savedId = tripId;

  if (tripId) {
    const result = await execute(
      `UPDATE trips
          SET destination_id = ?, country_code = ?, title = ?, trip_type = ?, status = ?,
              start_date = ?, end_date = ?, travelers = ?, budget_cents = ?, currency = ?,
              cover_image = ?, notes = ?
        WHERE id = ? AND couple_id = ?`,
      [...values, tripId, ctx.context.couple.id]
    );
    if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the trip.' };
  } else {
    savedId = uuid();
    const result = await execute(
      `INSERT INTO trips
         (id, couple_id, destination_id, country_code, title, trip_type, status, start_date,
          end_date, travelers, budget_cents, currency, cover_image, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [savedId, ctx.context.couple.id, ...values, ctx.user.id]
    );
    if (!result.ok) return { ok: false, error: result.error ?? 'Could not save the trip.' };
  }

  revalidatePath('/dashboard/travel');
  return { ok: true, message: 'Trip saved.', data: savedId };
}

export async function deleteTripAction(tripId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const result = await execute(`DELETE FROM trips WHERE id = ? AND couple_id = ?`, [
    tripId,
    ctx.context.couple.id,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the trip.' };
  revalidatePath('/dashboard/travel');
  return { ok: true, message: 'Trip deleted.' };
}

/** Builds a full day-by-day itinerary for a trip from its destination data. */
export async function generateItineraryAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const entitlements = await getEntitlements();
  if (!entitlements.limits.itinerary_generator) {
    return { ok: false, error: upgradeMessage('itinerary_generator') };
  }

  const tripId = String(formData.get('trip_id') ?? '');
  if (!tripId) return { ok: false, error: 'Missing trip.' };

  const trip = await queryOne<any>(`SELECT * FROM trips WHERE id = ? AND couple_id = ? LIMIT 1`, [
    tripId,
    ctx.context.couple.id,
  ]);
  if (!trip) return { ok: false, error: 'Trip not found.' };

  if (!trip.destination_id) {
    return { ok: false, error: 'Pick a destination for this trip first.' };
  }

  const destination = await queryOne<any>(`SELECT * FROM destinations WHERE id = ? LIMIT 1`, [
    trip.destination_id,
  ]);
  if (!destination) return { ok: false, error: 'Pick a destination for this trip first.' };

  const attractions = await query<any>(
    `SELECT * FROM attractions WHERE destination_id = ? ORDER BY sort_order ASC`,
    [destination.id]
  );

  const startDate = trip.start_date ? new Date(trip.start_date) : null;
  const endDate = trip.end_date ? new Date(trip.end_date) : null;

  const daysFromDates =
    startDate && endDate
      ? Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1
      : null;

  const requestedDays = Number(formData.get('days'));
  const days = Math.max(1, Math.min(21, requestedDays > 0 ? requestedDays : (daysFromDates ?? 5)));

  const interests = String(formData.get('interests') ?? '')
    .split(',')
    .map((interest) => interest.trim())
    .filter(Boolean);

  const pace = String(formData.get('pace') ?? 'balanced') as Pace;

  const plan = generateItinerary({
    destination,
    attractions,
    startDate: trip.start_date ? String(trip.start_date).slice(0, 10) : null,
    days,
    pace,
    interests,
    travelers: trip.travelers ?? 2,
    includeMeals: formData.get('include_meals') !== 'false',
    romanticFocus: formData.get('romantic') !== 'false',
  });

  // Replace any previous generated itinerary for this trip.
  await execute(`DELETE FROM itineraries WHERE trip_id = ? AND generated_by = 'generator'`, [
    tripId,
  ]);

  const itineraryId = uuid();
  const created = await execute(
    `INSERT INTO itineraries
       (id, trip_id, couple_id, title, pace, interests, generated_by, total_cost_cents, currency, is_primary)
     VALUES (?, ?, ?, ?, ?, ?, 'generator', ?, ?, 1)`,
    [
      itineraryId,
      tripId,
      ctx.context.couple.id,
      `${destination.name} — ${days} days`,
      pace,
      JSON.stringify(interests),
      estimateCost(plan),
      trip.currency ?? 'USD',
    ]
  );

  if (!created.ok) return { ok: false, error: created.error ?? 'Could not build the itinerary.' };

  for (const day of plan) {
    const dayId = uuid();
    const dayResult = await execute(
      `INSERT INTO itinerary_days (id, itinerary_id, day_number, day_date, title, summary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dayId, itineraryId, day.day_number, day.day_date, day.title, day.summary]
    );
    if (!dayResult.ok) continue;

    for (const [index, item] of day.items.entries()) {
      await execute(
        `INSERT INTO itinerary_items
           (id, day_id, attraction_id, start_time, end_time, title, item_type, location,
            description, duration_minutes, cost_cents, currency, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          dayId,
          item.attraction_id ?? null,
          item.start_time,
          item.end_time ?? null,
          item.title,
          item.item_type,
          item.location ?? null,
          item.description ?? null,
          item.duration_minutes ?? null,
          item.cost_cents ?? null,
          trip.currency ?? 'USD',
          index,
        ]
      );
    }
  }

  revalidatePath(`/dashboard/travel/${tripId}`);
  return { ok: true, message: `Generated a ${days}-day itinerary.` };
}

export async function toggleItineraryItemAction(
  itemId: string,
  done: boolean
): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };
  if (!(await ownsItineraryItem(itemId, ctx.context.couple.id))) {
    return { ok: false, error: 'Item not found.' };
  }

  const result = await execute(`UPDATE itinerary_items SET is_done = ? WHERE id = ?`, [
    done,
    itemId,
  ]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not update the item.' };
  return { ok: true };
}

export async function addItineraryItemAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const dayId = String(formData.get('day_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!dayId || !title) return { ok: false, error: 'Give the stop a name.' };

  const owns = await queryOne<{ id: string }>(
    `SELECT d.id FROM itinerary_days d
       JOIN itineraries it ON it.id = d.itinerary_id
      WHERE d.id = ? AND it.couple_id = ? LIMIT 1`,
    [dayId, ctx.context.couple.id]
  );
  if (!owns) return { ok: false, error: 'Day not found.' };

  const result = await execute(
    `INSERT INTO itinerary_items
       (id, day_id, title, item_type, start_time, location, cost_cents, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      dayId,
      title,
      String(formData.get('item_type') ?? 'activity'),
      String(formData.get('start_time') ?? '') || null,
      String(formData.get('location') ?? '').trim() || null,
      formData.get('cost') ? Math.round(Number(formData.get('cost')) * 100) : null,
      String(formData.get('notes') ?? '').trim() || null,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not add the stop.' };
  revalidatePath('/dashboard/travel');
  return { ok: true, message: 'Added.' };
}

export async function deleteItineraryItemAction(itemId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };
  if (!(await ownsItineraryItem(itemId, ctx.context.couple.id))) {
    return { ok: false, error: 'Item not found.' };
  }

  const result = await execute(`DELETE FROM itinerary_items WHERE id = ?`, [itemId]);
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not delete the stop.' };
  return { ok: true };
}

/* --------------------------------------------------------- Packing lists */

export async function createPackingListAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const templateId = String(formData.get('template_id') ?? '') || null;
  const tripId = String(formData.get('trip_id') ?? '') || null;

  if (tripId && !(await ownsTrip(tripId, ctx.context.couple.id))) {
    return { ok: false, error: 'Trip not found.' };
  }

  let name = String(formData.get('name') ?? '').trim() || 'Packing list';
  let items: any[] = [];

  if (templateId) {
    const template = await queryOne<any>(
      `SELECT * FROM checklist_templates WHERE id = ? LIMIT 1`,
      [templateId]
    );
    if (template) {
      name = template.name;
      items = parseJson<any[]>(template.items, []);
    }
  }

  const listId = uuid();
  const created = await execute(
    `INSERT INTO packing_lists (id, trip_id, couple_id, name, template_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [listId, tripId, ctx.context.couple.id, name, templateId, ctx.user.id]
  );

  if (!created.ok) return { ok: false, error: created.error ?? 'Could not create the list.' };

  for (const [index, item] of items.entries()) {
    await execute(
      `INSERT INTO packing_items (id, list_id, name, category, is_essential, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        listId,
        item.name ?? 'Item',
        item.category ?? 'General',
        Boolean(item.essential),
        index,
      ]
    );
  }

  revalidatePath('/dashboard/travel');
  return { ok: true, message: 'Packing list added.' };
}

export async function togglePackingItemAction(
  itemId: string,
  packed: boolean
): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };
  if (!(await ownsPackingItem(itemId, ctx.context.couple.id))) {
    return { ok: false, error: 'Item not found.' };
  }

  const result = await execute(
    `UPDATE packing_items SET is_packed = ?, packed_by = ?, packed_at = ? WHERE id = ?`,
    [packed, packed ? ctx.user.id : null, packed ? nowSql() : null, itemId]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not update the item.' };
  return { ok: true };
}

export async function assignPackingItemAction(
  itemId: string,
  userId: string | null
): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };
  if (!(await ownsPackingItem(itemId, ctx.context.couple.id))) {
    return { ok: false, error: 'Item not found.' };
  }

  const result = await execute(`UPDATE packing_items SET assigned_to = ? WHERE id = ?`, [
    userId,
    itemId,
  ]);

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not assign the item.' };
  revalidatePath('/dashboard/travel');
  return { ok: true };
}

export async function addPackingItemAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const listId = String(formData.get('list_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!listId || !name) return { ok: false, error: 'Give the item a name.' };

  const owns = await queryOne<{ id: string }>(
    `SELECT id FROM packing_lists WHERE id = ? AND couple_id = ? LIMIT 1`,
    [listId, ctx.context.couple.id]
  );
  if (!owns) return { ok: false, error: 'List not found.' };

  const result = await execute(
    `INSERT INTO packing_items (id, list_id, name, category, quantity, assigned_to)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      listId,
      name,
      String(formData.get('category') ?? 'General'),
      Number(formData.get('quantity') ?? 1),
      String(formData.get('assigned_to') ?? '') || null,
    ]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not add the item.' };
  revalidatePath('/dashboard/travel');
  return { ok: true };
}
