import type { PlanLimits } from '@/types';

export const UNLIMITED = -1;

export const FREE_LIMITS: PlanLimits = {
  couples: 1,
  emotion_logs: 90,
  messages: 200,
  checklists: 1,
  budgets: 1,
  trips: 1,
  itineraries: 1,
  gifts: 5,
  documents: 5,
  storage_mb: 100,
  history_months: 1,
  exports: 0,
  itinerary_generator: false,
  advanced_reports: false,
  priority_support: false,
  remove_ads: false,
  custom_categories: false,
};

export const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  couples: 'Relationship spaces',
  emotion_logs: 'Emotion logs per month',
  messages: 'Messages per month',
  checklists: 'Checklists',
  budgets: 'Budgets',
  trips: 'Trips',
  itineraries: 'Itineraries',
  gifts: 'Gift entries',
  documents: 'Documents in the vault',
  storage_mb: 'Storage (MB)',
  history_months: 'History retained (months)',
  exports: 'Exports per month',
  itinerary_generator: 'Itinerary generator',
  advanced_reports: 'Advanced fairness analytics',
  priority_support: 'Priority support',
  remove_ads: 'Ad-free',
  custom_categories: 'Custom fairness categories',
};

export type LimitKey = keyof PlanLimits;

export function mergeLimits(limits?: Partial<PlanLimits> | null): PlanLimits {
  return { ...FREE_LIMITS, ...(limits ?? {}) };
}

export function isUnlimited(value: number) {
  return value === UNLIMITED;
}

export function limitReached(limits: PlanLimits, key: LimitKey, currentCount: number) {
  const value = limits[key];
  if (typeof value === 'boolean') return !value;
  if (isUnlimited(value)) return false;
  return currentCount >= value;
}

export function remaining(limits: PlanLimits, key: LimitKey, currentCount: number) {
  const value = limits[key];
  if (typeof value === 'boolean') return value ? Infinity : 0;
  if (isUnlimited(value)) return Infinity;
  return Math.max(0, value - currentCount);
}

export function formatLimit(value: number | boolean) {
  if (typeof value === 'boolean') return value ? 'Included' : 'Not included';
  if (isUnlimited(value)) return 'Unlimited';
  return value.toLocaleString();
}

export function hasFeature(limits: PlanLimits, key: LimitKey) {
  const value = limits[key];
  if (typeof value === 'boolean') return value;
  return isUnlimited(value) || value > 0;
}

/** Human-readable upgrade message used by the paywall components. */
export function upgradeMessage(key: LimitKey) {
  const messages: Partial<Record<LimitKey, string>> = {
    couples: 'Your plan includes one relationship space. Upgrade to create more.',
    emotion_logs: 'You have used all of this month’s emotion logs on the free plan.',
    messages: 'You have reached this month’s message limit.',
    checklists: 'Upgrade to create unlimited shared checklists.',
    budgets: 'Upgrade to run multiple budgets side by side.',
    trips: 'Upgrade to plan more than one trip at a time.',
    itineraries: 'Upgrade for unlimited day-by-day itineraries.',
    gifts: 'Upgrade to track unlimited gifts and wishlists.',
    documents: 'Upgrade for a bigger ticket and booking vault.',
    storage_mb: 'You have used all of your storage. Upgrade for more space.',
    exports: 'PDF and CSV exports are available on paid plans.',
    itinerary_generator: 'The itinerary generator is available on Essential and above.',
    advanced_reports: 'Advanced fairness analytics are available on Essential and above.',
    custom_categories: 'Custom fairness categories are a Premium feature.',
  };
  return messages[key] ?? 'This feature is available on a higher plan.';
}
