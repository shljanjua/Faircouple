-- ============================================================================
-- FairCouples — MySQL 8.0 schema (Hostinger / cPanel / phpMyAdmin)
--
-- The application itself runs on Supabase (PostgreSQL) — see
-- supabase/migrations/. This file is the portable MySQL equivalent for
-- teams who prefer Hostinger's MySQL, for reporting replicas, or for
-- migrating later.
--
-- HOW TO USE
--   1. hPanel → Databases → MySQL Databases → create a database and user.
--   2. Open phpMyAdmin → select the database → Import → choose this file.
--      (Or paste it into the SQL tab and press Go.)
--   3. Edit the last block to set your admin email before running.
--
-- Notes on the translation from PostgreSQL:
--   * uuid            → CHAR(36) with UUID() defaults
--   * jsonb           → JSON
--   * text[]          → JSON arrays
--   * citext          → VARCHAR with a case-insensitive collation
--   * Row Level Security has no MySQL equivalent — every query MUST be
--     scoped by couple_id/user_id in application code.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1. ACCOUNTS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  email             VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  password_hash     VARCHAR(255) NULL,
  email_verified_at DATETIME     NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
  id                 CHAR(36)     NOT NULL,
  email              VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  full_name          VARCHAR(160) NULL,
  display_name       VARCHAR(160) NULL,
  avatar_url         TEXT         NULL,
  phone              VARCHAR(40)  NULL,
  bio                TEXT         NULL,
  date_of_birth      DATE         NULL,
  gender             ENUM('male','female','non_binary','prefer_not_to_say') NULL,
  role               ENUM('user','moderator','admin','superadmin') NOT NULL DEFAULT 'user',
  status             ENUM('active','suspended','banned','pending_deletion') NOT NULL DEFAULT 'active',
  currency           CHAR(3)      NOT NULL DEFAULT 'USD',
  country_code       CHAR(2)      NULL,
  locale             VARCHAR(10)  NOT NULL DEFAULT 'en',
  timezone           VARCHAR(64)  NOT NULL DEFAULT 'UTC',
  marketing_opt_in   TINYINT(1)   NOT NULL DEFAULT 0,
  email_verified_at  DATETIME     NULL,
  onboarded_at       DATETIME     NULL,
  last_seen_at       DATETIME     NULL,
  last_login_ip      VARCHAR(64)  NULL,
  login_count        INT          NOT NULL DEFAULT 0,
  referral_code      VARCHAR(20)  NULL,
  referred_by        CHAR(36)     NULL,
  notification_prefs JSON         NULL,
  metadata           JSON         NULL,
  suspended_reason   TEXT         NULL,
  deleted_at         DATETIME     NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY profiles_email_unique (email),
  UNIQUE KEY profiles_referral_unique (referral_code),
  KEY profiles_role_idx (role),
  KEY profiles_status_idx (status),
  KEY profiles_country_idx (country_code),
  CONSTRAINT profiles_user_fk FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 2. RELATIONSHIP SPACES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS couples (
  id                 CHAR(36) NOT NULL DEFAULT (UUID()),
  name               VARCHAR(160) NULL,
  relationship_type  ENUM('romantic','engaged','married','long_distance','parent_child',
                          'siblings','friends','family','other') NOT NULL DEFAULT 'romantic',
  status             ENUM('pending','active','paused','archived','separated') NOT NULL DEFAULT 'active',
  anniversary_date   DATE NULL,
  invite_code        VARCHAR(12) NOT NULL,
  owner_id           CHAR(36) NOT NULL,
  timezone           VARCHAR(64) NOT NULL DEFAULT 'UTC',
  currency           CHAR(3) NOT NULL DEFAULT 'USD',
  avatar_url         TEXT NULL,
  fairness_weighting ENUM('equal','income_based','custom') NOT NULL DEFAULT 'equal',
  settings           JSON NULL,
  archived_at        DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY couples_invite_code_unique (invite_code),
  KEY couples_owner_idx (owner_id),
  CONSTRAINT couples_owner_fk FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS couple_members (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id    CHAR(36) NOT NULL,
  user_id      CHAR(36) NOT NULL,
  member_role  ENUM('owner','partner') NOT NULL DEFAULT 'partner',
  display_role VARCHAR(60) NULL,
  color        VARCHAR(9) NULL,
  income_share DECIMAL(5,2) NULL,
  joined_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at   DATETIME NULL,
  removed_by   CHAR(36) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY couple_members_unique (couple_id, user_id),
  KEY couple_members_user_idx (user_id),
  CONSTRAINT couple_members_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  CONSTRAINT couple_members_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS couple_invitations (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id    CHAR(36) NOT NULL,
  email        VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  token        VARCHAR(64) NOT NULL,
  invited_by   CHAR(36) NOT NULL,
  display_role VARCHAR(60) NULL,
  message      TEXT NULL,
  status       ENUM('pending','accepted','declined','revoked','expired') NOT NULL DEFAULT 'pending',
  expires_at   DATETIME NOT NULL,
  accepted_at  DATETIME NULL,
  accepted_by  CHAR(36) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY couple_invitations_token_unique (token),
  KEY couple_invitations_email_idx (email),
  CONSTRAINT couple_invitations_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 3. BILLING
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS plans (
  id                CHAR(36) NOT NULL DEFAULT (UUID()),
  slug              VARCHAR(60) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  tagline           VARCHAR(200) NULL,
  description       TEXT NULL,
  tier              INT NOT NULL DEFAULT 0,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  is_featured       TINYINT(1) NOT NULL DEFAULT 0,
  is_free           TINYINT(1) NOT NULL DEFAULT 0,
  trial_days        INT NOT NULL DEFAULT 0,
  sort_order        INT NOT NULL DEFAULT 0,
  badge             VARCHAR(60) NULL,
  features          JSON NULL,
  limits            JSON NULL,
  stripe_product_id VARCHAR(120) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY plans_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_prices (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  plan_id          CHAR(36) NOT NULL,
  currency         CHAR(3) NOT NULL,
  billing_interval ENUM('month','year','lifetime') NOT NULL,
  amount_cents     INT NOT NULL,
  compare_at_cents INT NULL,
  stripe_price_id  VARCHAR(120) NULL,
  paypal_plan_id   VARCHAR(120) NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY plan_prices_unique (plan_id, currency, billing_interval),
  CONSTRAINT plan_prices_plan_fk FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       CHAR(36) NOT NULL DEFAULT (UUID()),
  user_id                  CHAR(36) NOT NULL,
  couple_id                CHAR(36) NULL,
  plan_id                  CHAR(36) NOT NULL,
  price_id                 CHAR(36) NULL,
  provider                 ENUM('stripe','paypal','manual','free') NOT NULL DEFAULT 'stripe',
  provider_customer_id     VARCHAR(120) NULL,
  provider_subscription_id VARCHAR(120) NULL,
  status                   ENUM('incomplete','trialing','active','past_due','canceled',
                                'unpaid','paused','expired') NOT NULL DEFAULT 'incomplete',
  currency                 CHAR(3) NOT NULL DEFAULT 'USD',
  billing_interval         VARCHAR(12) NOT NULL DEFAULT 'month',
  amount_cents             INT NOT NULL DEFAULT 0,
  seats                    INT NOT NULL DEFAULT 2,
  trial_ends_at            DATETIME NULL,
  current_period_start     DATETIME NULL,
  current_period_end       DATETIME NULL,
  cancel_at_period_end     TINYINT(1) NOT NULL DEFAULT 0,
  canceled_at              DATETIME NULL,
  ended_at                 DATETIME NULL,
  coupon_code              VARCHAR(60) NULL,
  notes                    TEXT NULL,
  metadata                 JSON NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY subscriptions_provider_unique (provider, provider_subscription_id),
  KEY subscriptions_user_idx (user_id),
  KEY subscriptions_status_idx (status),
  CONSTRAINT subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT subscriptions_plan_fk FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id                  CHAR(36) NOT NULL DEFAULT (UUID()),
  user_id             CHAR(36) NULL,
  subscription_id     CHAR(36) NULL,
  provider            ENUM('stripe','paypal','manual') NOT NULL,
  provider_payment_id VARCHAR(160) NULL,
  provider_invoice_id VARCHAR(160) NULL,
  amount_cents        INT NOT NULL,
  currency            CHAR(3) NOT NULL,
  status              ENUM('pending','succeeded','failed','refunded','partially_refunded','disputed')
                      NOT NULL DEFAULT 'pending',
  description         VARCHAR(255) NULL,
  receipt_url         TEXT NULL,
  invoice_url         TEXT NULL,
  refunded_cents      INT NOT NULL DEFAULT 0,
  failure_reason      VARCHAR(255) NULL,
  billing_email       VARCHAR(255) NULL,
  billing_country     CHAR(2) NULL,
  metadata            JSON NULL,
  paid_at             DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY payments_provider_unique (provider, provider_payment_id),
  KEY payments_user_idx (user_id),
  KEY payments_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupons (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  code             VARCHAR(60) NOT NULL,
  description      VARCHAR(255) NULL,
  discount_type    ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  percent_off      DECIMAL(5,2) NULL,
  amount_off_cents INT NULL,
  currency         CHAR(3) NULL,
  duration         ENUM('once','repeating','forever') NOT NULL DEFAULT 'once',
  duration_months  INT NULL,
  max_redemptions  INT NULL,
  redeemed_count   INT NOT NULL DEFAULT 0,
  starts_at        DATETIME NULL,
  expires_at       DATETIME NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY coupons_code_unique (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS webhook_events (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  provider     VARCHAR(20) NOT NULL,
  event_id     VARCHAR(160) NOT NULL,
  event_type   VARCHAR(120) NOT NULL,
  payload      JSON NOT NULL,
  status       ENUM('received','processed','failed','ignored') NOT NULL DEFAULT 'received',
  error        TEXT NULL,
  processed_at DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY webhook_events_unique (provider, event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 4. FAIRNESS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fairness_categories (
  id             CHAR(36) NOT NULL DEFAULT (UUID()),
  slug           VARCHAR(60) NOT NULL,
  name           VARCHAR(120) NOT NULL,
  emoji          VARCHAR(8) NULL,
  icon           VARCHAR(60) NULL,
  description    TEXT NULL,
  fair_rule      TEXT NOT NULL,
  weight         DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  sort_order     INT NOT NULL DEFAULT 0,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  is_dealbreaker TINYINT(1) NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY fairness_categories_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fairness_criteria (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  category_id CHAR(36) NOT NULL,
  text        TEXT NOT NULL,
  help_text   TEXT NULL,
  polarity    ENUM('positive','negative') NOT NULL DEFAULT 'positive',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY fairness_criteria_category_idx (category_id),
  CONSTRAINT fairness_criteria_category_fk FOREIGN KEY (category_id)
    REFERENCES fairness_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fairness_entries (
  id             CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id      CHAR(36) NOT NULL,
  user_id        CHAR(36) NOT NULL,
  about_user_id  CHAR(36) NULL,
  category_id    CHAR(36) NOT NULL,
  period         DATE NOT NULL,
  self_score     TINYINT NULL,
  partner_score  TINYINT NULL,
  effort_self    TINYINT NULL,
  effort_partner TINYINT NULL,
  respect_score  TINYINT NULL,
  loyalty_score  TINYINT NULL,
  satisfaction   TINYINT NULL,
  note           TEXT NULL,
  partner_note   TEXT NULL,
  is_private     TINYINT(1) NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY fairness_entries_unique (couple_id, user_id, category_id, period),
  KEY fairness_entries_period_idx (couple_id, period),
  CONSTRAINT fairness_entries_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  CONSTRAINT fairness_entries_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fairness_criteria_responses (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  entry_id      CHAR(36) NOT NULL,
  criterion_id  CHAR(36) NOT NULL,
  self_value    TINYINT NULL,
  partner_value TINYINT NULL,
  note          TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY fairness_responses_unique (entry_id, criterion_id),
  CONSTRAINT fairness_responses_entry_fk FOREIGN KEY (entry_id)
    REFERENCES fairness_entries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fairness_reports (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id     CHAR(36) NOT NULL,
  period        DATE NOT NULL,
  period_type   ENUM('week','month','quarter','year') NOT NULL DEFAULT 'week',
  overall_score DECIMAL(5,2) NULL,
  balance_index DECIMAL(5,2) NULL,
  effort_a      DECIMAL(5,2) NULL,
  effort_b      DECIMAL(5,2) NULL,
  respect_delta DECIMAL(5,2) NULL,
  loyalty_delta DECIMAL(5,2) NULL,
  verdict       TEXT NULL,
  risk_level    ENUM('healthy','watch','strained','critical') NULL,
  breakdown     JSON NULL,
  insights      JSON NULL,
  generated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY fairness_reports_unique (couple_id, period, period_type),
  CONSTRAINT fairness_reports_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 5. EMOTIONS & ASSESSMENTS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS emotion_types (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  slug       VARCHAR(60) NOT NULL,
  label      VARCHAR(60) NOT NULL,
  emoji      VARCHAR(8) NOT NULL,
  valence    ENUM('positive','neutral','negative') NOT NULL,
  category   VARCHAR(40) NOT NULL DEFAULT 'general',
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY emotion_types_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS emotion_logs (
  id              CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id       CHAR(36) NULL,
  user_id         CHAR(36) NOT NULL,
  about_user_id   CHAR(36) NULL,
  scope           ENUM('self','partner','relationship') NOT NULL DEFAULT 'self',
  emotion_slug    VARCHAR(60) NOT NULL,
  intensity       TINYINT NOT NULL DEFAULT 5,
  mood_score      TINYINT NULL,
  energy          TINYINT NULL,
  trigger_text    VARCHAR(255) NULL,
  need_text       VARCHAR(255) NULL,
  note            TEXT NULL,
  tags            JSON NULL,
  is_private      TINYINT(1) NOT NULL DEFAULT 0,
  shared_at       DATETIME NULL,
  acknowledged_by CHAR(36) NULL,
  acknowledged_at DATETIME NULL,
  logged_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY emotion_logs_couple_idx (couple_id, logged_at),
  KEY emotion_logs_user_idx (user_id, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daily_checkins (
  id                CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id         CHAR(36) NOT NULL,
  user_id           CHAR(36) NOT NULL,
  checkin_date      DATE NOT NULL,
  day_rating        TINYINT NULL,
  connection        TINYINT NULL,
  gratitude         TEXT NULL,
  highlight         TEXT NULL,
  challenge         TEXT NULL,
  need_from_partner TEXT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY daily_checkins_unique (couple_id, user_id, checkin_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessments (
  id                  CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id           CHAR(36) NULL,
  user_id             CHAR(36) NOT NULL,
  kind                VARCHAR(40) NOT NULL DEFAULT 'love_vs_attraction',
  answers             JSON NULL,
  love_score          DECIMAL(5,2) NULL,
  attraction_score    DECIMAL(5,2) NULL,
  compatibility_score DECIMAL(5,2) NULL,
  result_key          VARCHAR(40) NULL,
  verdict             VARCHAR(160) NULL,
  summary             TEXT NULL,
  details             JSON NULL,
  taken_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY assessments_user_idx (user_id, taken_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS compatibility_scores (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id        CHAR(36) NOT NULL,
  period           DATE NOT NULL,
  overall          DECIMAL(5,2) NOT NULL DEFAULT 0,
  emotional        DECIMAL(5,2) NULL,
  communication    DECIMAL(5,2) NULL,
  trust            DECIMAL(5,2) NULL,
  financial        DECIMAL(5,2) NULL,
  intimacy         DECIMAL(5,2) NULL,
  lifestyle        DECIMAL(5,2) NULL,
  future_goals     DECIMAL(5,2) NULL,
  conflict         DECIMAL(5,2) NULL,
  love_index       DECIMAL(5,2) NULL,
  attraction_index DECIMAL(5,2) NULL,
  verdict          TEXT NULL,
  details          JSON NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY compatibility_scores_unique (couple_id, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 6. CHECKLISTS, MESSAGING, MEDIA
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS checklist_templates (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  slug        VARCHAR(80) NOT NULL,
  name        VARCHAR(160) NOT NULL,
  description TEXT NULL,
  category    VARCHAR(40) NOT NULL DEFAULT 'relationship',
  emoji       VARCHAR(8) NULL,
  climate     VARCHAR(40) NULL,
  trip_type   VARCHAR(40) NULL,
  is_public   TINYINT(1) NOT NULL DEFAULT 1,
  is_premium  TINYINT(1) NOT NULL DEFAULT 0,
  items       JSON NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY checklist_templates_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS checklists (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id   CHAR(36) NOT NULL,
  trip_id     CHAR(36) NULL,
  template_id CHAR(36) NULL,
  title       VARCHAR(160) NOT NULL,
  description TEXT NULL,
  category    VARCHAR(40) NOT NULL DEFAULT 'relationship',
  emoji       VARCHAR(8) NULL,
  due_date    DATE NULL,
  is_shared   TINYINT(1) NOT NULL DEFAULT 1,
  created_by  CHAR(36) NOT NULL,
  archived_at DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY checklists_couple_idx (couple_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS checklist_items (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  checklist_id CHAR(36) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  note         TEXT NULL,
  category     VARCHAR(60) NULL,
  quantity     INT NOT NULL DEFAULT 1,
  assigned_to  CHAR(36) NULL,
  due_date     DATE NULL,
  priority     ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal',
  is_done      TINYINT(1) NOT NULL DEFAULT 0,
  done_by      CHAR(36) NULL,
  done_at      DATETIME NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY checklist_items_list_idx (checklist_id, sort_order),
  CONSTRAINT checklist_items_list_fk FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS conversations (
  id                   CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id            CHAR(36) NOT NULL,
  title                VARCHAR(160) NULL,
  kind                 ENUM('direct','notes','support') NOT NULL DEFAULT 'direct',
  last_message_at      DATETIME NULL,
  last_message_preview VARCHAR(255) NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY conversations_unique (couple_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id              CHAR(36) NOT NULL DEFAULT (UUID()),
  conversation_id CHAR(36) NOT NULL,
  couple_id       CHAR(36) NOT NULL,
  sender_id       CHAR(36) NOT NULL,
  body            TEXT NULL,
  message_type    ENUM('text','image','file','sticker','voice','system','emotion','gift')
                  NOT NULL DEFAULT 'text',
  attachment_path TEXT NULL,
  attachment_name VARCHAR(255) NULL,
  attachment_size INT NULL,
  attachment_mime VARCHAR(120) NULL,
  reply_to        CHAR(36) NULL,
  reactions       JSON NULL,
  is_edited       TINYINT(1) NOT NULL DEFAULT 0,
  edited_at       DATETIME NULL,
  read_at         DATETIME NULL,
  deleted_at      DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY messages_conversation_idx (conversation_id, created_at),
  KEY messages_couple_idx (couple_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS media_assets (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id   CHAR(36) NULL,
  user_id     CHAR(36) NOT NULL,
  bucket      VARCHAR(60) NOT NULL DEFAULT 'couple-media',
  path        TEXT NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  mime_type   VARCHAR(120) NULL,
  size_bytes  BIGINT NOT NULL DEFAULT 0,
  width       INT NULL,
  height      INT NULL,
  kind        ENUM('photo','video','document','ticket','avatar','other') NOT NULL DEFAULT 'photo',
  album       VARCHAR(120) NULL,
  caption     TEXT NULL,
  is_private  TINYINT(1) NOT NULL DEFAULT 0,
  is_favorite TINYINT(1) NOT NULL DEFAULT 0,
  taken_at    DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY media_assets_couple_idx (couple_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS travel_documents (
  id                CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id         CHAR(36) NOT NULL,
  user_id           CHAR(36) NOT NULL,
  trip_id           CHAR(36) NULL,
  doc_type          ENUM('flight','hotel','train','bus','car_rental','cruise','attraction',
                         'restaurant','insurance','visa','passport','vaccination','other')
                    NOT NULL DEFAULT 'other',
  title             VARCHAR(200) NOT NULL,
  provider          VARCHAR(120) NULL,
  confirmation_code VARCHAR(120) NULL,
  booking_reference VARCHAR(120) NULL,
  passenger_names   VARCHAR(255) NULL,
  origin            VARCHAR(120) NULL,
  destination       VARCHAR(120) NULL,
  depart_at         DATETIME NULL,
  arrive_at         DATETIME NULL,
  check_in          DATE NULL,
  check_out         DATE NULL,
  seat              VARCHAR(60) NULL,
  gate              VARCHAR(20) NULL,
  terminal          VARCHAR(20) NULL,
  amount_cents      INT NULL,
  currency          CHAR(3) NULL,
  expires_at        DATE NULL,
  file_path         TEXT NULL,
  file_name         VARCHAR(255) NULL,
  file_mime         VARCHAR(120) NULL,
  file_size         BIGINT NULL,
  notes             TEXT NULL,
  is_shared         TINYINT(1) NOT NULL DEFAULT 1,
  reminder_sent_at  DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY travel_documents_couple_idx (couple_id, depart_at),
  KEY travel_documents_trip_idx (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 7. MONEY
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS incomes (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id    CHAR(36) NOT NULL,
  user_id      CHAR(36) NOT NULL,
  label        VARCHAR(120) NOT NULL DEFAULT 'Primary income',
  amount_cents INT NOT NULL DEFAULT 0,
  currency     CHAR(3) NOT NULL DEFAULT 'USD',
  frequency    ENUM('week','month','year') NOT NULL DEFAULT 'month',
  is_private   TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budgets (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id     CHAR(36) NOT NULL,
  trip_id       CHAR(36) NULL,
  name          VARCHAR(160) NOT NULL,
  budget_type   ENUM('household','trip','event','gift','custom') NOT NULL DEFAULT 'household',
  currency      CHAR(3) NOT NULL DEFAULT 'USD',
  total_cents   INT NOT NULL DEFAULT 0,
  period_start  DATE NULL,
  period_end    DATE NULL,
  split_type    ENUM('equal','income','custom','percent') NOT NULL DEFAULT 'equal',
  split_details JSON NULL,
  color         VARCHAR(9) NULL,
  notes         TEXT NULL,
  created_by    CHAR(36) NOT NULL,
  archived_at   DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY budgets_couple_idx (couple_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budget_categories (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  budget_id     CHAR(36) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  emoji         VARCHAR(8) NULL,
  planned_cents INT NOT NULL DEFAULT 0,
  color         VARCHAR(9) NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT budget_categories_budget_fk FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id     CHAR(36) NOT NULL,
  budget_id     CHAR(36) NULL,
  category_id   CHAR(36) NULL,
  trip_id       CHAR(36) NULL,
  paid_by       CHAR(36) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT NULL,
  category      VARCHAR(60) NOT NULL DEFAULT 'other',
  amount_cents  INT NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'USD',
  fx_rate       DECIMAL(14,6) NOT NULL DEFAULT 1,
  spent_on      DATE NOT NULL,
  split_type    ENUM('equal','income','custom','percent','none') NOT NULL DEFAULT 'equal',
  split_details JSON NULL,
  receipt_path  TEXT NULL,
  is_recurring  TINYINT(1) NOT NULL DEFAULT 0,
  recurrence    VARCHAR(40) NULL,
  is_settled    TINYINT(1) NOT NULL DEFAULT 0,
  created_by    CHAR(36) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY expenses_couple_idx (couple_id, spent_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expense_shares (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  expense_id  CHAR(36) NOT NULL,
  user_id     CHAR(36) NOT NULL,
  share_cents INT NOT NULL DEFAULT 0,
  is_settled  TINYINT(1) NOT NULL DEFAULT 0,
  settled_at  DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY expense_shares_unique (expense_id, user_id),
  CONSTRAINT expense_shares_expense_fk FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settlements (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id    CHAR(36) NOT NULL,
  from_user    CHAR(36) NOT NULL,
  to_user      CHAR(36) NOT NULL,
  amount_cents INT NOT NULL,
  currency     CHAR(3) NOT NULL DEFAULT 'USD',
  method       VARCHAR(60) NULL,
  note         TEXT NULL,
  settled_on   DATE NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gifts (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id     CHAR(36) NOT NULL,
  from_user     CHAR(36) NULL,
  to_user       CHAR(36) NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT NULL,
  occasion      VARCHAR(40) NOT NULL DEFAULT 'other',
  status        ENUM('idea','planned','purchased','wrapped','given','received') NOT NULL DEFAULT 'idea',
  amount_cents  INT NULL,
  currency      CHAR(3) NULL,
  url           TEXT NULL,
  image_path    TEXT NULL,
  store         VARCHAR(120) NULL,
  occasion_date DATE NULL,
  given_at      DATE NULL,
  is_surprise   TINYINT(1) NOT NULL DEFAULT 1,
  rating        TINYINT NULL,
  reaction      VARCHAR(120) NULL,
  created_by    CHAR(36) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY gifts_couple_idx (couple_id, occasion_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wishlist_items (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id   CHAR(36) NOT NULL,
  user_id     CHAR(36) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT NULL,
  url         TEXT NULL,
  image_path  TEXT NULL,
  price_cents INT NULL,
  currency    CHAR(3) NULL,
  priority    ENUM('low','normal','high','dream') NOT NULL DEFAULT 'normal',
  is_reserved TINYINT(1) NOT NULL DEFAULT 0,
  reserved_by CHAR(36) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 8. TRAVEL
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS countries (
  code               CHAR(2) NOT NULL,
  code3              CHAR(3) NULL,
  name               VARCHAR(120) NOT NULL,
  slug               VARCHAR(120) NOT NULL,
  region             VARCHAR(80) NULL,
  continent          VARCHAR(40) NULL,
  capital            VARCHAR(120) NULL,
  currency_code      CHAR(3) NULL,
  currency_symbol    VARCHAR(8) NULL,
  languages          JSON NULL,
  flag_emoji         VARCHAR(16) NULL,
  phone_code         VARCHAR(10) NULL,
  timezone           VARCHAR(64) NULL,
  is_schengen        TINYINT(1) NOT NULL DEFAULT 0,
  is_tier1           TINYINT(1) NOT NULL DEFAULT 0,
  visa_note          TEXT NULL,
  best_season        VARCHAR(120) NULL,
  safety_rating      DECIMAL(3,1) NULL,
  avg_daily_cost_usd INT NULL,
  hero_image         TEXT NULL,
  summary            TEXT NULL,
  description        TEXT NULL,
  meta_title         VARCHAR(255) NULL,
  meta_description   TEXT NULL,
  is_featured        TINYINT(1) NOT NULL DEFAULT 0,
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  sort_order         INT NOT NULL DEFAULT 0,
  PRIMARY KEY (code),
  UNIQUE KEY countries_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS destinations (
  id                 CHAR(36) NOT NULL DEFAULT (UUID()),
  country_code       CHAR(2) NOT NULL,
  name               VARCHAR(160) NOT NULL,
  slug               VARCHAR(160) NOT NULL,
  city               VARCHAR(120) NULL,
  state_region       VARCHAR(120) NULL,
  destination_type   ENUM('city','beach','mountain','island','countryside','desert','lake',
                          'historic','ski','safari','cruise') NOT NULL DEFAULT 'city',
  summary            TEXT NULL,
  description        TEXT NULL,
  hero_image         TEXT NULL,
  gallery            JSON NULL,
  latitude           DECIMAL(9,6) NULL,
  longitude          DECIMAL(9,6) NULL,
  best_months        JSON NULL,
  avg_daily_cost_usd INT NULL,
  honeymoon_score    TINYINT NULL,
  romance_score      TINYINT NULL,
  budget_level       ENUM('budget','moderate','premium','luxury') NULL,
  ideal_days         INT NULL,
  rating             DECIMAL(3,2) NULL,
  review_count       INT NOT NULL DEFAULT 0,
  popularity         INT NOT NULL DEFAULT 0,
  tags               JSON NULL,
  highlights         JSON NULL,
  is_honeymoon       TINYINT(1) NOT NULL DEFAULT 0,
  is_featured        TINYINT(1) NOT NULL DEFAULT 0,
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  meta_title         VARCHAR(255) NULL,
  meta_description   TEXT NULL,
  keywords           JSON NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY destinations_slug_unique (slug),
  KEY destinations_country_idx (country_code),
  CONSTRAINT destinations_country_fk FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attractions (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  destination_id   CHAR(36) NOT NULL,
  name             VARCHAR(200) NOT NULL,
  slug             VARCHAR(200) NOT NULL,
  category         VARCHAR(40) NOT NULL DEFAULT 'sightseeing',
  description      TEXT NULL,
  image            TEXT NULL,
  address          VARCHAR(255) NULL,
  latitude         DECIMAL(9,6) NULL,
  longitude        DECIMAL(9,6) NULL,
  ticket_price_usd DECIMAL(10,2) NULL,
  duration_minutes INT NULL,
  best_time        VARCHAR(120) NULL,
  rating           DECIMAL(3,2) NULL,
  is_must_see      TINYINT(1) NOT NULL DEFAULT 0,
  is_romantic      TINYINT(1) NOT NULL DEFAULT 0,
  booking_url      TEXT NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY attractions_unique (destination_id, slug),
  CONSTRAINT attractions_destination_fk FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS trips (
  id             CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id      CHAR(36) NOT NULL,
  destination_id CHAR(36) NULL,
  country_code   CHAR(2) NULL,
  title          VARCHAR(200) NOT NULL,
  slug           VARCHAR(200) NULL,
  trip_type      ENUM('honeymoon','vacation','weekend','anniversary','business','family',
                      'adventure','roadtrip') NOT NULL DEFAULT 'vacation',
  status         ENUM('idea','planning','booked','ongoing','completed','cancelled')
                 NOT NULL DEFAULT 'planning',
  start_date     DATE NULL,
  end_date       DATE NULL,
  travelers      INT NOT NULL DEFAULT 2,
  budget_cents   INT NULL,
  spent_cents    INT NOT NULL DEFAULT 0,
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  cover_image    TEXT NULL,
  notes          TEXT NULL,
  rating         TINYINT NULL,
  created_by     CHAR(36) NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY trips_couple_idx (couple_id, start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS itineraries (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  trip_id          CHAR(36) NOT NULL,
  couple_id        CHAR(36) NOT NULL,
  title            VARCHAR(200) NOT NULL DEFAULT 'Main itinerary',
  pace             ENUM('relaxed','balanced','packed') NOT NULL DEFAULT 'balanced',
  interests        JSON NULL,
  generated_by     ENUM('manual','generator','template') NOT NULL DEFAULT 'manual',
  total_cost_cents INT NOT NULL DEFAULT 0,
  currency         CHAR(3) NOT NULL DEFAULT 'USD',
  is_primary       TINYINT(1) NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT itineraries_trip_fk FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS itinerary_days (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  itinerary_id CHAR(36) NOT NULL,
  day_number   INT NOT NULL,
  day_date     DATE NULL,
  title        VARCHAR(200) NULL,
  summary      TEXT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY itinerary_days_unique (itinerary_id, day_number),
  CONSTRAINT itinerary_days_itinerary_fk FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS itinerary_items (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  day_id           CHAR(36) NOT NULL,
  attraction_id    CHAR(36) NULL,
  start_time       TIME NULL,
  end_time         TIME NULL,
  title            VARCHAR(200) NOT NULL,
  item_type        ENUM('activity','meal','transport','hotel','flight','rest','shopping','free_time')
                   NOT NULL DEFAULT 'activity',
  location         VARCHAR(200) NULL,
  description      TEXT NULL,
  duration_minutes INT NULL,
  cost_cents       INT NULL,
  currency         CHAR(3) NULL,
  booking_url      TEXT NULL,
  document_id      CHAR(36) NULL,
  is_booked        TINYINT(1) NOT NULL DEFAULT 0,
  is_done          TINYINT(1) NOT NULL DEFAULT 0,
  sort_order       INT NOT NULL DEFAULT 0,
  notes            TEXT NULL,
  PRIMARY KEY (id),
  KEY itinerary_items_day_idx (day_id, sort_order),
  CONSTRAINT itinerary_items_day_fk FOREIGN KEY (day_id) REFERENCES itinerary_days(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS packing_lists (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  trip_id     CHAR(36) NULL,
  couple_id   CHAR(36) NOT NULL,
  name        VARCHAR(160) NOT NULL DEFAULT 'Packing list',
  template_id CHAR(36) NULL,
  created_by  CHAR(36) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS packing_items (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  list_id      CHAR(36) NOT NULL,
  name         VARCHAR(200) NOT NULL,
  category     VARCHAR(60) NOT NULL DEFAULT 'general',
  quantity     INT NOT NULL DEFAULT 1,
  assigned_to  CHAR(36) NULL,
  is_packed    TINYINT(1) NOT NULL DEFAULT 0,
  packed_by    CHAR(36) NULL,
  packed_at    DATETIME NULL,
  is_essential TINYINT(1) NOT NULL DEFAULT 0,
  notes        TEXT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY packing_items_list_idx (list_id, sort_order),
  CONSTRAINT packing_items_list_fk FOREIGN KEY (list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 9. CMS, SETTINGS & LOGS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS blog_categories (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  slug             VARCHAR(120) NOT NULL,
  name             VARCHAR(120) NOT NULL,
  description      TEXT NULL,
  meta_title       VARCHAR(255) NULL,
  meta_description TEXT NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY blog_categories_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blog_posts (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  slug             VARCHAR(200) NOT NULL,
  title            VARCHAR(255) NOT NULL,
  excerpt          TEXT NULL,
  content          LONGTEXT NULL,
  cover_image      TEXT NULL,
  category_id      CHAR(36) NULL,
  author_id        CHAR(36) NULL,
  author_name      VARCHAR(120) NULL,
  status           ENUM('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft',
  is_featured      TINYINT(1) NOT NULL DEFAULT 0,
  reading_minutes  INT NOT NULL DEFAULT 5,
  view_count       INT NOT NULL DEFAULT 0,
  tags             JSON NULL,
  keywords         JSON NULL,
  meta_title       VARCHAR(255) NULL,
  meta_description TEXT NULL,
  canonical_url    TEXT NULL,
  og_image         TEXT NULL,
  schema_type      VARCHAR(40) NOT NULL DEFAULT 'BlogPosting',
  no_index         TINYINT(1) NOT NULL DEFAULT 0,
  published_at     DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY blog_posts_slug_unique (slug),
  KEY blog_posts_status_idx (status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pages (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  slug             VARCHAR(200) NOT NULL,
  title            VARCHAR(255) NOT NULL,
  content          LONGTEXT NULL,
  page_type        ENUM('legal','marketing','support','custom') NOT NULL DEFAULT 'legal',
  status           ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
  show_in_footer   TINYINT(1) NOT NULL DEFAULT 1,
  show_in_header   TINYINT(1) NOT NULL DEFAULT 0,
  meta_title       VARCHAR(255) NULL,
  meta_description TEXT NULL,
  keywords         JSON NULL,
  canonical_url    TEXT NULL,
  no_index         TINYINT(1) NOT NULL DEFAULT 0,
  sort_order       INT NOT NULL DEFAULT 0,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY pages_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seo_meta (
  id             CHAR(36) NOT NULL DEFAULT (UUID()),
  path           VARCHAR(255) NOT NULL,
  title          VARCHAR(255) NULL,
  description    TEXT NULL,
  keywords       JSON NULL,
  og_title       VARCHAR(255) NULL,
  og_description TEXT NULL,
  og_image       TEXT NULL,
  twitter_card   VARCHAR(40) NULL DEFAULT 'summary_large_image',
  canonical_url  TEXT NULL,
  robots         VARCHAR(80) NULL DEFAULT 'index,follow',
  priority       DECIMAL(2,1) NULL DEFAULT 0.7,
  changefreq     VARCHAR(20) NULL DEFAULT 'weekly',
  json_ld        JSON NULL,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY seo_meta_path_unique (path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS redirects (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  source      VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  status_code INT NOT NULL DEFAULT 301,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  hits        INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY redirects_source_unique (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS faqs (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  question   VARCHAR(500) NOT NULL,
  answer     TEXT NOT NULL,
  category   VARCHAR(40) NOT NULL DEFAULT 'general',
  page_path  VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS testimonials (
  id              CHAR(36) NOT NULL DEFAULT (UUID()),
  author_name     VARCHAR(120) NOT NULL,
  author_role     VARCHAR(120) NULL,
  author_location VARCHAR(120) NULL,
  avatar_url      TEXT NULL,
  quote           TEXT NOT NULL,
  rating          TINYINT NOT NULL DEFAULT 5,
  is_featured     TINYINT(1) NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(120) NOT NULL,
  value       JSON NOT NULL,
  group_name  VARCHAR(60) NOT NULL DEFAULT 'general',
  label       VARCHAR(160) NULL,
  description TEXT NULL,
  is_public   TINYINT(1) NOT NULL DEFAULT 0,
  is_secret   TINYINT(1) NOT NULL DEFAULT 0,
  updated_by  CHAR(36) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  KEY site_settings_group_idx (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_gateways (
  id                   CHAR(36) NOT NULL DEFAULT (UUID()),
  provider             ENUM('stripe','paypal','manual') NOT NULL,
  display_name         VARCHAR(120) NOT NULL,
  is_enabled           TINYINT(1) NOT NULL DEFAULT 0,
  mode                 ENUM('test','live') NOT NULL DEFAULT 'test',
  credentials          JSON NULL,
  supported_currencies JSON NULL,
  sort_order           INT NOT NULL DEFAULT 0,
  instructions         TEXT NULL,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY payment_gateways_provider_unique (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_templates (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  slug        VARCHAR(80) NOT NULL,
  name        VARCHAR(160) NOT NULL,
  subject     VARCHAR(255) NOT NULL,
  html_body   LONGTEXT NOT NULL,
  text_body   TEXT NULL,
  description TEXT NULL,
  variables   JSON NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY email_templates_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_logs (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  to_email      VARCHAR(255) NOT NULL,
  from_email    VARCHAR(255) NULL,
  subject       VARCHAR(255) NULL,
  template_slug VARCHAR(80) NULL,
  status        ENUM('queued','sent','failed','bounced') NOT NULL DEFAULT 'queued',
  error         TEXT NULL,
  provider      VARCHAR(40) NULL DEFAULT 'smtp',
  user_id       CHAR(36) NULL,
  sent_at       DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY email_logs_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36) NOT NULL,
  couple_id  CHAR(36) NULL,
  type       VARCHAR(40) NOT NULL DEFAULT 'system',
  title      VARCHAR(255) NOT NULL,
  body       TEXT NULL,
  link       VARCHAR(255) NULL,
  emoji      VARCHAR(8) NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  read_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY notifications_user_idx (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  actor_id    CHAR(36) NULL,
  actor_email VARCHAR(255) NULL,
  action      VARCHAR(120) NOT NULL,
  entity_type VARCHAR(60) NULL,
  entity_id   VARCHAR(120) NULL,
  summary     TEXT NULL,
  changes     JSON NULL,
  ip_address  VARCHAR(64) NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY audit_logs_created_idx (created_at),
  KEY audit_logs_actor_idx (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_messages (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  name       VARCHAR(160) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  subject    VARCHAR(255) NULL,
  message    TEXT NOT NULL,
  category   VARCHAR(40) NULL DEFAULT 'general',
  status     ENUM('new','read','replied','closed','spam') NOT NULL DEFAULT 'new',
  replied_at DATETIME NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              CHAR(36) NOT NULL DEFAULT (UUID()),
  email           VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  name            VARCHAR(160) NULL,
  status          ENUM('subscribed','unsubscribed','bounced') NOT NULL DEFAULT 'subscribed',
  source          VARCHAR(60) NULL,
  country_code    CHAR(2) NULL,
  confirmed_at    DATETIME NULL,
  unsubscribed_at DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY newsletter_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key    VARCHAR(80) NOT NULL,
  name        VARCHAR(160) NOT NULL,
  description TEXT NULL,
  is_enabled  TINYINT(1) NOT NULL DEFAULT 0,
  rollout_pct INT NOT NULL DEFAULT 100,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (flag_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exchange_rates (
  base_currency  CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  rate           DECIMAL(18,8) NOT NULL,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (base_currency, quote_currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usage_counters (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id  CHAR(36) NULL,
  user_id    CHAR(36) NULL,
  metric     VARCHAR(60) NOT NULL,
  period     CHAR(7) NOT NULL,
  count      INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY usage_counters_unique (couple_id, user_id, metric, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- SEED DATA — the 10 fairness areas, their 30 behaviours, plans and pricing.
-- Reference travel/CMS content is in supabase/migrations/0003_seed.sql; port
-- the INSERT statements from there if you populate MySQL as your primary store.
-- ============================================================================

INSERT INTO fairness_categories (id, slug, name, emoji, description, fair_rule, weight, sort_order, is_dealbreaker) VALUES
 (UUID(),'emotional-connection','Emotional Connection','🤝','Both partners are equally allowed to be vulnerable, heard and supported.','No one should always be the "strong one" — both get to be vulnerable.',1.20,1,0),
 (UUID(),'communication','Communication System','💬','A working system of daily check-ins and deeper weekly conversations.','If one raises a concern, the other must take it seriously — not ignore or delay.',1.20,2,0),
 (UUID(),'respect-boundaries','Respect & Boundaries','❤️','Personal space, friendships, hobbies and privacy are mutually respected.','Freedom should be equal — not one controlling the other.',1.10,3,0),
 (UUID(),'trust-loyalty','Trust & Loyalty','🧠','Transparency, consistency and loyalty — physical and emotional.','Trust is built by both — broken by one, but affects both.',1.30,4,0),
 (UUID(),'financial-fairness','Financial Fairness','💸','Expenses split equally or balanced by income, with no financial pressure.','Effort matters more than money — both contribute fairly.',1.00,5,0),
 (UUID(),'time-attention','Time & Attention','👫','Quality time together without either partner losing their individuality.','No one should feel ignored or like an "option."',1.00,6,0),
 (UUID(),'conflict-management','Conflict Management','⚖️','Disagreements are solved, not won. No blaming, no absolutes.','Problem vs Partner — fight the issue, not each other.',1.20,7,0),
 (UUID(),'affection-care','Affection & Care','💕','Verbal and physical affection, plus emotional support in hard times.','Love should be shown, not just assumed.',1.10,8,0),
 (UUID(),'growth-future','Growth & Future Alignment','🎯','Shared goals, supported ambitions and an aligned direction.','Do not hold each other back — grow together or clearly separate paths.',1.00,9,0),
 (UUID(),'deal-breakers','Deal Breakers','🚫','Non-negotiable standards that must apply equally to both partners.','Standards apply equally — no double standards.',1.50,10,1)
ON DUPLICATE KEY UPDATE name = VALUES(name), fair_rule = VALUES(fair_rule);

INSERT INTO fairness_criteria (id, category_id, text, sort_order)
SELECT UUID(), c.id, v.text, v.sort_order FROM fairness_categories c JOIN (
  SELECT 'emotional-connection' AS cat, 'Listen without interrupting' AS text, 1 AS sort_order UNION ALL
  SELECT 'emotional-connection','Validate feelings (not dismiss or mock)',2 UNION ALL
  SELECT 'emotional-connection','Share personal thoughts openly',3 UNION ALL
  SELECT 'emotional-connection','Be emotionally available when needed',4 UNION ALL
  SELECT 'communication','Daily check-ins ("How was your day?")',1 UNION ALL
  SELECT 'communication','Weekly deeper conversation (future, issues, plans)',2 UNION ALL
  SELECT 'communication','No silent treatment',3 UNION ALL
  SELECT 'communication','No shouting or abusive language',4 UNION ALL
  SELECT 'respect-boundaries','Respect personal space (time, friends, hobbies)',1 UNION ALL
  SELECT 'respect-boundaries','No controlling behaviour (phone checking, restrictions)',2 UNION ALL
  SELECT 'respect-boundaries','Privacy is mutual',3 UNION ALL
  SELECT 'trust-loyalty','No cheating — physical or emotional',1 UNION ALL
  SELECT 'trust-loyalty','Transparency about important things',2 UNION ALL
  SELECT 'trust-loyalty','Consistency between words and actions',3 UNION ALL
  SELECT 'financial-fairness','Expenses split equally or balanced by income',1 UNION ALL
  SELECT 'financial-fairness','No financial pressure on one side',2 UNION ALL
  SELECT 'financial-fairness','Gifts are mutual, not a one-sided expectation',3 UNION ALL
  SELECT 'time-attention','Quality time together (not just texting)',1 UNION ALL
  SELECT 'time-attention','Each other prioritised without losing individuality',2 UNION ALL
  SELECT 'conflict-management','No blaming, no "you always / you never"',1 UNION ALL
  SELECT 'conflict-management','Focus on solving, not winning',2 UNION ALL
  SELECT 'conflict-management','Take a break when emotions run high',3 UNION ALL
  SELECT 'affection-care','Verbal affection (compliments, appreciation)',1 UNION ALL
  SELECT 'affection-care','Physical affection (as per comfort)',2 UNION ALL
  SELECT 'affection-care','Emotional support during hard times',3 UNION ALL
  SELECT 'growth-future','Goals discussed openly (career, marriage, lifestyle)',1 UNION ALL
  SELECT 'growth-future','Each other''s ambitions actively supported',2 UNION ALL
  SELECT 'deal-breakers','No abuse — physical, emotional or verbal',1 UNION ALL
  SELECT 'deal-breakers','No manipulation or gaslighting',2 UNION ALL
  SELECT 'deal-breakers','No repeated dishonesty',3
) v ON v.cat = c.slug;

INSERT INTO plans (id, slug, name, tagline, tier, is_free, is_featured, trial_days, sort_order, badge, features, limits) VALUES
 (UUID(),'free','Starter','Begin the fairness habit',0,1,0,0,1,NULL,
  JSON_ARRAY('1 relationship space','Daily emotion check-ins','Weekly fairness score (10 areas)','Private couple chat (200 messages/mo)','1 shared checklist','100 MB secure storage'),
  JSON_OBJECT('couples',1,'emotion_logs',90,'messages',200,'checklists',1,'budgets',1,'trips',1,'itineraries',1,'gifts',5,'documents',5,'storage_mb',100,'history_months',1,'exports',0,'itinerary_generator',false,'advanced_reports',false,'priority_support',false,'remove_ads',false,'custom_categories',false)),
 (UUID(),'essential','Essential','For couples building the habit',1,0,1,14,2,'Most popular',
  JSON_ARRAY('Everything in Starter','Unlimited emotion logs','Full 10-area fairness reports','Love vs Attraction assessment','Unlimited private messaging + photos','Shared budgeting & fair expense split','Travel planner + itinerary generator','Ticket & booking vault (5 GB)','12 months of history','Ad-free experience'),
  JSON_OBJECT('couples',2,'emotion_logs',-1,'messages',-1,'checklists',25,'budgets',10,'trips',10,'itineraries',20,'gifts',100,'documents',200,'storage_mb',5120,'history_months',12,'exports',10,'itinerary_generator',true,'advanced_reports',true,'priority_support',false,'remove_ads',true,'custom_categories',true)),
 (UUID(),'premium','Premium','Deep insight and unlimited planning',2,0,0,14,3,'Best value',
  JSON_ARRAY('Everything in Essential','Unlimited trips & itineraries','Unlimited ticket & document vault (50 GB)','Advanced fairness analytics & trends','Balance index + risk alerts','Custom fairness categories','Unlimited PDF/CSV exports','Priority email support','Unlimited history'),
  JSON_OBJECT('couples',5,'emotion_logs',-1,'messages',-1,'checklists',-1,'budgets',-1,'trips',-1,'itineraries',-1,'gifts',-1,'documents',-1,'storage_mb',51200,'history_months',-1,'exports',-1,'itinerary_generator',true,'advanced_reports',true,'priority_support',true,'remove_ads',true,'custom_categories',true)),
 (UUID(),'lifetime','Lifetime','Pay once, keep forever',3,0,0,0,4,'One-time',
  JSON_ARRAY('Everything in Premium, forever','All future features included','Lifetime ticket vault','Founding member badge','Priority support for life'),
  JSON_OBJECT('couples',-1,'emotion_logs',-1,'messages',-1,'checklists',-1,'budgets',-1,'trips',-1,'itineraries',-1,'gifts',-1,'documents',-1,'storage_mb',102400,'history_months',-1,'exports',-1,'itinerary_generator',true,'advanced_reports',true,'priority_support',true,'remove_ads',true,'custom_categories',true))
ON DUPLICATE KEY UPDATE name = VALUES(name), features = VALUES(features), limits = VALUES(limits);

INSERT INTO plan_prices (id, plan_id, currency, billing_interval, amount_cents, compare_at_cents)
SELECT UUID(), p.id, v.currency, v.billing_interval, v.amount_cents, v.compare_at_cents
FROM plans p JOIN (
  SELECT 'essential' AS slug,'USD' AS currency,'month' AS billing_interval, 999 AS amount_cents, NULL AS compare_at_cents UNION ALL
  SELECT 'essential','USD','year',9900,11988 UNION ALL
  SELECT 'essential','GBP','month',799,NULL   UNION ALL
  SELECT 'essential','GBP','year',7900,9588   UNION ALL
  SELECT 'essential','EUR','month',949,NULL   UNION ALL
  SELECT 'essential','EUR','year',9400,11388  UNION ALL
  SELECT 'essential','CAD','month',1349,NULL  UNION ALL
  SELECT 'essential','CAD','year',13400,16188 UNION ALL
  SELECT 'essential','AUD','month',1499,NULL  UNION ALL
  SELECT 'essential','AUD','year',14900,17988 UNION ALL
  SELECT 'premium','USD','month',1999,NULL    UNION ALL
  SELECT 'premium','USD','year',19900,23988   UNION ALL
  SELECT 'premium','GBP','month',1599,NULL    UNION ALL
  SELECT 'premium','GBP','year',15900,19188   UNION ALL
  SELECT 'premium','EUR','month',1899,NULL    UNION ALL
  SELECT 'premium','EUR','year',18900,22788   UNION ALL
  SELECT 'premium','CAD','month',2699,NULL    UNION ALL
  SELECT 'premium','CAD','year',26900,32388   UNION ALL
  SELECT 'premium','AUD','month',2999,NULL    UNION ALL
  SELECT 'premium','AUD','year',29900,35988   UNION ALL
  SELECT 'lifetime','USD','lifetime',34900,59900 UNION ALL
  SELECT 'lifetime','GBP','lifetime',27900,47900 UNION ALL
  SELECT 'lifetime','EUR','lifetime',32900,55900 UNION ALL
  SELECT 'lifetime','CAD','lifetime',46900,79900 UNION ALL
  SELECT 'lifetime','AUD','lifetime',52900,89900
) v ON v.slug = p.slug
ON DUPLICATE KEY UPDATE amount_cents = VALUES(amount_cents);

INSERT INTO payment_gateways (id, provider, display_name, is_enabled, mode, credentials, supported_currencies, sort_order) VALUES
 (UUID(),'stripe','Stripe (Cards, Apple Pay, Google Pay)',0,'test',
  JSON_OBJECT('publishable_key','','secret_key','','webhook_secret',''), JSON_ARRAY('USD','GBP','EUR','CAD','AUD'),1),
 (UUID(),'paypal','PayPal',0,'test',
  JSON_OBJECT('client_id','','client_secret','','webhook_id',''), JSON_ARRAY('USD','GBP','EUR','CAD','AUD'),2),
 (UUID(),'manual','Bank transfer / manual',0,'live',
  JSON_OBJECT('instructions',''), JSON_ARRAY('USD','GBP','EUR','CAD','AUD'),3)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- Promote your admin account (run after the account exists).
-- UPDATE profiles SET role = 'superadmin' WHERE email = 'you@example.com';
