'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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

export async function saveTripAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Create your relationship space first.' };

  const tripId = String(formData.get('id') ?? '');
  const supabase = createClient();

  if (!tripId) {
    const entitlements = await getEntitlements();
    const { count } = await supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', ctx.context.couple.id)
      .neq('status', 'cancelled');
    if (limitReached(entitlements.limits, 'trips', count ?? 0)) {
      return { ok: false, error: upgradeMessage('trips') };
    }
  }

  const destinationId = String(formData.get('destination_id') ?? '') || null;
  let countryCode = String(formData.get('country_code') ?? '') || null;
  let coverImage = String(formData.get('cover_image') ?? '') || null;

  if (destinationId) {
    const { data: destination } = await supabase
      .from('destinations')
      .select('country_code, hero_image')
      .eq('id', destinationId)
      .maybeSingle();
    if (destination) {
      countryCode = countryCode ?? (destination as any).country_code;
      coverImage = coverImage ?? (destination as any).hero_image;
    }
  }

  const payload = {
    couple_id: ctx.context.couple.id,
    destination_id: destinationId,
    country_code: countryCode,
    title: String(formData.get('title') ?? '').trim(),
    trip_type: String(formData.get('trip_type') ?? 'vacation'),
    status: String(formData.get('status') ?? 'planning'),
    start_date: String(formData.get('start_date') ?? '') || null,
    end_date: String(formData.get('end_date') ?? '') || null,
    travelers: Number(formData.get('travelers') ?? 2),
    budget_cents: formData.get('budget')
      ? Math.round(Number(formData.get('budget')) * 100)
      : null,
    currency: String(formData.get('currency') ?? ctx.context.couple.currency),
    cover_image: coverImage,
    notes: String(formData.get('notes') ?? '').trim() || null,
    created_by: ctx.user.id,
  };

  if (!payload.title) return { ok: false, error: 'Give the trip a title.' };

  const { data, error } = tripId
    ? await supabase.from('trips').update(payload).eq('id', tripId).select('id').single()
    : await supabase.from('trips').insert(payload).select('id').single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/travel');
  return { ok: true, message: 'Trip saved.', data: (data as any).id };
}

export async function deleteTripAction(tripId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) return { ok: false, error: error.message };
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

  const supabase = createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('*, destination:destinations(*)')
    .eq('id', tripId)
    .maybeSingle();

  if (!trip) return { ok: false, error: 'Trip not found.' };

  const destination = (trip as any).destination;
  if (!destination) {
    return { ok: false, error: 'Pick a destination for this trip first.' };
  }

  const { data: attractions } = await supabase
    .from('attractions')
    .select('*')
    .eq('destination_id', destination.id)
    .order('sort_order');

  const startDate = (trip as any).start_date as string | null;
  const endDate = (trip as any).end_date as string | null;

  const daysFromDates =
    startDate && endDate
      ? Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
        ) + 1
      : null;

  const requestedDays = Number(formData.get('days'));
  const days = Math.max(
    1,
    Math.min(21, requestedDays > 0 ? requestedDays : (daysFromDates ?? 5))
  );

  const interests = String(formData.get('interests') ?? '')
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  const plan = generateItinerary({
    destination,
    attractions: (attractions ?? []) as any[],
    startDate: (trip as any).start_date,
    days,
    pace: (String(formData.get('pace') ?? 'balanced') as Pace) ?? 'balanced',
    interests,
    travelers: (trip as any).travelers ?? 2,
    includeMeals: formData.get('include_meals') !== 'false',
    romanticFocus: formData.get('romantic') !== 'false',
  });

  // Replace any previous generated itinerary for this trip.
  await supabase.from('itineraries').delete().eq('trip_id', tripId).eq('generated_by', 'generator');

  const { data: itinerary, error } = await supabase
    .from('itineraries')
    .insert({
      trip_id: tripId,
      couple_id: ctx.context.couple.id,
      title: `${destination.name} — ${days} days`,
      pace: String(formData.get('pace') ?? 'balanced'),
      interests,
      generated_by: 'generator',
      total_cost_cents: estimateCost(plan),
      currency: (trip as any).currency ?? 'USD',
      is_primary: true,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  for (const day of plan) {
    const { data: dayRow, error: dayError } = await supabase
      .from('itinerary_days')
      .insert({
        itinerary_id: (itinerary as any).id,
        day_number: day.day_number,
        day_date: day.day_date,
        title: day.title,
        summary: day.summary,
      })
      .select('id')
      .single();

    if (dayError || !dayRow) continue;

    await supabase.from('itinerary_items').insert(
      day.items.map((item, index) => ({
        day_id: (dayRow as any).id,
        attraction_id: item.attraction_id ?? null,
        start_time: item.start_time,
        end_time: item.end_time ?? null,
        title: item.title,
        item_type: item.item_type,
        location: item.location ?? null,
        description: item.description ?? null,
        duration_minutes: item.duration_minutes ?? null,
        cost_cents: item.cost_cents ?? null,
        currency: (trip as any).currency ?? 'USD',
        sort_order: index,
      }))
    );
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

  const supabase = createClient();
  const { error } = await supabase.from('itinerary_items').update({ is_done: done }).eq('id', itemId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addItineraryItemAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const { error } = await supabase.from('itinerary_items').insert({
    day_id: String(formData.get('day_id') ?? ''),
    title: String(formData.get('title') ?? '').trim(),
    item_type: String(formData.get('item_type') ?? 'activity'),
    start_time: String(formData.get('start_time') ?? '') || null,
    location: String(formData.get('location') ?? '').trim() || null,
    cost_cents: formData.get('cost') ? Math.round(Number(formData.get('cost')) * 100) : null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/travel');
  return { ok: true, message: 'Added.' };
}

export async function deleteItineraryItemAction(itemId: string): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };
  const supabase = createClient();
  const { error } = await supabase.from('itinerary_items').delete().eq('id', itemId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* --------------------------------------------------------- Packing lists */

export async function createPackingListAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const templateId = String(formData.get('template_id') ?? '') || null;
  const tripId = String(formData.get('trip_id') ?? '') || null;

  let name = String(formData.get('name') ?? '').trim() || 'Packing list';
  let items: any[] = [];

  if (templateId) {
    const { data: template } = await supabase
      .from('checklist_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();
    if (template) {
      name = (template as any).name;
      items = Array.isArray((template as any).items) ? (template as any).items : [];
    }
  }

  const { data: list, error } = await supabase
    .from('packing_lists')
    .insert({
      trip_id: tripId,
      couple_id: ctx.context.couple.id,
      name,
      template_id: templateId,
      created_by: ctx.user.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  if (items.length) {
    await supabase.from('packing_items').insert(
      items.map((item, index) => ({
        list_id: (list as any).id,
        name: item.name ?? 'Item',
        category: item.category ?? 'General',
        is_essential: Boolean(item.essential),
        sort_order: index,
      }))
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

  const supabase = createClient();
  const { error } = await supabase
    .from('packing_items')
    .update({
      is_packed: packed,
      packed_by: packed ? ctx.user.id : null,
      packed_at: packed ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function assignPackingItemAction(
  itemId: string,
  userId: string | null
): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('packing_items')
    .update({ assigned_to: userId })
    .eq('id', itemId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/travel');
  return { ok: true };
}

export async function addPackingItemAction(formData: FormData): Promise<ActionResult> {
  const ctx = await space();
  if (!ctx) return { ok: false, error: 'Not available.' };

  const supabase = createClient();
  const { error } = await supabase.from('packing_items').insert({
    list_id: String(formData.get('list_id') ?? ''),
    name: String(formData.get('name') ?? '').trim(),
    category: String(formData.get('category') ?? 'General'),
    quantity: Number(formData.get('quantity') ?? 1),
    assigned_to: String(formData.get('assigned_to') ?? '') || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/travel');
  return { ok: true };
}
