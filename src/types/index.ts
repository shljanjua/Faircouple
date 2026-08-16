export type UserRole = 'user' | 'moderator' | 'admin' | 'superadmin';
export type UserStatus = 'active' | 'suspended' | 'banned' | 'pending_deletion';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: string | null;
  role: UserRole;
  status: UserStatus;
  currency: string;
  country_code: string | null;
  locale: string;
  timezone: string;
  marketing_opt_in: boolean;
  email_verified_at: string | null;
  onboarded_at: string | null;
  last_seen_at: string | null;
  login_count: number;
  referral_code: string | null;
  suspended_reason: string | null;
  notification_prefs: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export type RelationshipType =
  | 'romantic'
  | 'engaged'
  | 'married'
  | 'long_distance'
  | 'parent_child'
  | 'siblings'
  | 'friends'
  | 'family'
  | 'other';

export interface Couple {
  id: string;
  name: string | null;
  relationship_type: RelationshipType;
  status: string;
  anniversary_date: string | null;
  invite_code: string;
  owner_id: string;
  timezone: string;
  currency: string;
  avatar_url: string | null;
  fairness_weighting: 'equal' | 'income_based' | 'custom';
  settings: Record<string, unknown>;
  created_at: string;
}

export interface CoupleMember {
  id: string;
  couple_id: string;
  user_id: string;
  member_role: 'owner' | 'partner';
  display_role: string | null;
  color: string | null;
  income_share: number | null;
  joined_at: string;
  removed_at: string | null;
  profile?: Profile;
}

export interface FairnessCategory {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  icon: string | null;
  description: string | null;
  fair_rule: string;
  weight: number;
  sort_order: number;
  is_active: boolean;
  is_dealbreaker: boolean;
  criteria?: FairnessCriterion[];
}

export interface FairnessCriterion {
  id: string;
  category_id: string;
  text: string;
  help_text: string | null;
  polarity: 'positive' | 'negative';
  sort_order: number;
}

export interface FairnessEntry {
  id: string;
  couple_id: string;
  user_id: string;
  about_user_id: string | null;
  category_id: string;
  period: string;
  self_score: number | null;
  partner_score: number | null;
  effort_self: number | null;
  effort_partner: number | null;
  respect_score: number | null;
  loyalty_score: number | null;
  satisfaction: number | null;
  note: string | null;
  partner_note: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmotionType {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  valence: 'positive' | 'neutral' | 'negative';
  category: string;
  sort_order: number;
}

export interface EmotionLog {
  id: string;
  couple_id: string | null;
  user_id: string;
  about_user_id: string | null;
  scope: 'self' | 'partner' | 'relationship';
  emotion_slug: string;
  intensity: number;
  mood_score: number | null;
  energy: number | null;
  trigger: string | null;
  need: string | null;
  note: string | null;
  tags: string[];
  is_private: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  logged_at: string;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  tier: number;
  is_active: boolean;
  is_featured: boolean;
  is_free: boolean;
  trial_days: number;
  sort_order: number;
  badge: string | null;
  features: string[];
  limits: PlanLimits;
  prices?: PlanPrice[];
}

export interface PlanPrice {
  id: string;
  plan_id: string;
  currency: string;
  interval: 'month' | 'year' | 'lifetime';
  amount_cents: number;
  compare_at_cents: number | null;
  stripe_price_id: string | null;
  paypal_plan_id: string | null;
  is_active: boolean;
}

export interface PlanLimits {
  couples: number;
  emotion_logs: number;
  messages: number;
  checklists: number;
  budgets: number;
  trips: number;
  itineraries: number;
  gifts: number;
  documents: number;
  storage_mb: number;
  history_months: number;
  exports: number;
  itinerary_generator: boolean;
  advanced_reports: boolean;
  priority_support: boolean;
  remove_ads: boolean;
  custom_categories: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  couple_id: string | null;
  plan_id: string;
  provider: 'stripe' | 'paypal' | 'manual' | 'free';
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  status: string;
  currency: string;
  interval: string;
  amount_cents: number;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  plan?: Plan;
}

export interface Country {
  code: string;
  name: string;
  slug: string;
  region: string | null;
  continent: string | null;
  capital: string | null;
  currency_code: string | null;
  flag_emoji: string | null;
  is_schengen: boolean;
  is_tier1: boolean;
  best_season: string | null;
  avg_daily_cost_usd: number | null;
  hero_image: string | null;
  summary: string | null;
  description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_featured: boolean;
}

export interface Destination {
  id: string;
  country_code: string;
  name: string;
  slug: string;
  city: string | null;
  destination_type: string;
  summary: string | null;
  description: string | null;
  hero_image: string | null;
  gallery: string[];
  latitude: number | null;
  longitude: number | null;
  best_months: string[];
  avg_daily_cost_usd: number | null;
  honeymoon_score: number | null;
  romance_score: number | null;
  budget_level: string | null;
  ideal_days: number | null;
  rating: number | null;
  popularity: number;
  tags: string[];
  highlights: string[];
  is_honeymoon: boolean;
  is_featured: boolean;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  country?: Country;
  attractions?: Attraction[];
}

export interface Attraction {
  id: string;
  destination_id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  image: string | null;
  ticket_price_usd: number | null;
  duration_minutes: number | null;
  best_time: string | null;
  rating: number | null;
  is_must_see: boolean;
  is_romantic: boolean;
  booking_url: string | null;
}

export interface Trip {
  id: string;
  couple_id: string;
  destination_id: string | null;
  country_code: string | null;
  title: string;
  trip_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  travelers: number;
  budget_cents: number | null;
  spent_cents: number;
  currency: string;
  cover_image: string | null;
  notes: string | null;
  destination?: Destination;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  category_id: string | null;
  author_name: string | null;
  status: string;
  is_featured: boolean;
  reading_minutes: number;
  view_count: number;
  tags: string[];
  keywords: string[];
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  no_index: boolean;
  published_at: string | null;
  category?: { slug: string; name: string } | null;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  page_type: string;
  status: string;
  show_in_footer: boolean;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string[];
  no_index: boolean;
  sort_order: number;
  updated_at: string;
}

export interface SiteSettings {
  [key: string]: unknown;
}

export interface CoupleContext {
  couple: Couple;
  members: CoupleMember[];
  me: CoupleMember;
  partner: CoupleMember | null;
}
