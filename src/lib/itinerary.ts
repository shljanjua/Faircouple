import type { Attraction, Destination } from '@/types';

export type Pace = 'relaxed' | 'balanced' | 'packed';

export interface GeneratorOptions {
  destination: Pick<Destination, 'name' | 'city' | 'avg_daily_cost_usd' | 'highlights'>;
  attractions: Attraction[];
  startDate?: string | null;
  days: number;
  pace: Pace;
  interests: string[];
  travelers: number;
  includeMeals: boolean;
  romanticFocus: boolean;
}

export interface GeneratedItem {
  start_time: string;
  end_time?: string;
  title: string;
  item_type: 'activity' | 'meal' | 'transport' | 'hotel' | 'flight' | 'rest' | 'shopping' | 'free_time';
  location?: string;
  description?: string;
  duration_minutes?: number;
  cost_cents?: number;
  attraction_id?: string;
}

export interface GeneratedDay {
  day_number: number;
  day_date: string | null;
  title: string;
  summary: string;
  items: GeneratedItem[];
}

const PACE_CONFIG: Record<Pace, { activities: number; startHour: number; gapMinutes: number }> = {
  relaxed: { activities: 2, startHour: 10, gapMinutes: 90 },
  balanced: { activities: 3, startHour: 9, gapMinutes: 60 },
  packed: { activities: 5, startHour: 8, gapMinutes: 30 },
};

const INTEREST_TO_CATEGORY: Record<string, string[]> = {
  romance: ['romantic', 'sightseeing', 'nature'],
  culture: ['museum', 'religious', 'sightseeing'],
  food: ['food', 'shopping'],
  nature: ['nature', 'beach'],
  adventure: ['adventure', 'nature'],
  nightlife: ['nightlife', 'food'],
  shopping: ['shopping'],
  relaxation: ['beach', 'nature'],
  family: ['family', 'sightseeing'],
};

function toMinutes(hour: number, minute = 0) {
  return hour * 60 + minute;
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function scoreAttraction(attraction: Attraction, interests: string[], romantic: boolean) {
  let score = attraction.is_must_see ? 40 : 10;
  if (romantic && attraction.is_romantic) score += 25;
  score += Number(attraction.rating ?? 4.5) * 4;

  const wanted = new Set(interests.flatMap((i) => INTEREST_TO_CATEGORY[i] ?? [i]));
  if (wanted.has(attraction.category)) score += 30;
  return score;
}

/**
 * Builds a day-by-day plan from a destination's attractions. Deterministic:
 * the same inputs always produce the same itinerary, so a couple can both
 * regenerate it and see the same thing.
 */
export function generateItinerary(options: GeneratorOptions): GeneratedDay[] {
  const { destination, attractions, days, pace, interests, includeMeals, romanticFocus } = options;
  const config = PACE_CONFIG[pace];

  const ranked = [...attractions].sort(
    (a, b) =>
      scoreAttraction(b, interests, romanticFocus) - scoreAttraction(a, interests, romanticFocus)
  );

  const fallbackTitles = (destination.highlights ?? []).filter(Boolean);
  const location = destination.city || destination.name;
  const result: GeneratedDay[] = [];

  let cursor = 0;
  let fallbackCursor = 0;

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const items: GeneratedItem[] = [];
    let clock = toMinutes(config.startHour);
    const dayNumber = dayIndex + 1;
    const isFirst = dayIndex === 0;
    const isLast = dayIndex === days - 1 && days > 1;

    if (isFirst) {
      items.push({
        start_time: formatTime(toMinutes(config.startHour - 1)),
        title: 'Arrival & hotel check-in',
        item_type: 'hotel',
        location,
        description: 'Drop bags, get local currency and a data eSIM, then start slowly.',
        duration_minutes: 60,
      });
    }

    const activityCount = isLast ? Math.max(1, config.activities - 1) : config.activities;

    for (let slot = 0; slot < activityCount; slot += 1) {
      const attraction = ranked[cursor];
      let item: GeneratedItem;

      if (attraction) {
        const duration = attraction.duration_minutes ?? 120;
        item = {
          start_time: formatTime(clock),
          end_time: formatTime(clock + duration),
          title: attraction.name,
          item_type: 'activity',
          location: attraction.name,
          description: attraction.description ?? undefined,
          duration_minutes: duration,
          cost_cents: attraction.ticket_price_usd
            ? Math.round(Number(attraction.ticket_price_usd) * 100)
            : undefined,
          attraction_id: attraction.id,
        };
        cursor += 1;
        clock += duration + config.gapMinutes;
      } else {
        const title =
          fallbackTitles[fallbackCursor % Math.max(1, fallbackTitles.length)] ||
          `Explore ${location}`;
        fallbackCursor += 1;
        item = {
          start_time: formatTime(clock),
          end_time: formatTime(clock + 150),
          title,
          item_type: 'activity',
          location,
          duration_minutes: 150,
        };
        clock += 150 + config.gapMinutes;
      }

      items.push(item);

      // Lunch after the first block if we have crossed midday.
      if (includeMeals && slot === 0 && clock >= toMinutes(12)) {
        items.push({
          start_time: formatTime(clock),
          end_time: formatTime(clock + 75),
          title: 'Lunch — local spot away from the main square',
          item_type: 'meal',
          location,
          duration_minutes: 75,
          cost_cents: Math.round((destination.avg_daily_cost_usd ?? 120) * 0.15 * 100),
        });
        clock += 75 + 15;
      }
    }

    if (includeMeals) {
      const dinnerStart = Math.max(clock, toMinutes(19));
      items.push({
        start_time: formatTime(dinnerStart),
        end_time: formatTime(dinnerStart + 105),
        title: romanticFocus
          ? 'Dinner — book the table with the view'
          : 'Dinner in the old town',
        item_type: 'meal',
        location,
        duration_minutes: 105,
        cost_cents: Math.round((destination.avg_daily_cost_usd ?? 120) * 0.25 * 100),
      });
    }

    if (isLast) {
      items.push({
        start_time: formatTime(toMinutes(16)),
        title: 'Check-out, last-minute gifts & transfer',
        item_type: 'transport',
        location,
        description: 'Leave three hours before an international departure.',
        duration_minutes: 180,
      });
    }

    const dayDate = options.startDate ? addDays(options.startDate, dayIndex) : null;
    result.push({
      day_number: dayNumber,
      day_date: dayDate,
      title: isFirst
        ? `Arrival in ${location}`
        : isLast
          ? `Last morning in ${location}`
          : `Day ${dayNumber} in ${location}`,
      summary: summarise(items, pace),
      items: items.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    });
  }

  return result;
}

function summarise(items: GeneratedItem[], pace: Pace) {
  const activities = items.filter((i) => i.item_type === 'activity').map((i) => i.title);
  if (!activities.length) return 'A free day — keep it open.';
  const paceWord = pace === 'relaxed' ? 'A slow day' : pace === 'packed' ? 'A full day' : 'A steady day';
  return `${paceWord}: ${activities.slice(0, 3).join(', ')}${activities.length > 3 ? ' and more' : ''}.`;
}

export function estimateCost(days: GeneratedDay[]) {
  return days.reduce(
    (total, day) => total + day.items.reduce((sum, item) => sum + (item.cost_cents ?? 0), 0),
    0
  );
}

export const INTEREST_OPTIONS = [
  { value: 'romance', label: 'Romance', emoji: '💕' },
  { value: 'culture', label: 'Culture & history', emoji: '🏛️' },
  { value: 'food', label: 'Food & wine', emoji: '🍷' },
  { value: 'nature', label: 'Nature', emoji: '🌿' },
  { value: 'adventure', label: 'Adventure', emoji: '🧗' },
  { value: 'nightlife', label: 'Nightlife', emoji: '🌃' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'relaxation', label: 'Relaxation', emoji: '🧘' },
];
