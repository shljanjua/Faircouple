-- ============================================================================
-- FairCouples — 0001_schema.sql
-- Core schema: extensions, helper functions, tables, indexes, triggers.
-- Target: PostgreSQL 15+ / Supabase.
-- Run order: 0001_schema -> 0002_rls -> 0003_seed -> 0004_storage
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- 1. ACCOUNTS & IDENTITY
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               citext not null unique,
  full_name           text,
  display_name        text,
  avatar_url          text,
  phone               text,
  bio                 text,
  date_of_birth       date,
  gender              text check (gender in ('male','female','non_binary','prefer_not_to_say')),
  role                text not null default 'user' check (role in ('user','moderator','admin','superadmin')),
  status              text not null default 'active' check (status in ('active','suspended','banned','pending_deletion')),
  currency            text not null default 'USD' check (char_length(currency) = 3),
  country_code        text,
  locale              text not null default 'en',
  timezone            text not null default 'UTC',
  marketing_opt_in    boolean not null default false,
  email_verified_at   timestamptz,
  onboarded_at        timestamptz,
  last_seen_at        timestamptz,
  last_login_ip       text,
  login_count         integer not null default 0,
  referral_code       text unique,
  referred_by         uuid references public.profiles(id) on delete set null,
  notification_prefs  jsonb not null default '{"email":true,"push":true,"weekly_report":true,"partner_activity":true}'::jsonb,
  metadata            jsonb not null default '{}'::jsonb,
  suspended_reason    text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_status_idx on public.profiles(status);
create index if not exists profiles_country_idx on public.profiles(country_code);
create index if not exists profiles_created_idx on public.profiles(created_at desc);

-- ---------------------------------------------------------------------------
-- 2. COUPLES / RELATIONSHIP SPACES
--    A "couple" is any 2-person relationship space: partners, spouses,
--    mother & son, siblings, friends. Both members log their own entries.
-- ---------------------------------------------------------------------------

create table if not exists public.couples (
  id                  uuid primary key default gen_random_uuid(),
  name                text,
  relationship_type   text not null default 'romantic'
                      check (relationship_type in ('romantic','engaged','married','long_distance',
                                                   'parent_child','siblings','friends','family','other')),
  status              text not null default 'active' check (status in ('pending','active','paused','archived','separated')),
  anniversary_date    date,
  invite_code         text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  owner_id            uuid not null references public.profiles(id) on delete cascade,
  timezone            text not null default 'UTC',
  currency            text not null default 'USD',
  avatar_url          text,
  fairness_weighting  text not null default 'equal' check (fairness_weighting in ('equal','income_based','custom')),
  settings            jsonb not null default '{}'::jsonb,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists couples_owner_idx on public.couples(owner_id);
create index if not exists couples_status_idx on public.couples(status);

create table if not exists public.couple_members (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  member_role   text not null default 'partner' check (member_role in ('owner','partner')),
  display_role  text,                       -- "Partner A", "Mother", "Son", "Husband"...
  color         text default '#e11d48',
  income_share  numeric(5,2),               -- % used when fairness_weighting = income_based
  joined_at     timestamptz not null default now(),
  removed_at    timestamptz,
  removed_by    uuid references public.profiles(id) on delete set null,
  unique (couple_id, user_id)
);

create index if not exists couple_members_user_idx on public.couple_members(user_id) where removed_at is null;
create index if not exists couple_members_couple_idx on public.couple_members(couple_id) where removed_at is null;

create table if not exists public.couple_invitations (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  email        citext not null,
  token        text not null unique default encode(gen_random_bytes(24),'hex'),
  invited_by   uuid not null references public.profiles(id) on delete cascade,
  display_role text,
  message      text,
  status       text not null default 'pending' check (status in ('pending','accepted','declined','revoked','expired')),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists couple_invitations_email_idx on public.couple_invitations(email);
create index if not exists couple_invitations_couple_idx on public.couple_invitations(couple_id);

-- ---------------------------------------------------------------------------
-- 3. BILLING — PLANS, PRICES, SUBSCRIPTIONS, PAYMENTS
-- ---------------------------------------------------------------------------

create table if not exists public.plans (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  tagline           text,
  description       text,
  tier              integer not null default 0,
  is_active         boolean not null default true,
  is_featured       boolean not null default false,
  is_free           boolean not null default false,
  trial_days        integer not null default 0,
  sort_order        integer not null default 0,
  badge             text,
  features          jsonb not null default '[]'::jsonb,   -- ["Unlimited emotions", ...]
  limits            jsonb not null default '{}'::jsonb,   -- see lib/plan-limits.ts
  stripe_product_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.plan_prices (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.plans(id) on delete cascade,
  currency        text not null check (char_length(currency) = 3),
  interval        text not null check (interval in ('month','year','lifetime')),
  amount_cents    integer not null check (amount_cents >= 0),
  compare_at_cents integer,
  stripe_price_id text,
  paypal_plan_id  text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (plan_id, currency, interval)
);

create index if not exists plan_prices_lookup_idx on public.plan_prices(currency, interval) where is_active;

create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  couple_id               uuid references public.couples(id) on delete set null,
  plan_id                 uuid not null references public.plans(id) on delete restrict,
  price_id                uuid references public.plan_prices(id) on delete set null,
  provider                text not null default 'stripe' check (provider in ('stripe','paypal','manual','free')),
  provider_customer_id    text,
  provider_subscription_id text,
  status                  text not null default 'incomplete'
                          check (status in ('incomplete','trialing','active','past_due','canceled','unpaid','paused','expired')),
  currency                text not null default 'USD',
  interval                text not null default 'month',
  amount_cents            integer not null default 0,
  seats                   integer not null default 2,
  quantity                integer not null default 1,
  trial_ends_at           timestamptz,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  canceled_at             timestamptz,
  ended_at               timestamptz,
  coupon_code             text,
  notes                   text,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists subscriptions_provider_sub_idx
  on public.subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists subscriptions_couple_idx on public.subscriptions(couple_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,
  subscription_id     uuid references public.subscriptions(id) on delete set null,
  provider            text not null check (provider in ('stripe','paypal','manual')),
  provider_payment_id text,
  provider_invoice_id text,
  amount_cents        integer not null,
  currency            text not null,
  status              text not null default 'pending'
                      check (status in ('pending','succeeded','failed','refunded','partially_refunded','disputed')),
  description         text,
  receipt_url         text,
  invoice_url         text,
  refunded_cents      integer not null default 0,
  failure_reason      text,
  billing_email       citext,
  billing_country     text,
  metadata            jsonb not null default '{}'::jsonb,
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);

create unique index if not exists payments_provider_payment_idx
  on public.payments(provider, provider_payment_id)
  where provider_payment_id is not null;
create index if not exists payments_user_idx on public.payments(user_id);
create index if not exists payments_created_idx on public.payments(created_at desc);

create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  description      text,
  discount_type    text not null default 'percent' check (discount_type in ('percent','fixed')),
  percent_off      numeric(5,2),
  amount_off_cents integer,
  currency         text,
  duration         text not null default 'once' check (duration in ('once','repeating','forever')),
  duration_months  integer,
  max_redemptions  integer,
  redeemed_count   integer not null default 0,
  applies_to_plans uuid[] default '{}',
  starts_at        timestamptz,
  expires_at       timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  event_id      text not null,
  event_type    text not null,
  payload       jsonb not null,
  status        text not null default 'received' check (status in ('received','processed','failed','ignored')),
  error         text,
  processed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (provider, event_id)
);

create table if not exists public.usage_counters (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid references public.couples(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete cascade,
  metric       text not null,
  period       text not null default to_char(now(),'YYYY-MM'),
  count        integer not null default 0,
  updated_at   timestamptz not null default now(),
  unique (couple_id, user_id, metric, period)
);

-- ---------------------------------------------------------------------------
-- 4. FAIRNESS FRAMEWORK — the 10 core relationship areas
-- ---------------------------------------------------------------------------

create table if not exists public.fairness_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  emoji       text,
  icon        text,
  description text,
  fair_rule   text not null,
  weight      numeric(4,2) not null default 1.0,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  is_dealbreaker boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.fairness_criteria (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.fairness_categories(id) on delete cascade,
  text         text not null,
  help_text    text,
  polarity     text not null default 'positive' check (polarity in ('positive','negative')),
  sort_order   integer not null default 0,
  is_active    boolean not null default true
);

create index if not exists fairness_criteria_category_idx on public.fairness_criteria(category_id);

-- One row per member, per category, per period. Both partners fill their own.
create table if not exists public.fairness_entries (
  id             uuid primary key default gen_random_uuid(),
  couple_id      uuid not null references public.couples(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  about_user_id  uuid references public.profiles(id) on delete set null, -- partner being rated
  category_id    uuid not null references public.fairness_categories(id) on delete cascade,
  period         date not null default date_trunc('week', now())::date,
  self_score     integer check (self_score between 0 and 10),      -- how well I did
  partner_score  integer check (partner_score between 0 and 10),   -- how well my partner did
  effort_self    integer check (effort_self between 0 and 100),
  effort_partner integer check (effort_partner between 0 and 100),
  respect_score  integer check (respect_score between 0 and 10),
  loyalty_score  integer check (loyalty_score between 0 and 10),
  satisfaction   integer check (satisfaction between 0 and 10),
  note           text,
  partner_note   text,
  is_private     boolean not null default false,   -- private = hidden from partner, visible in your own reports
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (couple_id, user_id, category_id, period)
);

create index if not exists fairness_entries_couple_period_idx on public.fairness_entries(couple_id, period desc);
create index if not exists fairness_entries_user_idx on public.fairness_entries(user_id);

create table if not exists public.fairness_criteria_responses (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references public.fairness_entries(id) on delete cascade,
  criterion_id  uuid not null references public.fairness_criteria(id) on delete cascade,
  self_value    integer check (self_value between 0 and 4),     -- 0 never .. 4 always
  partner_value integer check (partner_value between 0 and 4),
  note          text,
  unique (entry_id, criterion_id)
);

-- Snapshot of computed fairness for a couple/period (generated by the app).
create table if not exists public.fairness_reports (
  id                uuid primary key default gen_random_uuid(),
  couple_id         uuid not null references public.couples(id) on delete cascade,
  period            date not null,
  period_type       text not null default 'week' check (period_type in ('week','month','quarter','year')),
  overall_score     numeric(5,2),
  balance_index     numeric(5,2),        -- 100 = perfectly balanced effort
  effort_a          numeric(5,2),
  effort_b          numeric(5,2),
  respect_delta     numeric(5,2),
  loyalty_delta     numeric(5,2),
  verdict           text,
  risk_level        text check (risk_level in ('healthy','watch','strained','critical')),
  breakdown         jsonb not null default '{}'::jsonb,
  insights          jsonb not null default '[]'::jsonb,
  generated_at      timestamptz not null default now(),
  unique (couple_id, period, period_type)
);

-- ---------------------------------------------------------------------------
-- 5. EMOTIONS
-- ---------------------------------------------------------------------------

create table if not exists public.emotion_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  emoji       text not null,
  valence     text not null check (valence in ('positive','neutral','negative')),
  category    text not null default 'general',
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

create table if not exists public.emotion_logs (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid references public.couples(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  about_user_id uuid references public.profiles(id) on delete set null,  -- emotion ABOUT my partner
  scope         text not null default 'self' check (scope in ('self','partner','relationship')),
  emotion_slug  text not null,
  intensity     integer not null default 5 check (intensity between 1 and 10),
  mood_score    integer check (mood_score between 1 and 10),
  energy        integer check (energy between 1 and 10),
  trigger       text,
  need          text,          -- "what I need right now"
  note          text,
  tags          text[] not null default '{}',
  is_private    boolean not null default false,
  shared_at     timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  logged_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists emotion_logs_couple_idx on public.emotion_logs(couple_id, logged_at desc);
create index if not exists emotion_logs_user_idx on public.emotion_logs(user_id, logged_at desc);

create table if not exists public.daily_checkins (
  id             uuid primary key default gen_random_uuid(),
  couple_id      uuid not null references public.couples(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  checkin_date   date not null default current_date,
  day_rating     integer check (day_rating between 1 and 10),
  connection     integer check (connection between 1 and 10),
  gratitude      text,
  highlight      text,
  challenge      text,
  need_from_partner text,
  answered_prompt text,
  created_at     timestamptz not null default now(),
  unique (couple_id, user_id, checkin_date)
);

-- Love vs Attraction assessment
create table if not exists public.assessments (
  id             uuid primary key default gen_random_uuid(),
  couple_id      uuid references public.couples(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  kind           text not null default 'love_vs_attraction'
                 check (kind in ('love_vs_attraction','compatibility','love_language','conflict_style','attachment')),
  answers        jsonb not null default '{}'::jsonb,
  love_score     numeric(5,2),
  attraction_score numeric(5,2),
  compatibility_score numeric(5,2),
  result_key     text,
  verdict        text,
  summary        text,
  details        jsonb not null default '{}'::jsonb,
  taken_at       timestamptz not null default now()
);

create index if not exists assessments_user_idx on public.assessments(user_id, taken_at desc);

create table if not exists public.compatibility_scores (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples(id) on delete cascade,
  period          date not null default current_date,
  overall         numeric(5,2) not null default 0,
  emotional       numeric(5,2),
  communication   numeric(5,2),
  trust           numeric(5,2),
  financial       numeric(5,2),
  intimacy        numeric(5,2),
  lifestyle       numeric(5,2),
  future_goals    numeric(5,2),
  conflict        numeric(5,2),
  love_index      numeric(5,2),
  attraction_index numeric(5,2),
  verdict         text,
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (couple_id, period)
);

-- Relationship cycle: attraction -> communication -> trust -> conflict -> bonding -> stability
create table if not exists public.cycle_stages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  emoji       text,
  description text,
  sort_order  integer not null default 0
);

create table if not exists public.couple_cycle_progress (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  stage_id    uuid not null references public.cycle_stages(id) on delete cascade,
  strength    integer not null default 0 check (strength between 0 and 100),
  status      text not null default 'not_started' check (status in ('not_started','in_progress','strong','weak')),
  notes       text,
  updated_at  timestamptz not null default now(),
  unique (couple_id, stage_id)
);

-- ---------------------------------------------------------------------------
-- 6. CHECKLISTS (relationship, travel gear, honeymoon, anything)
-- ---------------------------------------------------------------------------

create table if not exists public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  category    text not null default 'relationship'
              check (category in ('relationship','travel','packing','honeymoon','wedding','finance','baby','moving','date_night','other')),
  emoji       text,
  climate     text,
  trip_type   text,
  is_public   boolean not null default true,
  is_premium  boolean not null default false,
  items       jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.checklists (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  trip_id      uuid,
  template_id  uuid references public.checklist_templates(id) on delete set null,
  title        text not null,
  description  text,
  category     text not null default 'relationship',
  emoji        text,
  due_date     date,
  is_shared    boolean not null default true,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists checklists_couple_idx on public.checklists(couple_id);

create table if not exists public.checklist_items (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references public.checklists(id) on delete cascade,
  title         text not null,
  note          text,
  category      text,
  quantity      integer not null default 1,
  assigned_to   uuid references public.profiles(id) on delete set null,
  due_date      date,
  priority      text not null default 'normal' check (priority in ('low','normal','high','critical')),
  is_done       boolean not null default false,
  done_by       uuid references public.profiles(id) on delete set null,
  done_at       timestamptz,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists checklist_items_list_idx on public.checklist_items(checklist_id, sort_order);

-- ---------------------------------------------------------------------------
-- 7. PRIVATE MESSAGING
-- ---------------------------------------------------------------------------

create table if not exists public.conversations (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  title        text,
  kind         text not null default 'direct' check (kind in ('direct','notes','support')),
  last_message_at timestamptz,
  last_message_preview text,
  created_at   timestamptz not null default now(),
  unique (couple_id, kind)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  couple_id       uuid not null references public.couples(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text,
  message_type    text not null default 'text'
                  check (message_type in ('text','image','file','sticker','voice','system','emotion','gift')),
  attachment_path text,
  attachment_name text,
  attachment_size integer,
  attachment_mime text,
  reply_to        uuid references public.messages(id) on delete set null,
  reactions       jsonb not null default '{}'::jsonb,
  is_edited       boolean not null default false,
  edited_at       timestamptz,
  read_at         timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at desc);
create index if not exists messages_couple_idx on public.messages(couple_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 8. MEDIA, DOCUMENTS & TICKET VAULT
-- ---------------------------------------------------------------------------

create table if not exists public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid references public.couples(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  bucket        text not null default 'couple-media',
  path          text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint not null default 0,
  width         integer,
  height        integer,
  kind          text not null default 'photo' check (kind in ('photo','video','document','ticket','avatar','other')),
  album         text,
  caption       text,
  is_private    boolean not null default false,
  is_favorite   boolean not null default false,
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists media_couple_idx on public.media_assets(couple_id, created_at desc);

-- Uploaded bookings: flight tickets, hotel confirmations, attraction tickets, visas…
create table if not exists public.travel_documents (
  id                 uuid primary key default gen_random_uuid(),
  couple_id          uuid not null references public.couples(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  trip_id            uuid,
  doc_type           text not null default 'other'
                     check (doc_type in ('flight','hotel','train','bus','car_rental','cruise','attraction',
                                         'restaurant','insurance','visa','passport','vaccination','other')),
  title              text not null,
  provider           text,
  confirmation_code  text,
  booking_reference  text,
  passenger_names    text,
  origin             text,
  destination        text,
  depart_at          timestamptz,
  arrive_at          timestamptz,
  check_in           date,
  check_out          date,
  seat               text,
  gate               text,
  terminal           text,
  amount_cents       integer,
  currency           text,
  expires_at         date,
  file_path          text,
  file_name          text,
  file_mime          text,
  file_size          bigint,
  notes              text,
  is_shared          boolean not null default true,
  reminder_sent_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists travel_documents_couple_idx on public.travel_documents(couple_id, depart_at);
create index if not exists travel_documents_trip_idx on public.travel_documents(trip_id);

-- ---------------------------------------------------------------------------
-- 9. MONEY — BUDGETS, EXPENSES, FAIR SPLIT, GIFTS
-- ---------------------------------------------------------------------------

create table if not exists public.incomes (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  label      text not null default 'Primary income',
  amount_cents integer not null default 0,
  currency   text not null default 'USD',
  frequency  text not null default 'month' check (frequency in ('week','month','year')),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  trip_id       uuid,
  name          text not null,
  budget_type   text not null default 'household' check (budget_type in ('household','trip','event','gift','custom')),
  currency      text not null default 'USD',
  total_cents   integer not null default 0,
  period_start  date,
  period_end    date,
  split_type    text not null default 'equal' check (split_type in ('equal','income','custom','percent')),
  split_details jsonb not null default '{}'::jsonb,
  color         text default '#e11d48',
  notes         text,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists budgets_couple_idx on public.budgets(couple_id);

create table if not exists public.budget_categories (
  id            uuid primary key default gen_random_uuid(),
  budget_id     uuid not null references public.budgets(id) on delete cascade,
  name          text not null,
  emoji         text,
  planned_cents integer not null default 0,
  color         text,
  sort_order    integer not null default 0
);

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  budget_id     uuid references public.budgets(id) on delete set null,
  category_id   uuid references public.budget_categories(id) on delete set null,
  trip_id       uuid,
  paid_by       uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  description   text,
  category      text not null default 'other',
  amount_cents  integer not null,
  currency      text not null default 'USD',
  fx_rate       numeric(14,6) not null default 1,
  spent_on      date not null default current_date,
  split_type    text not null default 'equal' check (split_type in ('equal','income','custom','percent','none')),
  split_details jsonb not null default '{}'::jsonb,
  receipt_path  text,
  is_recurring  boolean not null default false,
  recurrence    text,
  is_settled    boolean not null default false,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists expenses_couple_date_idx on public.expenses(couple_id, spent_on desc);
create index if not exists expenses_budget_idx on public.expenses(budget_id);

create table if not exists public.expense_shares (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  share_cents  integer not null default 0,
  is_settled   boolean not null default false,
  settled_at   timestamptz,
  unique (expense_id, user_id)
);

create table if not exists public.settlements (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  from_user    uuid not null references public.profiles(id) on delete cascade,
  to_user      uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null,
  currency     text not null default 'USD',
  method       text,
  note         text,
  settled_on   date not null default current_date,
  created_at   timestamptz not null default now()
);

create table if not exists public.gifts (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  from_user     uuid references public.profiles(id) on delete set null,
  to_user       uuid references public.profiles(id) on delete set null,
  title         text not null,
  description   text,
  occasion      text not null default 'other'
                check (occasion in ('birthday','anniversary','valentines','christmas','wedding','engagement',
                                    'mothers_day','fathers_day','just_because','apology','other')),
  status        text not null default 'idea' check (status in ('idea','planned','purchased','wrapped','given','received')),
  amount_cents  integer,
  currency      text default 'USD',
  url           text,
  image_path    text,
  store         text,
  occasion_date date,
  given_at      date,
  is_surprise   boolean not null default true,  -- hidden from recipient until given
  rating        integer check (rating between 1 and 5),
  reaction      text,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists gifts_couple_idx on public.gifts(couple_id, occasion_date);

create table if not exists public.wishlist_items (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  description  text,
  url          text,
  image_path   text,
  price_cents  integer,
  currency     text default 'USD',
  priority     text not null default 'normal' check (priority in ('low','normal','high','dream')),
  is_reserved  boolean not null default false,
  reserved_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. TRAVEL — COUNTRIES, DESTINATIONS, ATTRACTIONS, TRIPS, ITINERARIES
-- ---------------------------------------------------------------------------

create table if not exists public.countries (
  code            text primary key,          -- ISO-3166 alpha-2
  code3           text,
  name            text not null,
  slug            text not null unique,
  region          text,                      -- Western Europe, North America...
  continent       text,
  capital         text,
  currency_code   text,
  currency_symbol text,
  languages       text[],
  flag_emoji      text,
  phone_code      text,
  timezone        text,
  is_schengen     boolean not null default false,
  is_tier1        boolean not null default false,
  visa_note       text,
  best_season     text,
  safety_rating   numeric(3,1),
  avg_daily_cost_usd integer,
  hero_image      text,
  summary         text,
  description     text,
  meta_title      text,
  meta_description text,
  is_featured     boolean not null default false,
  is_active       boolean not null default true,
  sort_order      integer not null default 0
);

create index if not exists countries_region_idx on public.countries(region);

create table if not exists public.destinations (
  id                 uuid primary key default gen_random_uuid(),
  country_code       text not null references public.countries(code) on delete cascade,
  name               text not null,
  slug               text not null unique,
  city               text,
  state_region       text,
  destination_type   text not null default 'city'
                     check (destination_type in ('city','beach','mountain','island','countryside','desert','lake','historic','ski','safari','cruise')),
  summary            text,
  description        text,
  hero_image         text,
  gallery            text[] not null default '{}',
  latitude           numeric(9,6),
  longitude          numeric(9,6),
  best_months        text[],
  avg_daily_cost_usd integer,
  honeymoon_score    integer check (honeymoon_score between 0 and 100),
  romance_score      integer check (romance_score between 0 and 100),
  budget_level       text check (budget_level in ('budget','moderate','premium','luxury')),
  ideal_days         integer,
  rating             numeric(3,2) default 4.5,
  review_count       integer not null default 0,
  popularity         integer not null default 0,
  tags               text[] not null default '{}',
  highlights         text[] not null default '{}',
  is_honeymoon       boolean not null default false,
  is_featured        boolean not null default false,
  is_active          boolean not null default true,
  meta_title         text,
  meta_description   text,
  keywords           text[],
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists destinations_country_idx on public.destinations(country_code);
create index if not exists destinations_honeymoon_idx on public.destinations(is_honeymoon) where is_active;
create index if not exists destinations_popularity_idx on public.destinations(popularity desc);

create table if not exists public.attractions (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid not null references public.destinations(id) on delete cascade,
  name            text not null,
  slug            text not null,
  category        text not null default 'sightseeing'
                  check (category in ('sightseeing','museum','nature','adventure','food','nightlife','shopping','romantic','beach','religious','family')),
  description     text,
  image           text,
  address         text,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  ticket_price_usd numeric(10,2),
  duration_minutes integer,
  best_time       text,
  rating          numeric(3,2) default 4.5,
  is_must_see     boolean not null default false,
  is_romantic     boolean not null default false,
  booking_url     text,
  sort_order      integer not null default 0,
  unique (destination_id, slug)
);

create table if not exists public.trips (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples(id) on delete cascade,
  destination_id  uuid references public.destinations(id) on delete set null,
  country_code    text references public.countries(code) on delete set null,
  title           text not null,
  slug            text,
  trip_type       text not null default 'vacation'
                  check (trip_type in ('honeymoon','vacation','weekend','anniversary','business','family','adventure','roadtrip')),
  status          text not null default 'planning'
                  check (status in ('idea','planning','booked','ongoing','completed','cancelled')),
  start_date      date,
  end_date        date,
  travelers       integer not null default 2,
  budget_cents    integer,
  spent_cents     integer not null default 0,
  currency        text not null default 'USD',
  cover_image     text,
  notes           text,
  rating          integer check (rating between 1 and 5),
  created_by      uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists trips_couple_idx on public.trips(couple_id, start_date desc);

create table if not exists public.itineraries (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  couple_id    uuid not null references public.couples(id) on delete cascade,
  title        text not null default 'Main itinerary',
  pace         text not null default 'balanced' check (pace in ('relaxed','balanced','packed')),
  interests    text[] not null default '{}',
  generated_by text not null default 'manual' check (generated_by in ('manual','generator','template')),
  total_cost_cents integer not null default 0,
  currency     text not null default 'USD',
  is_primary   boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.itinerary_days (
  id            uuid primary key default gen_random_uuid(),
  itinerary_id  uuid not null references public.itineraries(id) on delete cascade,
  day_number    integer not null,
  day_date      date,
  title         text,
  summary       text,
  created_at    timestamptz not null default now(),
  unique (itinerary_id, day_number)
);

create table if not exists public.itinerary_items (
  id             uuid primary key default gen_random_uuid(),
  day_id         uuid not null references public.itinerary_days(id) on delete cascade,
  attraction_id  uuid references public.attractions(id) on delete set null,
  start_time     time,
  end_time       time,
  title          text not null,
  item_type      text not null default 'activity'
                 check (item_type in ('activity','meal','transport','hotel','flight','rest','shopping','free_time')),
  location       text,
  description    text,
  duration_minutes integer,
  cost_cents     integer,
  currency       text default 'USD',
  booking_url    text,
  document_id    uuid references public.travel_documents(id) on delete set null,
  is_booked      boolean not null default false,
  is_done        boolean not null default false,
  sort_order     integer not null default 0,
  notes          text
);

create index if not exists itinerary_items_day_idx on public.itinerary_items(day_id, sort_order);

create table if not exists public.packing_lists (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid references public.trips(id) on delete cascade,
  couple_id    uuid not null references public.couples(id) on delete cascade,
  name         text not null default 'Packing list',
  template_id  uuid references public.checklist_templates(id) on delete set null,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists public.packing_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.packing_lists(id) on delete cascade,
  name         text not null,
  category     text not null default 'general',
  quantity     integer not null default 1,
  assigned_to  uuid references public.profiles(id) on delete set null,
  is_packed    boolean not null default false,
  packed_by    uuid references public.profiles(id) on delete set null,
  packed_at    timestamptz,
  is_essential boolean not null default false,
  notes        text,
  sort_order   integer not null default 0
);

create index if not exists packing_items_list_idx on public.packing_items(list_id, sort_order);

-- Deferred FKs for trip_id columns declared before trips existed
alter table public.checklists
  drop constraint if exists checklists_trip_id_fkey,
  add constraint checklists_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete set null;
alter table public.travel_documents
  drop constraint if exists travel_documents_trip_id_fkey,
  add constraint travel_documents_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete set null;
alter table public.budgets
  drop constraint if exists budgets_trip_id_fkey,
  add constraint budgets_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete set null;
alter table public.expenses
  drop constraint if exists expenses_trip_id_fkey,
  add constraint expenses_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 11. CMS — BLOG, PAGES, SEO, FAQ, TESTIMONIALS
-- ---------------------------------------------------------------------------

create table if not exists public.blog_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  meta_title  text,
  meta_description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

create table if not exists public.blog_posts (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  excerpt        text,
  content        text,
  cover_image    text,
  category_id    uuid references public.blog_categories(id) on delete set null,
  author_id      uuid references public.profiles(id) on delete set null,
  author_name    text,
  status         text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  is_featured    boolean not null default false,
  reading_minutes integer not null default 5,
  view_count     integer not null default 0,
  tags           text[] not null default '{}',
  keywords       text[] not null default '{}',
  meta_title     text,
  meta_description text,
  canonical_url  text,
  og_image       text,
  schema_type    text not null default 'BlogPosting',
  no_index       boolean not null default false,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists blog_posts_status_idx on public.blog_posts(status, published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts(category_id);

create table if not exists public.pages (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  content        text,
  page_type      text not null default 'legal' check (page_type in ('legal','marketing','support','custom')),
  status         text not null default 'published' check (status in ('draft','published','archived')),
  show_in_footer boolean not null default true,
  show_in_header boolean not null default false,
  meta_title     text,
  meta_description text,
  keywords       text[] not null default '{}',
  canonical_url  text,
  no_index       boolean not null default false,
  sort_order     integer not null default 0,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create table if not exists public.seo_meta (
  id              uuid primary key default gen_random_uuid(),
  path            text not null unique,
  title           text,
  description     text,
  keywords        text[] not null default '{}',
  og_title        text,
  og_description  text,
  og_image        text,
  twitter_card    text default 'summary_large_image',
  canonical_url   text,
  robots          text default 'index,follow',
  priority        numeric(2,1) default 0.7,
  changefreq      text default 'weekly',
  json_ld         jsonb,
  updated_at      timestamptz not null default now()
);

create table if not exists public.redirects (
  id          uuid primary key default gen_random_uuid(),
  source      text not null unique,
  destination text not null,
  status_code integer not null default 301 check (status_code in (301,302,307,308)),
  is_active   boolean not null default true,
  hits        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  category    text not null default 'general',
  page_path   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  author_location text,
  avatar_url  text,
  quote       text not null,
  rating      integer not null default 5 check (rating between 1 and 5),
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 12. PLATFORM SETTINGS, EMAIL, INTEGRATIONS, AUDIT
-- ---------------------------------------------------------------------------

create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  group_name  text not null default 'general',
  label       text,
  description text,
  is_public   boolean not null default false,   -- public settings are readable by anon
  is_secret   boolean not null default false,   -- never sent to the browser
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

create index if not exists site_settings_group_idx on public.site_settings(group_name);

create table if not exists public.payment_gateways (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null unique check (provider in ('stripe','paypal','manual')),
  display_name   text not null,
  is_enabled     boolean not null default false,
  mode           text not null default 'test' check (mode in ('test','live')),
  credentials    jsonb not null default '{}'::jsonb,
  supported_currencies text[] not null default '{USD,GBP,EUR,CAD,AUD}',
  sort_order     integer not null default 0,
  instructions   text,
  updated_at     timestamptz not null default now()
);

create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  subject     text not null,
  html_body   text not null,
  text_body   text,
  description text,
  variables   text[] not null default '{}',
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists public.email_logs (
  id           uuid primary key default gen_random_uuid(),
  to_email     citext not null,
  from_email   citext,
  subject      text,
  template_slug text,
  status       text not null default 'queued' check (status in ('queued','sent','failed','bounced')),
  error        text,
  provider     text default 'smtp',
  user_id      uuid references public.profiles(id) on delete set null,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists email_logs_created_idx on public.email_logs(created_at desc);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  couple_id   uuid references public.couples(id) on delete cascade,
  type        text not null default 'system',
  title       text not null,
  body        text,
  link        text,
  emoji       text,
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc) where is_read = false;

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_email citext,
  action      text not null,
  entity_type text,
  entity_id   text,
  summary     text,
  changes     jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       citext not null,
  subject     text,
  message     text not null,
  category    text default 'general',
  status      text not null default 'new' check (status in ('new','read','replied','closed','spam')),
  replied_at  timestamptz,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id             uuid primary key default gen_random_uuid(),
  email          citext not null unique,
  name           text,
  status         text not null default 'subscribed' check (status in ('subscribed','unsubscribed','bounced')),
  source         text,
  country_code   text,
  confirmed_at   timestamptz,
  unsubscribed_at timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key         text primary key,
  name        text not null,
  description text,
  is_enabled  boolean not null default false,
  rollout_pct integer not null default 100 check (rollout_pct between 0 and 100),
  updated_at  timestamptz not null default now()
);

create table if not exists public.exchange_rates (
  base_currency   text not null,
  quote_currency  text not null,
  rate            numeric(18,8) not null,
  updated_at      timestamptz not null default now(),
  primary key (base_currency, quote_currency)
);

-- ---------------------------------------------------------------------------
-- 13. FUNCTIONS & TRIGGERS
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','couples','plans','subscriptions','fairness_entries','checklists',
    'travel_documents','budgets','expenses','gifts','trips','itineraries','blog_posts',
    'pages','incomes','couple_cycle_progress'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; '
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- Create a profile automatically whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_currency text;
  v_country  text;
  v_name     text;
begin
  v_currency := coalesce(new.raw_user_meta_data->>'currency', 'USD');
  v_country  := coalesce(new.raw_user_meta_data->>'country_code', null);
  v_name     := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, email, full_name, display_name, currency, country_code,
                               locale, timezone, marketing_opt_in, referral_code, email_verified_at)
  values (
    new.id,
    new.email,
    v_name,
    coalesce(new.raw_user_meta_data->>'display_name', v_name),
    upper(v_currency),
    upper(v_country),
    coalesce(new.raw_user_meta_data->>'locale', 'en'),
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC'),
    coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    new.email_confirmed_at
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email_verified_at in sync with auth confirmation.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email_confirmed_at <> new.email_confirmed_at) then
    update public.profiles
       set email_verified_at = new.email_confirmed_at
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.handle_user_confirmed();

-- Membership / role helpers (security definer to avoid RLS recursion).
create or replace function public.is_platform_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin','superadmin') and status = 'active'
  );
$$;

create or replace function public.is_couple_member(target_couple uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple and user_id = uid and removed_at is null
  );
$$;

create or replace function public.my_couple_ids(uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select couple_id from public.couple_members
  where user_id = uid and removed_at is null;
$$;

create or replace function public.partner_id(target_couple uuid, uid uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.couple_members
  where couple_id = target_couple and user_id <> uid and removed_at is null
  limit 1;
$$;

-- Active subscription lookup for a user (own or partner's — a paid plan covers both).
create or replace function public.active_subscription(uid uuid default auth.uid())
returns table (
  subscription_id uuid,
  plan_slug text,
  plan_name text,
  status text,
  interval text,
  currency text,
  current_period_end timestamptz,
  limits jsonb,
  features jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, p.slug, p.name, s.status, s.interval, s.currency, s.current_period_end, p.limits, p.features
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.status in ('active','trialing')
    and (
      s.user_id = uid
      or s.couple_id in (select couple_id from public.couple_members where user_id = uid and removed_at is null)
    )
  order by p.tier desc, s.current_period_end desc nulls last
  limit 1;
$$;

-- Create a relationship space and enrol the creator as owner.
create or replace function public.create_couple(
  p_name text default null,
  p_relationship_type text default 'romantic',
  p_display_role text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.couples (name, relationship_type, owner_id, currency)
  values (
    coalesce(p_name, 'Our space'),
    p_relationship_type,
    v_user,
    coalesce((select currency from public.profiles where id = v_user), 'USD')
  )
  returning id into v_couple;

  insert into public.couple_members (couple_id, user_id, member_role, display_role)
  values (v_couple, v_user, 'owner', coalesce(p_display_role, 'Partner A'));

  insert into public.conversations (couple_id, kind, title)
  values (v_couple, 'direct', 'Private chat')
  on conflict do nothing;

  return v_couple;
end;
$$;

-- Accept an invitation by token.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.couple_invitations%rowtype;
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_inv from public.couple_invitations
  where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'Invitation is invalid or has expired';
  end if;

  select count(*) into v_count from public.couple_members
  where couple_id = v_inv.couple_id and removed_at is null;

  if v_count >= 2 then
    raise exception 'This relationship space already has two members';
  end if;

  insert into public.couple_members (couple_id, user_id, member_role, display_role)
  values (v_inv.couple_id, v_user, 'partner', coalesce(v_inv.display_role, 'Partner B'))
  on conflict (couple_id, user_id) do update set removed_at = null;

  update public.couple_invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_user
   where id = v_inv.id;

  update public.couples set status = 'active' where id = v_inv.couple_id;

  return v_inv.couple_id;
end;
$$;

-- Increment a metered usage counter and return the new value.
create or replace function public.bump_usage(p_couple uuid, p_metric text, p_amount integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  insert into public.usage_counters (couple_id, user_id, metric, period, count)
  values (p_couple, auth.uid(), p_metric, to_char(now(),'YYYY-MM'), p_amount)
  on conflict (couple_id, user_id, metric, period)
  do update set count = public.usage_counters.count + p_amount, updated_at = now()
  returning count into v_new;
  return v_new;
end;
$$;

-- Fairness computation: balance index + verdict for a couple/period.
create or replace function public.compute_fairness(p_couple uuid, p_period date default date_trunc('week', now())::date)
returns table (
  overall_score numeric,
  balance_index numeric,
  effort_a numeric,
  effort_b numeric,
  member_a uuid,
  member_b uuid,
  risk_level text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_effort_a numeric;
  v_effort_b numeric;
  v_score numeric;
  v_balance numeric;
  v_risk text;
begin
  select user_id into v_a from public.couple_members
   where couple_id = p_couple and removed_at is null order by joined_at asc limit 1;
  select user_id into v_b from public.couple_members
   where couple_id = p_couple and removed_at is null and user_id <> v_a order by joined_at asc limit 1;

  select coalesce(avg(coalesce(effort_self, self_score * 10)), 0) into v_effort_a
    from public.fairness_entries where couple_id = p_couple and user_id = v_a and period = p_period;
  select coalesce(avg(coalesce(effort_self, self_score * 10)), 0) into v_effort_b
    from public.fairness_entries where couple_id = p_couple and user_id = v_b and period = p_period;

  select coalesce(avg((coalesce(self_score,0) + coalesce(partner_score,0)) / 2.0) * 10, 0) into v_score
    from public.fairness_entries where couple_id = p_couple and period = p_period;

  if (v_effort_a + v_effort_b) = 0 then
    v_balance := 0;
  else
    v_balance := 100 - (abs(v_effort_a - v_effort_b) / greatest(v_effort_a + v_effort_b, 1) * 200);
    v_balance := greatest(0, least(100, v_balance));
  end if;

  v_risk := case
    when v_score = 0 then 'watch'
    when v_balance >= 80 and v_score >= 70 then 'healthy'
    when v_balance >= 60 and v_score >= 55 then 'watch'
    when v_balance >= 40 or v_score >= 40 then 'strained'
    else 'critical'
  end;

  return query select round(v_score,2), round(v_balance,2), round(v_effort_a,2), round(v_effort_b,2), v_a, v_b, v_risk;
end;
$$;

-- Public settings view (safe for anonymous consumption).
create or replace view public.public_settings as
  select key, value, group_name from public.site_settings where is_public = true and is_secret = false;

commit;
