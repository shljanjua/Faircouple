-- ============================================================================
-- FairCouples — complete database (schema + seed data)
-- Pure PHP + MySQL build for Hostinger SHARED hosting. Runs on MySQL 8 and
-- MariaDB 10.4+ alike.
--
-- Target: Hostinger MySQL.
--   Database : u237845628_Faircouple
--   User     : u237845628_Faircouple
--   Site     : https://grey-opossum-178268.hostingersite.com
--
-- HOW TO IMPORT
--   1. hPanel -> Databases -> MySQL Databases: confirm the database and user
--      above exist, and note the password you set there.
--   2. hPanel -> Databases -> phpMyAdmin: click the database name on the left
--      (u237845628_Faircouple) so it is selected.
--   3. Open the Import tab -> choose this file -> Go.
--      (Or open the SQL tab and paste the whole file, then Go.)
--   4. Put the SAME four values into public_html/app/config.php:
--        'name'     => 'u237845628_Faircouple'
--        'user'     => 'u237845628_Faircouple'
--        'password' => the password from step 1
--        'host'     => 'localhost'   (correct on Hostinger — leave it)
--   5. Open your site, sign up, then run the final statement in this file with
--      your own email address to make yourself superadmin.
--
-- There is NO Node server and NO environment variables — the app reads its
-- database credentials only from app/config.php. Remote MySQL is not needed
-- because PHP runs on the same Hostinger account as the database.
--
-- The file is idempotent: every insert either upserts or is guarded, so
-- re-importing refreshes the reference data without duplicating rows.
--
-- MySQL has no row-level security. Every couple-scoped query in the
-- application is explicitly filtered by couple_id / user_id instead.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1. ACCOUNTS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  email             VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  password_hash     VARCHAR(255) NULL,
  email_verified_at DATETIME     NULL,
  disabled_at       DATETIME     NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Server-side session records. The browser holds a signed JWT cookie whose
-- `sid` claim points at one of these rows, so any session can be revoked here.
CREATE TABLE IF NOT EXISTS sessions (
  id         CHAR(36)     NOT NULL,
  user_id    CHAR(36)     NOT NULL,
  ip_address VARCHAR(64)  NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY sessions_user_idx (user_id),
  KEY sessions_expiry_idx (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One-time tokens for email confirmation and password resets. Only the
-- SHA-256 hash is stored, so a database leak cannot be replayed as a live link.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  kind       ENUM('verify','reset') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  used_at    DATETIME NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY auth_tokens_hash_unique (token_hash),
  KEY auth_tokens_user_idx (user_id, kind),
  CONSTRAINT auth_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
  id                 CHAR(36)     NOT NULL,
  email              VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
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
  email        VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
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
  PRIMARY KEY (id),
  -- Lets the seed re-import with INSERT IGNORE instead of duplicating rows.
  UNIQUE KEY faqs_question_unique (question)
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
  PRIMARY KEY (id),
  -- Lets the seed re-import with INSERT IGNORE instead of duplicating rows.
  UNIQUE KEY testimonials_quote_unique (author_name, quote(180))
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
  email           VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
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
-- SEED DATA
-- The complete fairness framework, 30 emotions, plans with multi-currency
-- pricing, 45 countries, 50+ destinations with attractions, packing and
-- relationship checklists, legal and marketing pages, blog posts, FAQs,
-- testimonials, SEO metadata, email templates and every platform setting.
-- ============================================================================

-- The 10 fairness areas.
INSERT INTO fairness_categories (slug, name, emoji, icon, description, fair_rule, weight, sort_order, is_dealbreaker) VALUES
  ('emotional-connection','Emotional Connection','🤝','heart-handshake',
   'Both partners are equally allowed to be vulnerable, heard and supported.',
   'No one should always be the "strong one" — both get to be vulnerable.', 1.2, 1, false),
  ('communication','Communication System','💬','message-circle',
   'A working system of daily check-ins and deeper weekly conversations.',
   'If one raises a concern, the other must take it seriously — not ignore or delay.', 1.2, 2, false),
  ('respect-boundaries','Respect & Boundaries','❤️','shield-check',
   'Personal space, friendships, hobbies and privacy are mutually respected.',
   'Freedom should be equal — not one controlling the other.', 1.1, 3, false),
  ('trust-loyalty','Trust & Loyalty','🧠','lock',
   'Transparency, consistency and loyalty — physical and emotional.',
   'Trust is built by both — broken by one, but affects both.', 1.3, 4, false),
  ('financial-fairness','Financial Fairness','💸','wallet',
   'Expenses split equally or balanced by income, with no financial pressure.',
   'Effort matters more than money — both contribute fairly.', 1.0, 5, false),
  ('time-attention','Time & Attention','👫','clock',
   'Quality time together without either partner losing their individuality.',
   'No one should feel ignored or like an "option."', 1.0, 6, false),
  ('conflict-management','Conflict Management','⚖️','scale',
   'Disagreements are solved, not won. No blaming, no absolutes.',
   'Problem vs Partner — fight the issue, not each other.', 1.2, 7, false),
  ('affection-care','Affection & Care','💕','heart',
   'Verbal and physical affection, plus emotional support in hard times.',
   'Love should be shown, not just assumed.', 1.1, 8, false),
  ('growth-future','Growth & Future Alignment','🎯','target',
   'Shared goals, supported ambitions and an aligned direction.',
   'Don''t hold each other back — grow together or clearly separate paths.', 1.0, 9, false),
  ('deal-breakers','Deal Breakers','🚫','octagon-alert',
   'Non-negotiable standards that must apply equally to both partners.',
   'Standards apply equally — no double standards.', 1.5, 10, true)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  icon = VALUES(icon),
  description = VALUES(description),
  fair_rule = VALUES(fair_rule),
  weight = VALUES(weight),
  sort_order = VALUES(sort_order),
  is_dealbreaker = VALUES(is_dealbreaker);

-- The 30 behaviours behind the 10 areas.
INSERT INTO fairness_criteria (category_id, text, help_text, polarity, sort_order)
SELECT c.id, x.text, x.help_text, 'positive', x.sort_order
  FROM fairness_categories c
  JOIN (
  SELECT 'emotional-connection' AS cat, 'Listen without interrupting' AS text, 'Let your partner finish before you respond.' AS help_text, 1 AS sort_order
  UNION ALL SELECT 'emotional-connection', 'Validate feelings (not dismiss or mock)', '"That makes sense" beats "you''re overreacting".', 2
  UNION ALL SELECT 'emotional-connection', 'Share personal thoughts openly', 'Say the real thing, not the safe version.', 3
  UNION ALL SELECT 'emotional-connection', 'Be emotionally available when needed', 'Present, not distant, when your partner reaches for you.', 4
  UNION ALL SELECT 'communication', 'Daily check-ins ("How was your day?")', 'Small, consistent contact beats rare big talks.', 1
  UNION ALL SELECT 'communication', 'Weekly deeper conversation (future, issues, plans)', 'One honest hour a week prevents months of drift.', 2
  UNION ALL SELECT 'communication', 'No silent treatment', 'Silence is a punishment, not a boundary.', 3
  UNION ALL SELECT 'communication', 'No shouting or abusive language', 'Volume is not an argument.', 4
  UNION ALL SELECT 'respect-boundaries', 'Respect personal space (time, friends, hobbies)', 'A life outside the relationship is healthy.', 1
  UNION ALL SELECT 'respect-boundaries', 'No controlling behaviour (phone checking, restrictions)', 'Monitoring is not love.', 2
  UNION ALL SELECT 'respect-boundaries', 'Privacy is mutual', 'The same rules apply to both phones.', 3
  UNION ALL SELECT 'trust-loyalty', 'No cheating — physical or emotional', 'Emotional affairs count.', 1
  UNION ALL SELECT 'trust-loyalty', 'Transparency about important things', 'No hidden debts, contacts or plans.', 2
  UNION ALL SELECT 'trust-loyalty', 'Consistency between words and actions', 'Reliability is the proof of trust.', 3
  UNION ALL SELECT 'financial-fairness', 'Expenses split equally or balanced by income', 'Fair does not always mean identical.', 1
  UNION ALL SELECT 'financial-fairness', 'No financial pressure on one side', 'Neither partner should feel squeezed.', 2
  UNION ALL SELECT 'financial-fairness', 'Gifts are mutual, not a one-sided expectation', 'Reciprocity, not scorekeeping.', 3
  UNION ALL SELECT 'time-attention', 'Quality time together (not just texting)', 'Undivided attention, phones down.', 1
  UNION ALL SELECT 'time-attention', 'Each other prioritised without losing individuality', 'Together, not merged.', 2
  UNION ALL SELECT 'conflict-management', 'No blaming, no "you always / you never"', 'Absolutes escalate, specifics resolve.', 1
  UNION ALL SELECT 'conflict-management', 'Focus on solving, not winning', 'A won argument can lose the relationship.', 2
  UNION ALL SELECT 'conflict-management', 'Take a break when emotions run high', 'Pause, then return — do not walk out.', 3
  UNION ALL SELECT 'affection-care', 'Verbal affection (compliments, appreciation)', 'Say it out loud, often.', 1
  UNION ALL SELECT 'affection-care', 'Physical affection (as per comfort)', 'Consent and comfort first.', 2
  UNION ALL SELECT 'affection-care', 'Emotional support during hard times', 'Show up when it is inconvenient.', 3
  UNION ALL SELECT 'growth-future', 'Goals discussed openly (career, marriage, lifestyle)', 'Assumptions about the future cause the biggest breaks.', 1
  UNION ALL SELECT 'growth-future', 'Each other''s ambitions actively supported', 'Support costs time, not just words.', 2
  UNION ALL SELECT 'deal-breakers', 'No abuse — physical, emotional or verbal', 'Zero tolerance, both directions.', 1
  UNION ALL SELECT 'deal-breakers', 'No manipulation or gaslighting', 'Reality is not up for negotiation.', 2
  UNION ALL SELECT 'deal-breakers', 'No repeated dishonesty', 'A pattern is a decision, not a mistake.', 3
  ) x ON x.cat = c.slug
  WHERE NOT EXISTS (SELECT 1 FROM fairness_criteria LIMIT 1);

-- Emotion vocabulary for the check-in and emotion log.
INSERT INTO emotion_types (slug, label, emoji, valence, category, sort_order) VALUES
  ('loved','Loved','🥰','positive','connection',1),
  ('happy','Happy','😊','positive','core',2),
  ('grateful','Grateful','🙏','positive','connection',3),
  ('secure','Secure','🛡️','positive','trust',4),
  ('excited','Excited','🤩','positive','core',5),
  ('proud','Proud','🌟','positive','growth',6),
  ('playful','Playful','😜','positive','core',7),
  ('affectionate','Affectionate','💕','positive','connection',8),
  ('supported','Supported','🤝','positive','connection',9),
  ('calm','Calm','😌','positive','core',10),
  ('hopeful','Hopeful','🌈','positive','growth',11),
  ('attracted','Attracted','🔥','positive','intimacy',12),
  ('neutral','Neutral','😐','neutral','core',13),
  ('tired','Tired','😴','neutral','core',14),
  ('confused','Confused','😕','neutral','core',15),
  ('distracted','Distracted','🌀','neutral','core',16),
  ('lonely','Lonely','🥺','negative','connection',17),
  ('ignored','Ignored','👻','negative','connection',18),
  ('anxious','Anxious','😰','negative','core',19),
  ('sad','Sad','😢','negative','core',20),
  ('frustrated','Frustrated','😤','negative','conflict',21),
  ('angry','Angry','😠','negative','conflict',22),
  ('hurt','Hurt','💔','negative','conflict',23),
  ('jealous','Jealous','😒','negative','trust',24),
  ('insecure','Insecure','😟','negative','trust',25),
  ('overwhelmed','Overwhelmed','😵','negative','core',26),
  ('disrespected','Disrespected','🚫','negative','respect',27),
  ('unappreciated','Unappreciated','😞','negative','connection',28),
  ('pressured','Pressured','😩','negative','financial',29),
  ('resentful','Resentful','🌩️','negative','conflict',30)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  emoji = VALUES(emoji),
  valence = VALUES(valence),
  category = VALUES(category),
  sort_order = VALUES(sort_order);

-- Subscription plans and their per-plan limits.
INSERT INTO plans (slug, name, tagline, description, tier, is_free, is_featured, trial_days, sort_order, badge, features, limits) VALUES
  ('free','Starter','Begin the fairness habit','Track the basics for free — daily emotions, one relationship space and weekly fairness scoring.',
   0, true, false, 0, 1, NULL,
   '["1 relationship space","Daily emotion check-ins","Weekly fairness score (10 areas)","Basic compatibility snapshot","Private couple chat (200 messages/mo)","1 shared checklist","100 MB secure storage"]',
   '{"couples":1,"emotion_logs":90,"messages":200,"checklists":1,"budgets":1,"trips":1,"itineraries":1,"gifts":5,"documents":5,"storage_mb":100,"history_months":1,"exports":0,"itinerary_generator":false,"advanced_reports":false,"priority_support":false,"remove_ads":false,"custom_categories":false}'),
  ('essential','Essential','For couples building the habit','Everything you need to keep effort, respect and loyalty balanced — with full travel planning.',
   1, false, true, 14, 2, 'Most popular',
   '["Everything in Starter","Unlimited emotion logs","Full 10-area fairness reports","Love vs Attraction assessment","Unlimited private messaging + photos","Shared budgeting & fair expense split","Travel planner + itinerary generator","Ticket & booking vault (5 GB)","12 months of history","Ad-free experience"]',
   '{"couples":2,"emotion_logs":-1,"messages":-1,"checklists":25,"budgets":10,"trips":10,"itineraries":20,"gifts":100,"documents":200,"storage_mb":5120,"history_months":12,"exports":10,"itinerary_generator":true,"advanced_reports":true,"priority_support":false,"remove_ads":true,"custom_categories":true}'),
  ('premium','Premium','Deep insight and unlimited planning','Advanced fairness analytics, unlimited trips and documents, PDF exports and priority support.',
   2, false, false, 14, 3, 'Best value',
   '["Everything in Essential","Unlimited trips & itineraries","Unlimited ticket & document vault (50 GB)","Advanced fairness analytics & trends","Balance index + risk alerts","Custom fairness categories","Unlimited PDF/CSV exports","Gift planner with surprise mode","Priority email support","Unlimited history"]',
   '{"couples":5,"emotion_logs":-1,"messages":-1,"checklists":-1,"budgets":-1,"trips":-1,"itineraries":-1,"gifts":-1,"documents":-1,"storage_mb":51200,"history_months":-1,"exports":-1,"itinerary_generator":true,"advanced_reports":true,"priority_support":true,"remove_ads":true,"custom_categories":true}'),
  ('lifetime','Lifetime','Pay once, keep forever','All Premium features, one payment, no renewals — including every future feature.',
   3, false, false, 0, 4, 'One-time',
   '["Everything in Premium, forever","All future features included","Lifetime ticket vault","Founding member badge","Priority support for life"]',
   '{"couples":-1,"emotion_logs":-1,"messages":-1,"checklists":-1,"budgets":-1,"trips":-1,"itineraries":-1,"gifts":-1,"documents":-1,"storage_mb":102400,"history_months":-1,"exports":-1,"itinerary_generator":true,"advanced_reports":true,"priority_support":true,"remove_ads":true,"custom_categories":true}')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  tagline = VALUES(tagline),
  description = VALUES(description),
  tier = VALUES(tier),
  is_free = VALUES(is_free),
  is_featured = VALUES(is_featured),
  trial_days = VALUES(trial_days),
  sort_order = VALUES(sort_order),
  badge = VALUES(badge),
  features = VALUES(features),
  limits = VALUES(limits);

-- Prices in USD, GBP, EUR, CAD and AUD — monthly, yearly and lifetime.
INSERT INTO plan_prices (plan_id, currency, billing_interval, amount_cents, compare_at_cents)
SELECT p.id, v.currency, v.billing_interval, v.amount_cents, v.compare_at_cents
  FROM plans p
  JOIN (
  SELECT 'free' AS slug, 'USD' AS currency, 'month' AS billing_interval, 0 AS amount_cents, NULL AS compare_at_cents
  UNION ALL SELECT 'free','USD','year',0,NULL
  UNION ALL SELECT 'essential','USD','month',999,NULL
  UNION ALL SELECT 'essential','USD','year',9900,11988
  UNION ALL SELECT 'essential','GBP','month',799,NULL
  UNION ALL SELECT 'essential','GBP','year',7900,9588
  UNION ALL SELECT 'essential','EUR','month',949,NULL
  UNION ALL SELECT 'essential','EUR','year',9400,11388
  UNION ALL SELECT 'essential','CAD','month',1349,NULL
  UNION ALL SELECT 'essential','CAD','year',13400,16188
  UNION ALL SELECT 'essential','AUD','month',1499,NULL
  UNION ALL SELECT 'essential','AUD','year',14900,17988
  UNION ALL SELECT 'premium','USD','month',1999,NULL
  UNION ALL SELECT 'premium','USD','year',19900,23988
  UNION ALL SELECT 'premium','GBP','month',1599,NULL
  UNION ALL SELECT 'premium','GBP','year',15900,19188
  UNION ALL SELECT 'premium','EUR','month',1899,NULL
  UNION ALL SELECT 'premium','EUR','year',18900,22788
  UNION ALL SELECT 'premium','CAD','month',2699,NULL
  UNION ALL SELECT 'premium','CAD','year',26900,32388
  UNION ALL SELECT 'premium','AUD','month',2999,NULL
  UNION ALL SELECT 'premium','AUD','year',29900,35988
  UNION ALL SELECT 'lifetime','USD','lifetime',34900,59900
  UNION ALL SELECT 'lifetime','GBP','lifetime',27900,47900
  UNION ALL SELECT 'lifetime','EUR','lifetime',32900,55900
  UNION ALL SELECT 'lifetime','CAD','lifetime',46900,79900
  UNION ALL SELECT 'lifetime','AUD','lifetime',52900,89900
  ) v ON v.slug = p.slug
ON DUPLICATE KEY UPDATE
  amount_cents = VALUES(amount_cents),
  compare_at_cents = VALUES(compare_at_cents);

-- Countries behind the public travel guides.
INSERT INTO countries (code, code3, name, slug, region, continent, capital, currency_code, currency_symbol,
                              flag_emoji, is_schengen, is_tier1, best_season, avg_daily_cost_usd, summary, is_featured, sort_order) VALUES
  ('US','USA','United States','united-states','North America','North America','Washington, D.C.','USD','$','🇺🇸',false,true,'Apr–Jun, Sep–Oct',210,'Fifty states of coastlines, canyons, cities and road trips — the widest range of honeymoon styles anywhere.',true,1),
  ('GB','GBR','United Kingdom','united-kingdom','Northern Europe','Europe','London','GBP','£','🇬🇧',false,true,'May–Sep',195,'Historic cities, dramatic coastline and countryside escapes within a few hours of each other.',true,2),
  ('CA','CAN','Canada','canada','North America','North America','Ottawa','CAD','C$','🇨🇦',false,true,'Jun–Sep, Dec–Mar',185,'Rocky Mountain lakes, island coastlines and northern lights — nature at an enormous scale.',true,3),
  ('AU','AUS','Australia','australia','Oceania','Oceania','Canberra','AUD','A$','🇦🇺',false,true,'Sep–Nov, Mar–May',190,'Reef, rainforest, wine country and world-class city beaches.',true,4),
  ('FR','FRA','France','france','Western Europe','Europe','Paris','EUR','€','🇫🇷',true,true,'Apr–Jun, Sep–Oct',175,'The benchmark romantic destination — Paris, Provence, the Riviera and the Loire.',true,5),
  ('IT','ITA','Italy','italy','Southern Europe','Europe','Rome','EUR','€','🇮🇹',true,true,'Apr–Jun, Sep–Oct',165,'Amalfi cliffs, Venetian canals, Tuscan hills and the best food on the continent.',true,6),
  ('ES','ESP','Spain','spain','Southern Europe','Europe','Madrid','EUR','€','🇪🇸',true,true,'Apr–Jun, Sep–Oct',140,'Islands, tapas culture, Moorish palaces and long warm evenings.',true,7),
  ('DE','DEU','Germany','germany','Western Europe','Europe','Berlin','EUR','€','🇩🇪',true,true,'May–Sep, Dec',150,'Fairytale castles, Alpine lakes, Christmas markets and effortless rail travel.',true,8),
  ('GR','GRC','Greece','greece','Southern Europe','Europe','Athens','EUR','€','🇬🇷',true,false,'May–Jun, Sep–Oct',145,'Whitewashed islands, caldera sunsets and 6,000 years of history.',true,9),
  ('PT','PRT','Portugal','portugal','Southern Europe','Europe','Lisbon','EUR','€','🇵🇹',true,false,'Apr–Jun, Sep–Oct',125,'Atlantic coastline, tiled cities and Europe''s best value for couples.',true,10),
  ('CH','CHE','Switzerland','switzerland','Western Europe','Europe','Bern','CHF','CHF','🇨🇭',true,true,'Jun–Sep, Dec–Mar',280,'Alpine railways, glacier lakes and the most photogenic mountains in Europe.',true,11),
  ('AT','AUT','Austria','austria','Western Europe','Europe','Vienna','EUR','€','🇦🇹',true,true,'May–Sep, Dec–Feb',165,'Imperial Vienna, Alpine villages and the classic Christmas-market winter.',true,12),
  ('NL','NLD','Netherlands','netherlands','Western Europe','Europe','Amsterdam','EUR','€','🇳🇱',true,true,'Apr–May, Sep',170,'Canal cities, tulip season and cycling distances between everything.',true,13),
  ('BE','BEL','Belgium','belgium','Western Europe','Europe','Brussels','EUR','€','🇧🇪',true,true,'May–Sep',155,'Medieval Bruges, chocolate, beer and easy rail links to the rest of Europe.',false,14),
  ('IE','IRL','Ireland','ireland','Northern Europe','Europe','Dublin','EUR','€','🇮🇪',false,true,'May–Sep',170,'Cliffs, castles, coastal drives and famously warm hospitality.',true,15),
  ('NO','NOR','Norway','norway','Northern Europe','Europe','Oslo','NOK','kr','🇳🇴',true,true,'Jun–Aug, Jan–Mar',230,'Fjords in summer, northern lights in winter — the most dramatic scenery in Europe.',true,16),
  ('SE','SWE','Sweden','sweden','Northern Europe','Europe','Stockholm','SEK','kr','🇸🇪',true,true,'Jun–Aug, Dec–Feb',205,'Archipelago summers, design-led cities and Lapland ice hotels.',false,17),
  ('DK','DNK','Denmark','denmark','Northern Europe','Europe','Copenhagen','DKK','kr','🇩🇰',true,true,'May–Sep',210,'Hygge, harbour swimming and one of the world''s best food scenes.',false,18),
  ('FI','FIN','Finland','finland','Northern Europe','Europe','Helsinki','EUR','€','🇫🇮',true,true,'Jun–Aug, Dec–Mar',195,'Glass igloos, aurora nights, saunas and a thousand lakes.',true,19),
  ('IS','ISL','Iceland','iceland','Northern Europe','Europe','Reykjavík','ISK','kr','🇮🇸',true,true,'Jun–Aug, Sep–Mar',245,'Waterfalls, black beaches, hot springs and the aurora — a honeymoon on another planet.',true,20),
  ('CZ','CZE','Czechia','czechia','Central Europe','Europe','Prague','CZK','Kč','🇨🇿',true,false,'Apr–Jun, Sep–Oct',110,'Prague''s spires and cobbles at a fraction of Western European prices.',true,21),
  ('HU','HUN','Hungary','hungary','Central Europe','Europe','Budapest','HUF','Ft','🇭🇺',true,false,'Apr–Jun, Sep–Oct',100,'Thermal baths, Danube views and Europe''s best-value romantic city break.',false,22),
  ('PL','POL','Poland','poland','Central Europe','Europe','Warsaw','PLN','zł','🇵🇱',true,false,'May–Sep',95,'Restored old towns, Baltic beaches and Tatra mountains.',false,23),
  ('HR','HRV','Croatia','croatia','Southern Europe','Europe','Zagreb','EUR','€','🇭🇷',true,false,'May–Jun, Sep',125,'Adriatic islands, walled cities and warm turquoise water.',true,24),
  ('SI','SVN','Slovenia','slovenia','Central Europe','Europe','Ljubljana','EUR','€','🇸🇮',true,false,'May–Sep',115,'Lake Bled, alpine valleys and a compact, walkable capital.',false,25),
  ('RO','ROU','Romania','romania','Eastern Europe','Europe','Bucharest','RON','lei','🇷🇴',true,false,'May–Sep',85,'Carpathian castles, painted monasteries and dramatic mountain roads.',false,26),
  ('BG','BGR','Bulgaria','bulgaria','Eastern Europe','Europe','Sofia','BGN','лв','🇧🇬',true,false,'May–Sep',80,'Black Sea coast, ski resorts and Roman ruins on a small budget.',false,27),
  ('SK','SVK','Slovakia','slovakia','Central Europe','Europe','Bratislava','EUR','€','🇸🇰',true,false,'May–Sep',95,'High Tatras hiking and a compact riverside capital.',false,28),
  ('EE','EST','Estonia','estonia','Northern Europe','Europe','Tallinn','EUR','€','🇪🇪',true,false,'Jun–Aug, Dec',105,'A perfectly preserved medieval old town and Baltic forests.',false,29),
  ('LV','LVA','Latvia','latvia','Northern Europe','Europe','Riga','EUR','€','🇱🇻',true,false,'Jun–Aug',100,'Art nouveau architecture and long white-sand Baltic beaches.',false,30),
  ('LT','LTU','Lithuania','lithuania','Northern Europe','Europe','Vilnius','EUR','€','🇱🇹',true,false,'Jun–Aug',95,'Baroque Vilnius and the dunes of the Curonian Spit.',false,31),
  ('LU','LUX','Luxembourg','luxembourg','Western Europe','Europe','Luxembourg City','EUR','€','🇱🇺',true,true,'May–Sep',185,'A fortress city in a green valley, at the crossroads of Europe.',false,32),
  ('MT','MLT','Malta','malta','Southern Europe','Europe','Valletta','EUR','€','🇲🇹',true,false,'Apr–Jun, Sep–Oct',130,'Honey-coloured limestone, blue lagoons and year-round sun.',false,33),
  ('CY','CYP','Cyprus','cyprus','Southern Europe','Europe','Nicosia','EUR','€','🇨🇾',false,false,'Apr–Jun, Sep–Nov',125,'Mediterranean beaches, mountain villages and the longest summer in Europe.',false,34),
  ('NZ','NZL','New Zealand','new-zealand','Oceania','Oceania','Wellington','NZD','NZ$','🇳🇿',false,true,'Nov–Apr',180,'Fiords, glaciers, vineyards and empty roads — an adventure honeymoon classic.',true,35),
  ('JP','JPN','Japan','japan','East Asia','Asia','Tokyo','JPY','¥','🇯🇵',false,true,'Mar–May, Oct–Nov',175,'Cherry blossom, ryokan onsen and a culture unlike anywhere else.',true,36),
  ('MV','MDV','Maldives','maldives','South Asia','Asia','Malé','MVR','Rf','🇲🇻',false,false,'Nov–Apr',420,'Overwater villas and private sandbanks — the definitive honeymoon island.',true,37),
  ('TH','THA','Thailand','thailand','Southeast Asia','Asia','Bangkok','THB','฿','🇹🇭',false,false,'Nov–Mar',85,'Island beaches, temples and outstanding value for long honeymoons.',true,38),
  ('ID','IDN','Indonesia','indonesia','Southeast Asia','Asia','Jakarta','IDR','Rp','🇮🇩',false,false,'Apr–Oct',75,'Bali''s rice terraces, cliff resorts and Gili island water.',true,39),
  ('AE','ARE','United Arab Emirates','united-arab-emirates','Middle East','Asia','Abu Dhabi','AED','د.إ','🇦🇪',false,false,'Nov–Mar',215,'Desert luxury, sky-high dining and beach resorts a short flight from Europe.',false,40),
  ('MX','MEX','Mexico','mexico','North America','North America','Mexico City','MXN','$','🇲🇽',false,false,'Nov–Apr',110,'Caribbean cenotes, colonial cities and all-inclusive Riviera Maya resorts.',true,41),
  ('CR','CRI','Costa Rica','costa-rica','Central America','North America','San José','CRC','₡','🇨🇷',false,false,'Dec–Apr',130,'Cloud forests, volcanoes and two coastlines in one small country.',false,42),
  ('ZA','ZAF','South Africa','south-africa','Southern Africa','Africa','Cape Town','ZAR','R','🇿🇦',false,false,'Oct–Apr',115,'Safari plus wine country plus coastline — three honeymoons in one.',false,43),
  ('MU','MUS','Mauritius','mauritius','East Africa','Africa','Port Louis','MUR','₨','🇲🇺',false,false,'May–Dec',210,'Lagoon resorts, hiking peaks and reliable winter sun.',false,44),
  ('SG','SGP','Singapore','singapore','Southeast Asia','Asia','Singapore','SGD','S$','🇸🇬',false,true,'Feb–Apr',180,'A garden city of rooftop pools, hawker food and effortless logistics.',false,45)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  code3 = VALUES(code3),
  slug = VALUES(slug),
  region = VALUES(region),
  continent = VALUES(continent),
  capital = VALUES(capital),
  currency_code = VALUES(currency_code),
  currency_symbol = VALUES(currency_symbol),
  flag_emoji = VALUES(flag_emoji),
  is_schengen = VALUES(is_schengen),
  is_tier1 = VALUES(is_tier1),
  best_season = VALUES(best_season),
  avg_daily_cost_usd = VALUES(avg_daily_cost_usd),
  summary = VALUES(summary),
  is_featured = VALUES(is_featured),
  sort_order = VALUES(sort_order);

-- Generated SEO metadata for country guides that have none of their own.
UPDATE countries
   SET meta_title = CONCAT(name, ' Travel Guide for Couples 2026 — Honeymoon Ideas & Costs'),
       meta_description = CONCAT(
         COALESCE(summary, CONCAT('Plan a romantic trip to ', name)),
         ' Compare costs, best months and itineraries with FairCouples.')
 WHERE meta_title IS NULL;

-- Destinations behind the public guides and the itinerary generator.
INSERT INTO destinations (country_code, name, slug, city, destination_type, summary, hero_image,
  latitude, longitude, best_months, avg_daily_cost_usd, honeymoon_score, romance_score, budget_level,
  ideal_days, rating, popularity, tags, highlights, is_honeymoon, is_featured) VALUES
  ('FR','Paris','paris','Paris','city','The original romantic city — river walks, rooftop views and a café on every corner.','https://images.unsplash.com/photo-1502602898657-3e91760cbb34',48.856600,2.352200,'["April", "May", "June", "September", "October"]',195,97,99,'premium',5,4.80,1000,'["romantic", "city", "food", "art", "honeymoon"]','["Eiffel Tower at golden hour", "Seine river dinner cruise", "Louvre & Musée d''Orsay", "Montmartre at sunrise", "Day trip to Versailles"]',true,true),
  ('FR','Nice & the French Riviera','nice-french-riviera','Nice','beach','Mediterranean blue, old-town markets and Monaco half an hour away.','https://images.unsplash.com/photo-1491166617655-0723a0999cfc',43.710200,7.262000,'["May", "June", "September", "October"]',185,92,94,'premium',5,4.70,820,'["beach", "riviera", "romantic", "honeymoon"]','["Promenade des Anglais", "Èze village", "Monaco day trip", "Antibes old town", "Coastal train to Menton"]',true,true),
  ('FR','Provence & Lavender Route','provence','Aix-en-Provence','countryside','Lavender fields, hilltop villages and long lunches under plane trees.','https://images.unsplash.com/photo-1499002238440-d264edd596ec',43.529700,5.447400,'["June", "July", "September"]',160,90,93,'moderate',4,4.70,540,'["countryside", "romantic", "wine", "honeymoon"]','["Valensole lavender fields", "Gordes & Roussillon", "Pont du Gard", "Wine tasting in Châteauneuf"]',true,false),
  ('IT','Amalfi Coast','amalfi-coast','Positano','beach','Cliffside villages stacked above turquoise water — Italy at its most cinematic.','https://images.unsplash.com/photo-1533165850316-ac4ee2c48c04',40.634000,14.602600,'["May", "June", "September"]',210,98,98,'luxury',5,4.90,960,'["beach", "romantic", "honeymoon", "italy"]','["Positano beach clubs", "Path of the Gods hike", "Capri boat day", "Ravello gardens", "Limoncello tasting"]',true,true),
  ('IT','Venice','venice','Venice','historic','Canals, gondolas and a city that empties beautifully after sunset.','https://images.unsplash.com/photo-1523906834658-6e24ef2386f9',45.440800,12.315500,'["April", "May", "September", "October"]',190,94,97,'premium',3,4.60,880,'["romantic", "historic", "honeymoon"]','["Gondola through back canals", "St Mark''s Basilica", "Murano & Burano", "Sunset on the Zattere"]',true,true),
  ('IT','Tuscany','tuscany','Florence','countryside','Renaissance cities surrounded by vineyards and cypress roads.','https://images.unsplash.com/photo-1543429776-2782fc8e1acd',43.769600,11.255800,'["May", "June", "September", "October"]',175,93,95,'premium',6,4.80,790,'["wine", "countryside", "art", "honeymoon"]','["Uffizi Gallery", "Val d''Orcia drive", "Chianti wine tour", "Siena & San Gimignano"]',true,true),
  ('IT','Lake Como','lake-como','Como','lake','Villas, ferries and mountains dropping straight into the water.','https://images.unsplash.com/photo-1527668752968-14dc70a27c95',45.985300,9.257400,'["May", "June", "September"]',205,95,96,'luxury',4,4.80,610,'["lake", "romantic", "honeymoon"]','["Villa del Balbianello", "Bellagio ferry hop", "Varenna sunset", "Funicular to Brunate"]',true,false),
  ('GR','Santorini','santorini','Oia','island','Caldera sunsets, blue domes and infinity pools above the Aegean.','https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff',36.393200,25.461500,'["May", "June", "September", "October"]',215,99,99,'luxury',4,4.90,990,'["island", "honeymoon", "romantic", "sunset"]','["Oia sunset", "Caldera catamaran cruise", "Assyrtiko wine tasting", "Red Beach", "Ancient Akrotiri"]',true,true),
  ('GR','Mykonos','mykonos','Mykonos Town','island','Whitewashed lanes by day, the Aegean''s best beach clubs by night.','https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a',37.445100,25.328700,'["June", "July", "September"]',225,88,90,'luxury',4,4.50,700,'["island", "nightlife", "beach"]','["Little Venice", "Delos ruins", "Psarou beach", "Windmills at dusk"]',true,false),
  ('GR','Crete','crete','Chania','island','Greece''s biggest island — gorges, pink beaches and the best food in the Aegean.','https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a',35.513800,24.018000,'["May", "June", "September", "October"]',140,85,86,'moderate',7,4.60,520,'["island", "beach", "food", "hiking"]','["Balos lagoon", "Samaria gorge", "Chania old harbour", "Elafonissi pink sand"]',true,false),
  ('ES','Barcelona','barcelona','Barcelona','city','Gaudí architecture, tapas crawls and a city beach ten minutes from the old town.','https://images.unsplash.com/photo-1583422409516-2895a77efded',41.385100,2.173400,'["April", "May", "September", "October"]',150,86,88,'moderate',4,4.60,910,'["city", "beach", "food", "architecture"]','["Sagrada Família", "Park Güell", "El Born tapas", "Montjuïc cable car"]',false,true),
  ('ES','Seville & Andalusia','seville','Seville','historic','Moorish palaces, orange trees and flamenco in candlelit courtyards.','https://images.unsplash.com/photo-1558642084-fd07fae5282e',37.389200,-5.984500,'["March", "April", "May", "October"]',130,88,91,'moderate',4,4.70,480,'["historic", "romantic", "culture"]','["Real Alcázar", "Plaza de España", "Flamenco in Triana", "Day trip to Córdoba"]',true,false),
  ('ES','Mallorca','mallorca','Palma','island','Cove beaches, mountain villages and one of the Med''s best cycling coasts.','https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9',39.569600,2.650200,'["May", "June", "September"]',160,84,85,'premium',5,4.50,430,'["island", "beach", "hiking"]','["Serra de Tramuntana drive", "Cala Deià", "Palma cathedral", "Sóller train"]',false,false),
  ('PT','Lisbon','lisbon','Lisbon','city','Tiled hills, tram 28 and Atlantic sunsets from a hundred miradouros.','https://images.unsplash.com/photo-1585208798174-6cedd86e019a',38.722300,-9.139300,'["April", "May", "September", "October"]',125,87,89,'moderate',4,4.70,760,'["city", "food", "coast", "budget"]','["Alfama & Fado night", "Belém tower & pastéis", "Sintra palaces", "Cascais coast"]',true,true),
  ('PT','Madeira','madeira','Funchal','island','Levada walks, cliff pools and flowers all year round.','https://images.unsplash.com/photo-1580323956656-26bbb1206e34',32.660900,-16.908100,'["April", "May", "September", "October"]',135,86,87,'moderate',6,4.70,320,'["island", "hiking", "nature"]','["Pico do Arieiro sunrise", "Levada do Caldeirão Verde", "Porto Moniz pools", "Cable car to Monte"]',true,false),
  ('PT','Algarve','algarve','Lagos','beach','Golden cliffs, sea caves and Europe''s most reliable beach summer.','https://images.unsplash.com/photo-1555881400-74d7acaacd8b',37.102000,-8.674100,'["May", "June", "September"]',120,85,86,'moderate',5,4.60,470,'["beach", "honeymoon", "budget"]','["Benagil cave", "Ponta da Piedade", "Praia da Marinha", "Sagres cliffs"]',true,false),
  ('CH','Interlaken & Jungfrau','interlaken','Interlaken','mountain','Two lakes, one valley and the most famous mountain railway in the world.','https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99',46.686300,7.863200,'["June", "July", "August", "September"]',260,93,92,'luxury',4,4.80,600,'["mountain", "adventure", "honeymoon"]','["Jungfraujoch railway", "Lauterbrunnen valley", "Schilthorn revolving restaurant", "Lake Brienz boat"]',true,true),
  ('CH','Zermatt','zermatt','Zermatt','ski','Car-free village beneath the Matterhorn — skiing in winter, hiking in summer.','https://images.unsplash.com/photo-1531210483974-4f8c1f33fd35',46.020700,7.749100,'["January", "February", "July", "August"]',285,91,90,'luxury',4,4.80,430,'["ski", "mountain", "luxury"]','["Gornergrat railway", "Matterhorn Glacier Paradise", "Five Lakes walk"]',true,false),
  ('DE','Bavarian Alps & Neuschwanstein','bavarian-alps','Füssen','mountain','Fairytale castles, alpine lakes and beer gardens with a mountain backdrop.','https://images.unsplash.com/photo-1595867818082-083862f3d630',47.557600,10.749800,'["May", "June", "September", "December"]',150,88,89,'moderate',4,4.70,560,'["castle", "mountain", "romantic"]','["Neuschwanstein Castle", "Lake Eibsee", "Zugspitze summit", "Linderhof palace"]',true,true),
  ('DE','Berlin','berlin','Berlin','city','History on every block, a food scene that never stops and the best nightlife in Europe.','https://images.unsplash.com/photo-1560969184-10fe8719e047',52.520000,13.405000,'["May", "June", "September", "December"]',140,74,76,'moderate',4,4.50,690,'["city", "history", "nightlife"]','["Museum Island", "Brandenburg Gate", "East Side Gallery", "Christmas markets"]',false,false),
  ('AT','Hallstatt & Salzkammergut','hallstatt','Hallstatt','lake','A lakeside village under sheer cliffs — the most photographed spot in Austria.','https://images.unsplash.com/photo-1516550893923-42d28e5677af',47.561200,13.648300,'["May", "June", "September"]',155,89,91,'moderate',3,4.70,510,'["lake", "romantic", "village"]','["Hallstatt Skywalk", "Salt mine tour", "Lake boat trip", "Gosausee reflection"]',true,false),
  ('AT','Vienna','vienna','Vienna','city','Imperial palaces, coffee houses and a waltz-worthy winter.','https://images.unsplash.com/photo-1516550893923-42d28e5677af',48.208200,16.373800,'["April", "May", "September", "December"]',160,84,88,'premium',3,4.70,580,'["city", "culture", "christmas"]','["Schönbrunn Palace", "State Opera night", "Naschmarkt", "Christmas markets"]',false,false),
  ('NL','Amsterdam','amsterdam','Amsterdam','city','Canal rings, museums and tulip season an hour away.','https://images.unsplash.com/photo-1534351590666-13e3e96b5017',52.367600,4.904100,'["April", "May", "September"]',175,82,85,'premium',3,4.60,720,'["city", "canals", "museums"]','["Canal cruise at dusk", "Van Gogh Museum", "Keukenhof tulips", "Jordaan district"]',false,false),
  ('IS','Reykjavík & the Golden Circle','iceland-golden-circle','Reykjavík','countryside','Waterfalls, geysers and hot springs within a day of the capital.','https://images.unsplash.com/photo-1504829857797-ddff29c27927',64.146600,-21.942600,'["June", "July", "August", "September", "February"]',245,94,93,'luxury',6,4.80,650,'["nature", "aurora", "honeymoon", "adventure"]','["Blue Lagoon", "Northern lights hunt", "Gullfoss & Geysir", "Jökulsárlón ice lagoon", "Diamond Beach"]',true,true),
  ('NO','Norwegian Fjords','norwegian-fjords','Bergen','mountain','Sognefjord, Flåm railway and the deepest fjord scenery on earth.','https://images.unsplash.com/photo-1516483638261-f4dbaf036963',60.391300,5.322100,'["June", "July", "August"]',235,90,91,'luxury',6,4.80,470,'["fjord", "nature", "honeymoon"]','["Flåm railway", "Nærøyfjord cruise", "Bergen Bryggen", "Trolltunga hike"]',true,true),
  ('NO','Tromsø & the Arctic','tromso','Tromsø','mountain','Aurora season, husky sledding and whale watching above the Arctic Circle.','https://images.unsplash.com/photo-1483347756197-71ef80e95f73',69.649200,18.956300,'["November", "December", "January", "February", "March"]',230,92,92,'luxury',4,4.80,380,'["aurora", "winter", "adventure", "honeymoon"]','["Northern lights chase", "Husky sledding", "Whale safari", "Cable car to Storsteinen"]',true,false),
  ('FI','Finnish Lapland','finnish-lapland','Rovaniemi','countryside','Glass igloos, reindeer sleighs and the aurora directly overhead.','https://images.unsplash.com/photo-1483347756197-71ef80e95f73',66.503900,25.729400,'["December", "January", "February", "March"]',225,95,96,'luxury',4,4.80,520,'["aurora", "winter", "honeymoon", "igloo"]','["Glass igloo night", "Santa Claus Village", "Husky & reindeer safari", "Ice floating"]',true,true),
  ('GB','London','london','London','city','Theatre, parks, markets and a thousand years of history in one square mile.','https://images.unsplash.com/photo-1513635269975-59663e0ac1ad',51.507400,-0.127800,'["May", "June", "July", "September", "December"]',210,83,85,'premium',5,4.70,950,'["city", "culture", "shopping"]','["Tower of London", "West End show", "Borough Market", "Thames sunset walk", "Day trip to Bath"]',false,true),
  ('GB','Scottish Highlands','scottish-highlands','Inverness','mountain','Lochs, glens and single-track roads to castles nobody else has found.','https://images.unsplash.com/photo-1506905925346-21bda4d32df4',57.477200,-4.224700,'["May", "June", "September"]',165,89,91,'moderate',6,4.80,420,'["nature", "roadtrip", "castle", "honeymoon"]','["Isle of Skye", "Glencoe", "Loch Ness & Urquhart Castle", "Jacobite steam train"]',true,true),
  ('GB','Lake District','lake-district','Windermere','lake','Fells, lakes and stone villages — England''s most romantic countryside.','https://images.unsplash.com/photo-1533130061792-64b345e4a833',54.380900,-2.906700,'["May", "June", "September"]',150,86,88,'moderate',4,4.70,340,'["lake", "hiking", "countryside"]','["Lake Windermere cruise", "Scafell Pike", "Beatrix Potter''s Hill Top", "Derwentwater"]',true,false),
  ('IE','Ring of Kerry & Dingle','ring-of-kerry','Killarney','countryside','Atlantic cliffs, green peninsulas and pubs with live music every night.','https://images.unsplash.com/photo-1590089415225-401ed6f9db8e',52.059900,-9.506800,'["May", "June", "September"]',165,88,90,'moderate',5,4.70,390,'["roadtrip", "coast", "honeymoon"]','["Slea Head Drive", "Cliffs of Moher", "Killarney National Park", "Skellig ring"]',true,false),
  ('CA','Banff & Lake Louise','banff','Banff','mountain','Turquoise glacier lakes ringed by the Canadian Rockies.','https://images.unsplash.com/photo-1609825488888-3a766db05542',51.178400,-115.570800,'["June", "July", "August", "September"]',195,94,94,'premium',6,4.90,780,'["mountain", "lake", "honeymoon", "nature"]','["Lake Louise canoe", "Moraine Lake sunrise", "Icefields Parkway", "Banff Gondola", "Johnston Canyon"]',true,true),
  ('CA','Vancouver & Whistler','vancouver-whistler','Vancouver','city','Ocean, mountains and rainforest inside one metropolitan area.','https://images.unsplash.com/photo-1560814304-4f05b62af116',49.282700,-123.120700,'["June", "July", "August", "December"]',190,85,86,'premium',5,4.60,540,'["city", "mountain", "ski"]','["Stanley Park seawall", "Sea-to-Sky Highway", "Peak 2 Peak gondola", "Granville Island"]',false,false),
  ('CA','Quebec City','quebec-city','Quebec City','historic','A walled French old town that turns into a snow globe in December.','https://images.unsplash.com/photo-1519832979-6fa011b87667',46.813900,-71.208000,'["June", "July", "September", "December"]',165,87,90,'moderate',3,4.70,360,'["historic", "romantic", "winter"]','["Château Frontenac", "Petit-Champlain", "Montmorency Falls", "Ice hotel"]',true,false),
  ('US','Maui, Hawaii','maui','Lahaina','island','Road to Hana, volcano sunrises and the most reliable US honeymoon beaches.','https://images.unsplash.com/photo-1542259009477-d625272157b7',20.798000,-156.331900,'["April", "May", "September", "October"]',320,96,96,'luxury',7,4.80,880,'["island", "beach", "honeymoon", "usa"]','["Road to Hana", "Haleakalā sunrise", "Molokini snorkel", "Kaanapali beach"]',true,true),
  ('US','New York City','new-york-city','New York','city','Skyline dinners, Broadway and Central Park in every season.','https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9',40.712800,-74.006000,'["April", "May", "September", "October", "December"]',280,84,86,'luxury',5,4.70,970,'["city", "usa", "shopping", "food"]','["Top of the Rock", "Broadway show", "Central Park rowboat", "Brooklyn Bridge walk", "MoMA"]',false,true),
  ('US','California Coast (PCH)','california-coast','San Francisco','countryside','Highway 1 from San Francisco to Big Sur — the great American road trip.','https://images.unsplash.com/photo-1449034446853-66c86144b0ad',36.270300,-121.807400,'["May", "June", "September", "October"]',250,90,91,'premium',8,4.80,620,'["roadtrip", "coast", "usa", "honeymoon"]','["Bixby Bridge", "Big Sur cliffs", "Napa Valley wine", "17-Mile Drive", "Golden Gate at sunset"]',true,true),
  ('US','Napa Valley','napa-valley','Napa','countryside','Wine country mornings in a hot air balloon, tastings all afternoon.','https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb',38.297500,-122.286900,'["April", "May", "September", "October"]',290,91,93,'luxury',3,4.70,410,'["wine", "romantic", "usa", "honeymoon"]','["Hot air balloon sunrise", "Castello di Amorosa", "Wine train", "Calistoga spa"]',true,false),
  ('US','Charleston','charleston','Charleston','historic','Cobblestones, antebellum architecture and low-country cooking.','https://images.unsplash.com/photo-1568393691622-c7ba131d63b4',32.776600,-79.930900,'["March", "April", "October", "November"]',195,86,89,'premium',3,4.70,300,'["historic", "romantic", "usa", "food"]','["Rainbow Row", "Carriage tour", "Boone Hall plantation", "Folly Beach"]',true,false),
  ('AU','Sydney','sydney','Sydney','city','Harbour, headlands and beaches you can reach by ferry.','https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9',-33.868800,151.209300,'["October", "November", "March", "April"]',200,86,87,'premium',5,4.70,720,'["city", "beach", "australia"]','["Opera House tour", "Bondi to Coogee walk", "Harbour Bridge climb", "Blue Mountains day trip"]',false,true),
  ('AU','Great Barrier Reef','great-barrier-reef','Cairns','island','The largest reef system on earth, plus rainforest at its doorstep.','https://images.unsplash.com/photo-1559827260-dc66d52bef19',-16.918600,145.778100,'["June", "July", "August", "September"]',225,93,92,'luxury',5,4.80,560,'["reef", "diving", "honeymoon", "australia"]','["Outer reef snorkel", "Whitehaven Beach", "Daintree rainforest", "Scenic heli flight"]',true,true),
  ('NZ','Queenstown','queenstown','Queenstown','mountain','Adventure capital wrapped around a lake, with vineyards next door.','https://images.unsplash.com/photo-1507699622108-4be3abd695ad',-45.031200,168.662600,'["December", "January", "February", "March"]',195,92,92,'premium',5,4.80,520,'["adventure", "mountain", "honeymoon"]','["Milford Sound day trip", "Skyline gondola", "Central Otago wine", "Glenorchy drive"]',true,true),
  ('JP','Kyoto','kyoto','Kyoto','historic','Temples, bamboo groves and ryokan evenings in kimono.','https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',35.011600,135.768100,'["March", "April", "October", "November"]',175,91,93,'premium',5,4.80,640,'["culture", "romantic", "honeymoon", "japan"]','["Fushimi Inari at dawn", "Arashiyama bamboo", "Gion evening walk", "Kiyomizu-dera", "Ryokan & onsen"]',true,true),
  ('MV','Maldives','maldives-atolls','Malé','island','Overwater villas, house reefs and complete privacy.','https://images.unsplash.com/photo-1514282401047-d79a71a590e8',3.202800,73.220700,'["November", "December", "January", "February", "March", "April"]',430,100,100,'luxury',7,4.90,940,'["island", "honeymoon", "luxury", "beach"]','["Overwater villa stay", "Sandbank picnic", "Manta ray snorkel", "Sunset dolphin cruise", "Underwater dining"]',true,true),
  ('TH','Phuket & Phi Phi','phuket','Phuket','island','Limestone islands, longtail boats and world-class value resorts.','https://images.unsplash.com/photo-1552465011-b4e21bf6e79a',7.878900,98.398100,'["November", "December", "January", "February", "March"]',95,88,88,'budget',6,4.50,600,'["island", "beach", "budget", "honeymoon"]','["Phi Phi island hopping", "Phang Nga Bay", "Big Buddha", "Old Phuket Town"]',true,false),
  ('ID','Bali','bali','Ubud','island','Rice terraces, clifftop temples and villas with private pools.','https://images.unsplash.com/photo-1537996194471-e657df975ab4',-8.409500,115.188900,'["April", "May", "June", "September", "October"]',85,94,95,'budget',8,4.70,910,'["island", "honeymoon", "budget", "wellness"]','["Tegallalang rice terraces", "Uluwatu sunset & kecak", "Nusa Penida day trip", "Floating breakfast villa", "Mount Batur sunrise"]',true,true),
  ('MX','Riviera Maya','riviera-maya','Tulum','beach','Caribbean water, cenotes and Mayan ruins on the beach.','https://images.unsplash.com/photo-1518105779142-d975f22f1b0a',20.211400,-87.465400,'["November", "December", "January", "February", "March", "April"]',150,90,91,'moderate',6,4.60,700,'["beach", "honeymoon", "ruins"]','["Tulum ruins", "Cenote Dos Ojos", "Chichén Itzá", "Isla Mujeres day trip"]',true,true),
  ('AE','Dubai','dubai','Dubai','city','Desert dinners, record-breaking towers and winter beach weather.','https://images.unsplash.com/photo-1512453979798-5ea266f8880c',25.204800,55.270800,'["November", "December", "January", "February", "March"]',215,85,86,'luxury',4,4.60,610,'["city", "luxury", "desert"]','["Burj Khalifa", "Desert safari dinner", "Palm Jumeirah", "Old Dubai souks"]',true,false),
  ('HR','Dubrovnik','dubrovnik','Dubrovnik','historic','City walls above the Adriatic and islands a ferry ride away.','https://images.unsplash.com/photo-1555990538-1e0d5c0d9dd7',42.650700,18.094400,'["May", "June", "September"]',150,89,91,'premium',4,4.70,480,'["historic", "coast", "honeymoon"]','["City walls walk", "Lokrum island", "Cable car sunset", "Elafiti island hop"]',true,false),
  ('CZ','Prague','prague','Prague','historic','Gothic spires, riverside walks and Europe''s best-value romantic weekend.','https://images.unsplash.com/photo-1519677100203-a0e668c92439',50.075500,14.437800,'["April", "May", "September", "October", "December"]',115,86,90,'budget',3,4.70,660,'["historic", "budget", "romantic", "christmas"]','["Charles Bridge at dawn", "Prague Castle", "Vltava river cruise", "Christmas markets"]',true,true),
  ('HU','Budapest','budapest','Budapest','historic','Thermal baths, Danube panoramas and ruin bars after dark.','https://images.unsplash.com/photo-1541849546-216549ae216d',47.497900,19.040400,'["April", "May", "September", "October"]',105,85,88,'budget',3,4.60,540,'["budget", "romantic", "spa"]','["Széchenyi baths", "Fisherman''s Bastion", "Danube night cruise", "Parliament tour"]',true,false),
  ('SI','Lake Bled','lake-bled','Bled','lake','An island church in an alpine lake, with a castle above it.','https://images.unsplash.com/photo-1533929736458-ca588d08c8be',46.363800,14.094400,'["May", "June", "September"]',125,90,93,'moderate',3,4.80,420,'["lake", "romantic", "honeymoon"]','["Pletna boat to the island", "Bled Castle", "Vintgar Gorge", "Bled cream cake"]',true,true),
  ('ZA','Cape Town & the Winelands','cape-town','Cape Town','city','Table Mountain, penguins, wine estates and two oceans.','https://images.unsplash.com/photo-1580060839134-75a5edca2e99',-33.924900,18.424100,'["November", "December", "January", "February", "March"]',125,89,90,'moderate',7,4.70,450,'["city", "wine", "safari", "honeymoon"]','["Table Mountain cable car", "Cape Point drive", "Stellenbosch wine tour", "Boulders penguin beach"]',true,false),
  ('MU','Mauritius','mauritius-island','Port Louis','island','Lagoon resorts, waterfalls and a mountain to climb before breakfast.','https://images.unsplash.com/photo-1544551763-46a013bb70d5',-20.348400,57.552200,'["May", "June", "September", "October", "November"]',215,93,93,'luxury',7,4.70,380,'["island", "honeymoon", "beach", "luxury"]','["Le Morne beach", "Chamarel coloured earth", "Île aux Cerfs", "Black River Gorges"]',true,false)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  country_code = VALUES(country_code),
  city = VALUES(city),
  destination_type = VALUES(destination_type),
  summary = VALUES(summary),
  hero_image = VALUES(hero_image),
  latitude = VALUES(latitude),
  longitude = VALUES(longitude),
  best_months = VALUES(best_months),
  avg_daily_cost_usd = VALUES(avg_daily_cost_usd),
  honeymoon_score = VALUES(honeymoon_score),
  romance_score = VALUES(romance_score),
  budget_level = VALUES(budget_level),
  ideal_days = VALUES(ideal_days),
  rating = VALUES(rating),
  popularity = VALUES(popularity),
  tags = VALUES(tags),
  highlights = VALUES(highlights),
  is_honeymoon = VALUES(is_honeymoon),
  is_featured = VALUES(is_featured);

-- Attractions — the itinerary generator builds its days from these.
INSERT INTO attractions
  (destination_id, name, slug, category, description, ticket_price_usd,
   duration_minutes, is_must_see, is_romantic, sort_order)
SELECT d.id, a.name, a.slug, a.category, a.description, a.price, a.mins,
       a.must_see, a.romantic, a.sort_order
  FROM destinations d
  JOIN (
  SELECT 'paris' AS dest_slug, 'Eiffel Tower Summit' AS name, 'eiffel-tower' AS slug, 'sightseeing' AS category, 'Book the last slot before sunset for the best light and shortest queues.' AS description, 32.0 AS price, 150 AS mins, true AS must_see, true AS romantic, 1 AS sort_order
  UNION ALL SELECT 'paris', 'Seine Dinner Cruise', 'seine-dinner-cruise', 'romantic', 'Two hours past every lit monument in the city.', 95.0, 120, false, true, 2
  UNION ALL SELECT 'paris', 'Musée du Louvre', 'louvre', 'museum', 'Enter through the Porte des Lions to skip the pyramid queue.', 22.0, 210, true, false, 3
  UNION ALL SELECT 'paris', 'Montmartre & Sacré-Cœur', 'montmartre', 'sightseeing', 'Arrive before 9am to have the steps to yourselves.', 0.0, 120, false, true, 4
  UNION ALL SELECT 'paris', 'Palace of Versailles', 'versailles', 'historic', 'A full day — gardens first, palace after 2pm.', 32.0, 420, true, true, 5
  UNION ALL SELECT 'santorini', 'Oia Sunset Point', 'oia-sunset', 'romantic', 'Claim a spot at the castle ruins 90 minutes early, or book a terrace table.', 0.0, 90, true, true, 1
  UNION ALL SELECT 'santorini', 'Caldera Catamaran Cruise', 'caldera-cruise', 'adventure', 'Hot springs, Red Beach and dinner on deck.', 135.0, 300, true, true, 2
  UNION ALL SELECT 'santorini', 'Ancient Akrotiri', 'akrotiri', 'museum', 'A Bronze Age town preserved under volcanic ash.', 14.0, 90, false, false, 3
  UNION ALL SELECT 'amalfi-coast', 'Path of the Gods', 'path-of-the-gods', 'nature', 'Walk Bomerano to Nocelle downhill — 3 hours, all view.', 0.0, 180, true, true, 1
  UNION ALL SELECT 'amalfi-coast', 'Capri Boat Day', 'capri-boat', 'adventure', 'Private boat with the Blue Grotto at opening time.', 180.0, 480, true, true, 2
  UNION ALL SELECT 'amalfi-coast', 'Villa Rufolo, Ravello', 'villa-rufolo', 'romantic', 'The terrace with the most famous view on the coast.', 10.0, 60, false, true, 3
  UNION ALL SELECT 'maldives-atolls', 'Sandbank Picnic', 'sandbank-picnic', 'romantic', 'Private sandbank drop-off with lunch and snorkelling gear.', 210.0, 240, true, true, 1
  UNION ALL SELECT 'maldives-atolls', 'Manta & Turtle Snorkel', 'manta-snorkel', 'nature', 'Best November to April on the western atolls.', 95.0, 180, true, false, 2
  UNION ALL SELECT 'bali', 'Tegallalang Rice Terraces', 'tegallalang', 'nature', 'Go at 7am — before the tour buses and the heat.', 2.0, 90, true, true, 1
  UNION ALL SELECT 'bali', 'Uluwatu Temple & Kecak Fire Dance', 'uluwatu', 'religious', 'Clifftop temple, sunset performance at 6pm.', 8.0, 150, true, true, 2
  UNION ALL SELECT 'bali', 'Mount Batur Sunrise Trek', 'mount-batur', 'adventure', '2am start, breakfast cooked in volcanic steam at the summit.', 45.0, 420, false, true, 3
  UNION ALL SELECT 'banff', 'Moraine Lake Sunrise', 'moraine-lake', 'nature', 'Shuttle reservations required — book 60 days ahead.', 12.0, 180, true, true, 1
  UNION ALL SELECT 'banff', 'Lake Louise Canoe', 'lake-louise-canoe', 'romantic', 'Rent for an hour on the turquoise water below Victoria Glacier.', 115.0, 60, true, true, 2
  UNION ALL SELECT 'banff', 'Icefields Parkway Drive', 'icefields-parkway', 'nature', '230 km of glaciers between Lake Louise and Jasper.', 0.0, 480, true, false, 3
  UNION ALL SELECT 'kyoto', 'Fushimi Inari at Dawn', 'fushimi-inari', 'religious', 'Ten thousand torii gates — arrive by 6:30am for empty paths.', 0.0, 120, true, true, 1
  UNION ALL SELECT 'kyoto', 'Arashiyama Bamboo Grove', 'arashiyama', 'nature', 'Combine with the Sagano railway and monkey park.', 0.0, 90, true, true, 2
  UNION ALL SELECT 'kyoto', 'Gion Evening Walk', 'gion', 'sightseeing', 'Lantern-lit lanes; be respectful, no photos of geiko.', 0.0, 90, false, true, 3
  UNION ALL SELECT 'iceland-golden-circle', 'Blue Lagoon', 'blue-lagoon', 'romantic', 'Pre-book the Retreat slot for fewer crowds.', 95.0, 180, true, true, 1
  UNION ALL SELECT 'iceland-golden-circle', 'Northern Lights Hunt', 'northern-lights', 'nature', 'September to March, clear nights, small-group jeep tours.', 110.0, 300, true, true, 2
  UNION ALL SELECT 'iceland-golden-circle', 'Jökulsárlón Ice Lagoon', 'jokulsarlon', 'nature', 'Icebergs drifting to Diamond Beach — worth the long drive.', 0.0, 240, true, true, 3
  UNION ALL SELECT 'finnish-lapland', 'Glass Igloo Night', 'glass-igloo', 'romantic', 'Sleep under the aurora with the heating on.', 420.0, 600, true, true, 1
  UNION ALL SELECT 'finnish-lapland', 'Husky Safari', 'husky-safari', 'adventure', 'Drive your own team through frozen forest.', 180.0, 240, true, false, 2
  UNION ALL SELECT 'venice', 'Back-Canal Gondola', 'gondola', 'romantic', 'Book from a quieter side canal, not Rialto — same price, better ride.', 95.0, 35, true, true, 1
  UNION ALL SELECT 'venice', 'Murano & Burano', 'murano-burano', 'sightseeing', 'Glass furnaces and painted fishermen''s houses by vaporetto.', 10.0, 300, false, true, 2
  UNION ALL SELECT 'london', 'Tower of London', 'tower-of-london', 'historic', 'Yeoman Warder tour first, Crown Jewels at opening.', 40.0, 180, true, false, 1
  UNION ALL SELECT 'london', 'West End Show', 'west-end', 'nightlife', 'Day seats released at 10am for the best price.', 75.0, 180, false, true, 2
  UNION ALL SELECT 'new-york-city', 'Top of the Rock', 'top-of-the-rock', 'sightseeing', 'The only observation deck with the Empire State in the shot.', 44.0, 90, true, true, 1
  UNION ALL SELECT 'new-york-city', 'Central Park Rowboat', 'central-park-rowboat', 'romantic', 'Loeb Boathouse, April to October.', 25.0, 60, false, true, 2
  ) a ON a.dest_slug = d.slug
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  ticket_price_usd = VALUES(ticket_price_usd),
  duration_minutes = VALUES(duration_minutes),
  is_must_see = VALUES(is_must_see),
  is_romantic = VALUES(is_romantic),
  sort_order = VALUES(sort_order);

-- Generated SEO metadata and keywords for destination guides.
UPDATE destinations
   SET meta_title = CONCAT(name, ' Honeymoon Guide 2026 — Costs, Best Time & Itinerary'),
       meta_description = CONCAT(
         COALESCE(summary, ''),
         ' Plan it with FairCouples: day-by-day itinerary, shared budget and packing checklist.'),
       keywords = JSON_ARRAY(
         CONCAT(LOWER(name), ' honeymoon'),
         CONCAT(LOWER(name), ' itinerary'),
         CONCAT(LOWER(name), ' couples trip'),
         CONCAT('romantic ', LOWER(name)),
         CONCAT(LOWER(name), ' travel cost'))
 WHERE meta_title IS NULL;

-- Packing, travel and relationship checklist templates.
INSERT INTO checklist_templates (slug, name, description, category, emoji, climate, trip_type, is_premium, sort_order, items) VALUES
  ('essential-documents','Travel Documents & Money','Never leave these behind — the list that ruins a trip if you miss one.','travel','🛂',NULL,'any',false,1,
   '[{"name":"Passports (6+ months validity)","category":"Documents","essential":true},{"name":"Visa / ESTA / ETA approval","category":"Documents","essential":true},{"name":"Printed & digital flight tickets","category":"Documents","essential":true},{"name":"Hotel booking confirmations","category":"Documents","essential":true},{"name":"Travel insurance policy","category":"Documents","essential":true},{"name":"Driving licence + IDP","category":"Documents"},{"name":"Vaccination certificates","category":"Documents"},{"name":"Two payment cards (different networks)","category":"Money","essential":true},{"name":"Local currency cash","category":"Money"},{"name":"Emergency contact card","category":"Documents"},{"name":"Copies stored in the FairCouples vault","category":"Documents","essential":true}]'),
  ('carry-on-essentials','Carry-On Essentials','What must stay with you, not in the hold.','packing','🎒',NULL,'any',false,2,
   '[{"name":"Passports & wallet","category":"Carry-on","essential":true},{"name":"Phone + charging cable","category":"Electronics","essential":true},{"name":"Power bank (under 100Wh)","category":"Electronics","essential":true},{"name":"Noise-cancelling headphones","category":"Electronics"},{"name":"Medication in original packaging","category":"Health","essential":true},{"name":"Change of underwear & t-shirt","category":"Clothing"},{"name":"Toothbrush & travel toothpaste","category":"Toiletries"},{"name":"Neck pillow & eye mask","category":"Comfort"},{"name":"Refillable water bottle (empty)","category":"Comfort"},{"name":"Snacks","category":"Comfort"},{"name":"Pen for landing cards","category":"Documents"}]'),
  ('beach-honeymoon','Beach Honeymoon Packing','Maldives, Bali, Caribbean — hot, humid and photogenic.','packing','🏝️','tropical','honeymoon',false,3,
   '[{"name":"Swimwear ×3 each","category":"Clothing","essential":true},{"name":"Reef-safe SPF 50","category":"Health","essential":true},{"name":"After-sun / aloe","category":"Health"},{"name":"Wide-brim hat & sunglasses","category":"Clothing","essential":true},{"name":"Light cover-ups / sarong","category":"Clothing"},{"name":"Water shoes","category":"Footwear"},{"name":"Snorkel mask","category":"Gear"},{"name":"Dry bag","category":"Gear"},{"name":"Waterproof phone case","category":"Gear"},{"name":"Insect repellent (DEET 30%+)","category":"Health","essential":true},{"name":"Two smart outfits for dinners","category":"Clothing"},{"name":"Underwater / action camera","category":"Electronics"},{"name":"Portable fan","category":"Comfort"},{"name":"Rehydration sachets","category":"Health"}]'),
  ('europe-city-break','Europe City Break Packing','Paris, Rome, Prague — walking, weather changes and dinner reservations.','packing','🏛️','temperate','city',false,4,
   '[{"name":"Broken-in walking shoes","category":"Footwear","essential":true},{"name":"Compact umbrella","category":"Gear"},{"name":"Layerable jacket","category":"Clothing","essential":true},{"name":"One smart outfit each","category":"Clothing"},{"name":"EU/UK travel adapter","category":"Electronics","essential":true},{"name":"Crossbody anti-theft bag","category":"Gear","essential":true},{"name":"Reusable water bottle","category":"Gear"},{"name":"Museum passes / city card","category":"Documents"},{"name":"Blister plasters","category":"Health"},{"name":"Scarf (for churches)","category":"Clothing"},{"name":"Offline maps downloaded","category":"Electronics","essential":true}]'),
  ('winter-aurora','Winter & Northern Lights Gear','Lapland, Iceland, Tromsø — the sub-zero kit that actually matters.','packing','❄️','arctic','winter',false,5,
   '[{"name":"Thermal base layers ×3","category":"Clothing","essential":true},{"name":"Insulated waterproof parka","category":"Clothing","essential":true},{"name":"Snow trousers","category":"Clothing","essential":true},{"name":"Waterproof insulated boots","category":"Footwear","essential":true},{"name":"Wool socks ×5","category":"Clothing","essential":true},{"name":"Balaclava / neck gaiter","category":"Clothing"},{"name":"Waterproof gloves + liner gloves","category":"Clothing","essential":true},{"name":"Hand & toe warmers","category":"Gear"},{"name":"Crampons / ice grips","category":"Gear","essential":true},{"name":"Tripod for aurora shots","category":"Electronics"},{"name":"Spare camera batteries (cold drains them)","category":"Electronics","essential":true},{"name":"Lip balm & heavy moisturiser","category":"Health"},{"name":"Sunglasses (snow glare)","category":"Clothing"},{"name":"Thermos flask","category":"Gear"}]'),
  ('hiking-adventure','Hiking & Adventure Gear','Alps, Rockies, Highlands — day hikes and multi-day treks.','packing','🥾','mountain','adventure',false,6,
   '[{"name":"Hiking boots (broken in)","category":"Footwear","essential":true},{"name":"25–35L daypack","category":"Gear","essential":true},{"name":"Waterproof shell jacket","category":"Clothing","essential":true},{"name":"Trekking poles","category":"Gear"},{"name":"2L water / hydration bladder","category":"Gear","essential":true},{"name":"Head torch + spare batteries","category":"Gear","essential":true},{"name":"First aid & blister kit","category":"Health","essential":true},{"name":"Offline trail maps (AllTrails/OS)","category":"Electronics","essential":true},{"name":"Energy bars","category":"Food"},{"name":"Emergency bivvy / foil blanket","category":"Gear","essential":true},{"name":"Sun cream & cap","category":"Health"},{"name":"Quick-dry towel","category":"Gear"},{"name":"Whistle","category":"Gear"}]'),
  ('electronics-kit','Electronics & Photo Kit','Everything with a battery, plus the cables you always forget.','packing','🔌',NULL,'any',false,7,
   '[{"name":"Phones + cables","category":"Electronics","essential":true},{"name":"Universal travel adapter","category":"Electronics","essential":true},{"name":"20,000mAh power bank","category":"Electronics","essential":true},{"name":"Camera + spare batteries","category":"Electronics"},{"name":"SD cards & card reader","category":"Electronics"},{"name":"Compact tripod","category":"Electronics"},{"name":"E-reader / tablet","category":"Electronics"},{"name":"Multi-port USB charger","category":"Electronics"},{"name":"Headphone splitter (share a film)","category":"Electronics"},{"name":"eSIM or local SIM plan","category":"Electronics","essential":true}]'),
  ('health-toiletries','Health & Toiletries','Both partners'' medical and personal-care list.','packing','💊',NULL,'any',false,8,
   '[{"name":"Prescription medication + copy of prescription","category":"Health","essential":true},{"name":"Painkillers & anti-inflammatories","category":"Health"},{"name":"Anti-diarrhoeal & rehydration","category":"Health"},{"name":"Motion sickness tablets","category":"Health"},{"name":"Antihistamines","category":"Health"},{"name":"Plasters & antiseptic","category":"Health"},{"name":"Contraception","category":"Health"},{"name":"Contact lenses + spare glasses","category":"Health"},{"name":"Toothbrushes & paste","category":"Toiletries","essential":true},{"name":"Deodorant","category":"Toiletries"},{"name":"Shampoo/conditioner (100ml)","category":"Toiletries"},{"name":"Razor & shaving cream","category":"Toiletries"},{"name":"Hairbrush & ties","category":"Toiletries"},{"name":"Nail clippers & tweezers","category":"Toiletries"}]'),
  ('honeymoon-extras','Honeymoon Extras','The details that make it a honeymoon and not just a holiday.','honeymoon','💍',NULL,'honeymoon',false,9,
   '[{"name":"Marriage certificate copy (for upgrades)","category":"Documents","essential":true},{"name":"Tell every hotel it is your honeymoon","category":"Planning","essential":true},{"name":"Two special-occasion outfits","category":"Clothing"},{"name":"Rings insured & documented","category":"Documents"},{"name":"Surprise gift for your partner","category":"Romance"},{"name":"Printed photo of you both","category":"Romance"},{"name":"Handwritten letters to open mid-trip","category":"Romance"},{"name":"Book the sunset dinner in advance","category":"Planning","essential":true},{"name":"Couples spa treatment booked","category":"Planning"},{"name":"Photographer session booked","category":"Planning"}]'),
  ('pre-departure','72 Hours Before Departure','The admin that stops trips going wrong.','travel','⏰',NULL,'any',false,10,
   '[{"name":"Online check-in completed","category":"Admin","essential":true},{"name":"Seats selected together","category":"Admin"},{"name":"Boarding passes in the vault","category":"Admin","essential":true},{"name":"Airport transfer booked","category":"Admin","essential":true},{"name":"Bank travel notification","category":"Admin"},{"name":"Roaming / eSIM activated","category":"Admin"},{"name":"Home: bins, plants, heating, locks","category":"Home"},{"name":"Someone has your itinerary","category":"Safety","essential":true},{"name":"Bags weighed","category":"Admin"},{"name":"Liquids under 100ml bagged","category":"Admin","essential":true},{"name":"Devices charged","category":"Admin"},{"name":"Currency exchanged","category":"Money"}]'),
  ('weekly-fairness-ritual','Weekly Fairness Ritual','The 20-minute conversation that keeps effort balanced.','relationship','⚖️',NULL,NULL,false,11,
   '[{"name":"Both partners complete this week''s fairness entry","category":"Ritual","essential":true},{"name":"Read each other''s notes without replying yet","category":"Ritual","essential":true},{"name":"Each names one thing the other did well","category":"Ritual"},{"name":"Each names one thing they need more of","category":"Ritual","essential":true},{"name":"Check the balance index together","category":"Ritual"},{"name":"Agree one concrete action for next week","category":"Ritual","essential":true},{"name":"Book the next date night","category":"Ritual"},{"name":"Review shared spending","category":"Ritual"}]'),
  ('date-night-ideas','Date Night Rotation','Alternate who plans it — that is the point.','date_night','🌹',NULL,NULL,false,12,
   '[{"name":"Cook a new recipe together","category":"At home"},{"name":"Phone-free dinner","category":"At home","essential":true},{"name":"Recreate your first date","category":"Out"},{"name":"Sunrise or sunset walk","category":"Out"},{"name":"Live music or comedy","category":"Out"},{"name":"Museum or gallery","category":"Out"},{"name":"Board game & dessert night","category":"At home"},{"name":"Plan the next trip together","category":"At home"},{"name":"Couples massage","category":"Out"},{"name":"Write each other a letter","category":"At home"}]'),
  ('conflict-repair','Conflict Repair Checklist','Work through this before the argument restarts.','relationship','🛠️',NULL,NULL,true,13,
   '[{"name":"Both agree the topic (one issue only)","category":"Repair","essential":true},{"name":"No absolutes: no ''always'' or ''never''","category":"Repair","essential":true},{"name":"Each speaks for 3 minutes uninterrupted","category":"Repair","essential":true},{"name":"Each repeats back what they heard","category":"Repair","essential":true},{"name":"Name the need behind the complaint","category":"Repair"},{"name":"Take a 20-minute break if either is flooded","category":"Repair"},{"name":"Agree one change each","category":"Repair","essential":true},{"name":"Set a date to review it","category":"Repair"},{"name":"Repair gesture (not a purchase)","category":"Repair"}]'),
  ('money-talk','Monthly Money Talk','Financial fairness needs a scheduled conversation.','finance','💸',NULL,NULL,false,14,
   '[{"name":"Review last month''s shared expenses","category":"Money","essential":true},{"name":"Settle who owes whom","category":"Money","essential":true},{"name":"Check the split still matches incomes","category":"Money","essential":true},{"name":"Agree next month''s budget","category":"Money"},{"name":"Review subscriptions","category":"Money"},{"name":"Update travel savings goal","category":"Money"},{"name":"Flag any financial pressure honestly","category":"Money","essential":true}]')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  category = VALUES(category),
  emoji = VALUES(emoji),
  climate = VALUES(climate),
  trip_type = VALUES(trip_type),
  is_premium = VALUES(is_premium),
  sort_order = VALUES(sort_order),
  items = VALUES(items);

-- Every platform setting the admin panel exposes.
INSERT INTO site_settings (setting_key, value, group_name, label, description, is_public, is_secret) VALUES
  ('site_name','"FairCouples"','general','Site name','Shown in the header, emails and page titles.',true,false),
  ('site_tagline','"Fair love, measured."','general','Tagline',NULL,true,false),
  ('site_description','"FairCouples is the relationship fairness platform for couples and families — track emotions, balance effort, split budgets fairly and plan trips together."','general','Meta description','Default meta description for SEO.',true,false),
  ('site_url','"https://faircouples.com"','general','Site URL','Canonical base URL.',true,false),
  ('support_email','"support@faircouples.com"','general','Support email',NULL,true,false),
  ('contact_phone','""','general','Contact phone',NULL,true,false),
  ('company_name','"FairCouples Ltd"','general','Legal company name',NULL,true,false),
  ('company_address','"71-75 Shelton Street, London, WC2H 9JQ, United Kingdom"','general','Registered address',NULL,true,false),
  ('default_currency','"USD"','general','Default currency','Fallback when the country cannot be detected.',true,false),
  ('supported_currencies','["USD","GBP","EUR","CAD","AUD"]','general','Supported currencies',NULL,true,false),
  ('default_locale','"en"','general','Default locale',NULL,true,false),
  ('maintenance_mode','false','general','Maintenance mode','Takes the public site offline for non-admins.',true,false),
  ('signup_enabled','true','general','Allow new signups',NULL,true,false),
  ('require_email_verification','true','general','Require email verification','New accounts must confirm their email before using the app.',true,false),
  ('trial_days','14','general','Default trial length (days)',NULL,true,false),

  ('social_twitter','"https://x.com/faircouples"','social','X / Twitter',NULL,true,false),
  ('social_instagram','"https://instagram.com/faircouples"','social','Instagram',NULL,true,false),
  ('social_facebook','"https://facebook.com/faircouples"','social','Facebook',NULL,true,false),
  ('social_pinterest','"https://pinterest.com/faircouples"','social','Pinterest',NULL,true,false),
  ('social_linkedin','"https://linkedin.com/company/faircouples"','social','LinkedIn',NULL,true,false),
  ('social_tiktok','""','social','TikTok',NULL,true,false),
  ('social_youtube','""','social','YouTube',NULL,true,false),

  ('seo_default_title','"FairCouples — Relationship Fairness, Emotions, Budget & Travel Planner for Couples"','seo','Default title tag',NULL,true,false),
  ('seo_title_template','"%s | FairCouples"','seo','Title template',NULL,true,false),
  ('seo_keywords','["relationship app for couples","fairness in relationships","couples emotion tracker","relationship compatibility test","couples budget app","honeymoon itinerary planner","couples travel checklist","love vs attraction test","shared expense splitter for couples","couples private messaging app"]','seo','Global keywords',NULL,true,false),
  ('seo_default_og_image','"/og"','seo','Default OG image',NULL,true,false),
  ('seo_twitter_handle','"@faircouples"','seo','Twitter handle',NULL,true,false),
  ('seo_robots','"index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"','seo','Default robots directive',NULL,true,false),
  ('seo_google_verification','""','seo','Google Search Console token',NULL,true,false),
  ('seo_bing_verification','""','seo','Bing Webmaster token',NULL,true,false),
  ('seo_yandex_verification','""','seo','Yandex verification token',NULL,true,false),
  ('seo_pinterest_verification','""','seo','Pinterest verification token',NULL,true,false),
  ('seo_sitemap_enabled','true','seo','Generate sitemap.xml',NULL,true,false),
  ('seo_block_indexing','false','seo','No-index the whole site','Emergency switch — blocks all indexing.',true,false),

  ('analytics_ga4_id','""','integrations','Google Analytics 4 ID','e.g. G-XXXXXXXXXX',true,false),
  ('analytics_gtm_id','""','integrations','Google Tag Manager ID','e.g. GTM-XXXXXXX',true,false),
  ('analytics_meta_pixel_id','""','integrations','Meta (Facebook) Pixel ID',NULL,true,false),
  ('analytics_google_ads_id','""','integrations','Google Ads conversion ID','e.g. AW-XXXXXXXXX',true,false),
  ('analytics_google_ads_label','""','integrations','Google Ads conversion label',NULL,true,false),
  ('analytics_adsense_client','""','integrations','AdSense publisher ID','e.g. ca-pub-XXXXXXXXXXXXXXXX',true,false),
  ('analytics_adsense_enabled','false','integrations','Enable AdSense',NULL,true,false),
  ('analytics_adsense_auto_ads','true','integrations','AdSense auto ads',NULL,true,false),
  ('analytics_clarity_id','""','integrations','Microsoft Clarity ID',NULL,true,false),
  ('analytics_hotjar_id','""','integrations','Hotjar site ID',NULL,true,false),
  ('analytics_tiktok_pixel_id','""','integrations','TikTok Pixel ID',NULL,true,false),
  ('analytics_pinterest_tag_id','""','integrations','Pinterest Tag ID',NULL,true,false),
  ('analytics_linkedin_partner_id','""','integrations','LinkedIn Partner ID',NULL,true,false),
  ('cookie_banner_enabled','true','integrations','Cookie consent banner',NULL,true,false),

  ('smtp_host','""','email','SMTP host','e.g. smtp.hostinger.com',false,true),
  ('smtp_port','587','email','SMTP port',NULL,false,true),
  ('smtp_secure','false','email','Use TLS/SSL (port 465)',NULL,false,true),
  ('smtp_user','""','email','SMTP username',NULL,false,true),
  ('smtp_password','""','email','SMTP password',NULL,false,true),
  ('smtp_from_email','"no-reply@faircouples.com"','email','From address',NULL,false,true),
  ('smtp_from_name','"FairCouples"','email','From name',NULL,false,true),
  ('smtp_reply_to','"support@faircouples.com"','email','Reply-to address',NULL,false,true),
  ('email_enabled','true','email','Email sending enabled',NULL,false,true),
  ('email_admin_notifications','true','email','Notify admins of new signups & payments',NULL,false,true),

  ('billing_tax_enabled','false','billing','Collect tax / VAT',NULL,false,false),
  ('billing_tax_rate','0','billing','Default tax rate (%)',NULL,false,false),
  ('billing_invoice_prefix','"FC"','billing','Invoice number prefix',NULL,false,false),
  ('billing_currency_lock','false','billing','Lock currency after signup','Prevents users changing currency once subscribed.',true,false),

  ('feature_ads_on_free','true','features','Show ads on the free plan',NULL,true,false),
  ('feature_blog_enabled','true','features','Blog enabled',NULL,true,false),
  ('feature_referrals_enabled','true','features','Referral programme',NULL,true,false)
ON DUPLICATE KEY UPDATE
  value = VALUES(value),
  group_name = VALUES(group_name),
  label = VALUES(label),
  description = VALUES(description),
  is_public = VALUES(is_public),
  is_secret = VALUES(is_secret);

-- Point the platform at the Hostinger temporary domain.
UPDATE site_settings
   SET value = '"https://grey-opossum-178268.hostingersite.com"'
 WHERE setting_key = 'site_url';

-- Payment gateways. Add your live keys in Admin -> Payments, not here.
INSERT INTO payment_gateways (provider, display_name, is_enabled, mode, credentials, supported_currencies, sort_order, instructions) VALUES
  ('stripe','Stripe (Cards, Apple Pay, Google Pay)', false, 'test',
   '{"publishable_key":"","secret_key":"","webhook_secret":""}',
   '["USD", "GBP", "EUR", "CAD", "AUD"]', 1, 'Add your keys from dashboard.stripe.com → Developers → API keys. Webhook endpoint: /webhook-stripe.php'),
  ('paypal','PayPal', false, 'test',
   '{"client_id":"","client_secret":"","webhook_id":""}',
   '["USD", "GBP", "EUR", "CAD", "AUD"]', 2, 'Create a REST app at developer.paypal.com. Webhook endpoint: /webhook-paypal.php'),
  ('manual','Bank transfer / manual', false, 'live',
   '{"instructions":""}', '["USD", "GBP", "EUR", "CAD", "AUD"]', 3,
   'Admin marks the subscription active after receiving payment.')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  supported_currencies = VALUES(supported_currencies),
  sort_order = VALUES(sort_order),
  instructions = VALUES(instructions);

-- Fallback exchange rates for multi-currency display.
INSERT INTO exchange_rates (base_currency, quote_currency, rate) VALUES
  ('USD','USD',1),('USD','GBP',0.79),('USD','EUR',0.92),('USD','CAD',1.36),('USD','AUD',1.52),
  ('USD','CHF',0.88),('USD','NZD',1.64),('USD','SEK',10.5),('USD','NOK',10.7),('USD','DKK',6.9)
ON DUPLICATE KEY UPDATE
  rate = VALUES(rate);

-- Transactional email templates, editable in Admin -> Emails.
INSERT INTO email_templates (slug, name, subject, description, variables, html_body, text_body) VALUES
  ('welcome','Welcome / verify email','Confirm your email and start your FairCouples journey',
   'Sent immediately after signup with the confirmation link.',
   '["name", "confirm_url", "site_name"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1 style="color:#e11d48">Welcome to {{site_name}}, {{name}} 💗</h1><p>You are one click away from a fairer relationship. Confirm your email address to activate your account.</p><p style="margin:32px 0"><a href="{{confirm_url}}" style="background:#e11d48;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Confirm my email</a></p><p style="color:#64748b;font-size:14px">If the button does not work, paste this link into your browser:<br>{{confirm_url}}</p><p style="color:#64748b;font-size:13px">You are receiving this because an account was created with this address. If it was not you, ignore this email.</p></div>',
   'Welcome to {{site_name}}, {{name}}. Confirm your email: {{confirm_url}}'),
  ('partner-invite','Partner invitation','{{inviter_name}} invited you to their FairCouples space',
   'Sent when a member invites their partner.',
   '["inviter_name", "invite_url", "relationship_type", "message"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1 style="color:#e11d48">{{inviter_name}} invited you 💌</h1><p>You have been invited to join a private FairCouples space. Both of you log your own entries — and both of you see the fairness report.</p><blockquote style="border-left:3px solid #e11d48;padding-left:16px;color:#475569">{{message}}</blockquote><p style="margin:32px 0"><a href="{{invite_url}}" style="background:#e11d48;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Accept the invitation</a></p><p style="color:#64748b;font-size:13px">This invitation expires in 14 days.</p></div>',
   '["{inviter_name}} invited you to FairCouples: {{invite_url}"]'),
  ('password-reset','Password reset','Reset your FairCouples password',
   'Sent when a user requests a password reset.',
   '["name", "reset_url"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1>Reset your password</h1><p>Hi {{name}}, click below to choose a new password. The link expires in 60 minutes.</p><p style="margin:32px 0"><a href="{{reset_url}}" style="background:#0f172a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Set a new password</a></p><p style="color:#64748b;font-size:13px">If you did not request this, no action is needed.</p></div>',
   'Reset your password: {{reset_url}}'),
  ('subscription-active','Subscription activated','Your {{plan_name}} plan is active 🎉',
   'Sent after a successful payment.',
   '["name", "plan_name", "amount", "currency", "next_billing_date", "invoice_url"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1 style="color:#e11d48">You are on {{plan_name}}</h1><p>Thanks {{name}} — your payment of {{amount}} {{currency}} was successful.</p><ul><li>Plan: <strong>{{plan_name}}</strong></li><li>Next billing date: <strong>{{next_billing_date}}</strong></li></ul><p><a href="{{invoice_url}}">View your invoice</a></p><p>Your partner automatically gets full access on your plan — invite them from Settings → Partner.</p></div>',
   'Your {{plan_name}} plan is active. Next billing: {{next_billing_date}}'),
  ('payment-failed','Payment failed','Action needed: your FairCouples payment failed',
   'Sent when a recurring charge fails.',
   '["name", "plan_name", "retry_url"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1>We could not take your payment</h1><p>Hi {{name}}, the charge for your {{plan_name}} plan did not go through. Update your payment method to keep your history and shared data.</p><p style="margin:32px 0"><a href="{{retry_url}}" style="background:#e11d48;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Update payment method</a></p></div>',
   'Payment failed for {{plan_name}}. Update: {{retry_url}}'),
  ('weekly-report','Weekly fairness report','Your fairness report for this week',
   'Weekly digest of both partners'' entries.',
   '["name", "partner_name", "balance_index", "overall_score", "verdict", "report_url"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1>This week with {{partner_name}}</h1><p style="font-size:40px;margin:8px 0;color:#e11d48"><strong>{{balance_index}}</strong><span style="font-size:16px;color:#64748b">/100 balance</span></p><p>Overall fairness score: <strong>{{overall_score}}</strong></p><p>{{verdict}}</p><p style="margin:32px 0"><a href="{{report_url}}" style="background:#0f172a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Open the full report</a></p></div>',
   'Balance index {{balance_index}}/100. Report: {{report_url}}'),
  ('partner-entry','Partner logged an entry','{{partner_name}} added a new entry',
   'Notifies a member when their partner submits emotions or fairness entries.',
   '["name", "partner_name", "entry_type", "link"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>{{partner_name}} just logged {{entry_type}}</h2><p>Open FairCouples to read it and add your side.</p><p><a href="{{link}}">View entry</a></p></div>',
   '["{partner_name}} logged {{entry_type}}: {{link}"]'),
  ('trip-reminder','Trip reminder','Your trip to {{destination}} starts in {{days}} days',
   'Pre-departure reminder with the checklist link.',
   '["name", "destination", "days", "checklist_url"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1>{{destination}} in {{days}} days ✈️</h1><p>Your documents are in the vault and your packing checklist is waiting.</p><p><a href="{{checklist_url}}">Open the checklist</a></p></div>',
   '["{destination}} in {{days}} days. Checklist: {{checklist_url}"]'),
  ('account-removed','Removed from a couple','You were removed from a FairCouples space',
   'Sent when an owner or admin removes a partner.',
   '["name", "couple_name"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>Access to {{couple_name}} has ended</h2><p>Hi {{name}}, you no longer have access to that shared space. Your own private entries remain in your account.</p></div>',
   'You were removed from {{couple_name}}.'),
  ('contact-received','Contact form received','We received your message',
   'Auto-reply for the contact form.',
   '["name"]',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>Thanks {{name}}, we have your message</h2><p>Our team replies within one business day.</p></div>',
   'Thanks {{name}}, we received your message.')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  subject = VALUES(subject),
  description = VALUES(description),
  variables = VALUES(variables),
  html_body = VALUES(html_body),
  text_body = VALUES(text_body);

-- Legal and marketing pages.
INSERT INTO pages (slug, title, page_type, status, show_in_footer, sort_order, meta_title, meta_description, content) VALUES
  ('privacy-policy','Privacy Policy','legal','published',true,1,
   'Privacy Policy — FairCouples',
   'How FairCouples collects, uses, stores and protects your personal and relationship data, including GDPR, UK GDPR and CCPA rights.',
   '## 1. Who we are
FairCouples ("we", "us") operates faircouples.com. We are the data controller for the personal data described in this policy. Contact: privacy@faircouples.com.

## 2. Data we collect
- **Account data:** name, email, password hash, country, currency, locale, timezone.
- **Relationship data:** emotion logs, fairness entries, check-ins, assessments, notes, checklists.
- **Shared content:** messages, photos, uploaded booking documents and tickets.
- **Financial data:** budgets, expenses and settlements you enter. Card details are never stored on our servers — they are handled by Stripe and PayPal.
- **Technical data:** IP address, device, browser, pages viewed, referral source.

## 3. How we use it
To provide the service, compute fairness and compatibility reports, process subscriptions, send transactional email, prevent abuse, and improve the product. We do not sell personal data.

## 4. Legal bases (UK/EU)
Contract (providing the service), legitimate interests (security, product improvement), consent (marketing email, non-essential cookies), and legal obligation (tax and accounting records).

## 5. Sharing with your partner
Entries you mark **private** are never shown to your partner. Everything else in a shared space is visible to both members by design. Removing a partner ends their access immediately.

## 6. Processors
Our hosting provider (database, application and file storage), Stripe and PayPal (payments), our SMTP email provider, and any analytics providers you have consented to.

## 7. International transfers
Data may be processed in the EU, UK and US under Standard Contractual Clauses or an adequacy decision.

## 8. Retention
Account data is kept while your account is active and for 30 days after deletion. Financial records are kept for 7 years where legally required.

## 9. Your rights
Access, rectification, erasure, restriction, portability, objection, and withdrawal of consent. California residents have the right to know, delete, correct and opt out of sale/sharing (we do not sell). Email privacy@faircouples.com — we respond within 30 days.

## 10. Security
Traffic served over HTTPS, application-level isolation so every request is checked against your session and membership before your data is returned, bcrypt-hashed passwords, and fully audited admin access.

## 11. Children
The service is not directed at anyone under 16. We delete such accounts on discovery.

## 12. Changes
Material changes will be announced by email and in-app 14 days before taking effect.'),
  ('terms-of-service','Terms of Service','legal','published',true,2,
   'Terms of Service — FairCouples',
   'The terms governing your use of FairCouples, including subscriptions, cancellations, acceptable use and liability.',
   '## 1. Agreement
By creating an account you agree to these Terms. If you do not agree, do not use the service.

## 2. Eligibility
You must be at least 16 years old and able to form a binding contract.

## 3. Accounts
You are responsible for your credentials and for all activity under your account. One person, one account.

## 4. Shared spaces
A relationship space holds two members. The space owner may remove a partner at any time; removal is immediate and revokes access to shared content. Content created by a removed member remains in the space unless they request deletion.

## 5. Subscriptions and billing
Plans are billed monthly, annually or once (Lifetime), in the currency selected at signup. Prices are shown inclusive of any applicable tax at checkout. Subscriptions renew automatically until cancelled. A paid plan covers both members of a space.

## 6. Trials
Where offered, a free trial converts to a paid subscription at the end of the trial unless cancelled beforehand.

## 7. Cancellation and refunds
Cancel any time from Settings → Billing; access continues until the end of the paid period. We offer a 14-day refund on first purchases. Lifetime purchases are refundable within 14 days of purchase.

## 8. Acceptable use
No harassment, abuse, illegal content, scraping, reverse engineering, or attempts to access another couple''s data. We may suspend accounts that break these rules.

## 9. Not professional advice
FairCouples provides self-reported measurement and educational content. It is not therapy, counselling, legal or financial advice. If you are in danger, contact your local emergency service.

## 10. Intellectual property
We own the platform, brand and content. You own the data you enter, and grant us a licence to process it to run the service.

## 11. Liability
To the maximum extent permitted by law, our aggregate liability is limited to the amount you paid in the 12 months before the claim.

## 12. Governing law
England and Wales, without prejudice to mandatory consumer rights in your country of residence.'),
  ('cookie-policy','Cookie Policy','legal','published',true,3,
   'Cookie Policy — FairCouples',
   'The cookies and similar technologies FairCouples uses, and how to control them.',
   '## Essential cookies
Authentication session, CSRF protection, currency and theme preference. These cannot be disabled.

## Analytics cookies
Google Analytics 4 — aggregated usage, set only after consent.

## Marketing cookies
Meta Pixel, Google Ads and Pinterest tags — set only after consent, used to measure campaigns.

## Advertising
Google AdSense may serve ads on free-plan pages. Paid plans are ad-free.

## Managing cookies
Use the cookie banner or your browser settings. Blocking essential cookies will sign you out.'),
  ('refund-policy','Refund Policy','legal','published',true,4,
   'Refund Policy — FairCouples',
   'Our 14-day money-back guarantee and how to request a refund.',
   '## 14-day guarantee
If FairCouples is not right for you, email billing@faircouples.com within 14 days of your first payment for a full refund.

## Renewals
Renewal charges are refundable within 7 days if the plan was unused in that period.

## Lifetime plans
Refundable within 14 days of purchase.

## Processing
Refunds return to the original payment method within 5–10 business days. PayPal refunds may take longer.'),
  ('gdpr','GDPR & Data Requests','legal','published',true,5,
   'GDPR Compliance — FairCouples',
   'How to exercise your GDPR and UK GDPR rights with FairCouples.',
   '## Your rights
Access, rectification, erasure, restriction, portability, objection and withdrawal of consent.

## Export your data
Settings → Privacy → Export gives you a machine-readable archive of everything you have entered.

## Delete your account
Settings → Privacy → Delete account. Shared entries are anonymised; your private entries are erased. Financial records required by law are retained.

## Data Protection Officer
dpo@faircouples.com'),
  ('acceptable-use','Acceptable Use Policy','legal','published',true,6,
   'Acceptable Use Policy — FairCouples',
   'What is and is not allowed on FairCouples.',
   '## Not allowed
Harassment or abuse of a partner through the platform, uploading illegal content, impersonation, sharing another person''s private data, automated scraping, security testing without written permission, or reselling access.

## Enforcement
We investigate reports and may warn, suspend or terminate accounts. Serious cases are reported to the relevant authorities.

## Reporting
abuse@faircouples.com'),
  ('disclaimer','Disclaimer','legal','published',true,7,
   'Disclaimer — FairCouples',
   'FairCouples provides measurement and education, not therapy or professional advice.',
   'FairCouples scores are generated from self-reported answers. They describe patterns; they do not diagnose relationships or predict outcomes. Nothing on this site is therapy, medical, legal or financial advice.

If you are experiencing abuse, contact your local emergency number or a domestic abuse helpline immediately.'),
  ('about','About FairCouples','marketing','published',true,8,
   'About FairCouples — Why fairness beats guesswork',
   'FairCouples was built on one idea: relationships fail on imbalance long before they fail on love. Here is how we measure it.',
   '## Why we built this
Most couples argue about the same thing in different words: **effort that stopped being equal**. One person plans, remembers, apologises and pays more often than the other — and nobody notices until resentment has already set in.

FairCouples turns that invisible imbalance into something both people can see. Each partner answers for themselves, privately. The platform compares the two sides and shows where effort, respect and loyalty are drifting apart.

## The fairness formula
> Effort (Partner A) ≈ Effort (Partner B)
> Respect (A) = Respect (B)
> Loyalty (A) = Loyalty (B)

A perfect 50/50 does not exist on any given day. Some days one gives 70% and the other 30%. Over weeks, it should average out. If one person is *always* giving more, that is the signal we surface.

## Not just for couples
Any two-person relationship works: partners, spouses, a mother and son, siblings, close friends. Both people enter their own view, even from opposite sides of the world, and both see the same report.

## Love or attraction?
Our assessment separates the two: attraction is intensity, love is consistency. The report tells you which one your data actually describes.')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  page_type = VALUES(page_type),
  status = VALUES(status),
  show_in_footer = VALUES(show_in_footer),
  sort_order = VALUES(sort_order),
  meta_title = VALUES(meta_title),
  meta_description = VALUES(meta_description),
  content = VALUES(content);

-- Blog categories.
INSERT INTO blog_categories (slug, name, description, sort_order) VALUES
  ('relationships','Relationships','Fairness, effort and the mechanics of staying together.',1),
  ('emotions','Emotions','Naming, tracking and communicating what you feel.',2),
  ('money','Money & Fairness','Splitting expenses without splitting up.',3),
  ('travel','Couples Travel','Honeymoons, itineraries and packing that does not start a fight.',4),
  ('guides','Guides','Step-by-step playbooks for couples.',5)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

-- Blog posts.
INSERT INTO blog_posts
  (slug, title, excerpt, category_id, author_name, status, is_featured,
   reading_minutes, tags, keywords, meta_title, meta_description, published_at, content)
SELECT v.slug, v.title, v.excerpt, c.id, 'FairCouples Team', 'published', v.featured,
       v.minutes, v.tags, v.keywords, v.meta_title, v.meta_desc,
       DATE_SUB(NOW(), INTERVAL v.age DAY), v.content
  FROM (
  SELECT 'is-it-love-or-attraction' AS slug, 'Love or Attraction? The 9 Signals That Tell You Apart' AS title, 'Attraction is intensity. Love is consistency. Here is how to tell which one you are actually in — using evidence, not feelings.' AS excerpt, 'relationships' AS cat, true AS featured, 9 AS minutes, '["love","attraction","compatibility"]' AS tags, '["love vs attraction","is it love or just attraction","signs of real love","attraction vs love test"]' AS keywords, 'Love or Attraction? 9 Signals That Tell Them Apart (2026 Guide)' AS meta_title, 'Attraction is intensity; love is consistency. Nine evidence-based signals — plus a free test — to tell whether your relationship is love or just chemistry.' AS meta_desc, 2 AS age, 'Attraction arrives instantly and asks nothing of you. Love arrives slowly and asks for everything. Most people cannot tell them apart in the first year, because the early symptoms are identical: obsession, energy, the phone in your hand at 2am.

Here is the practical difference. **Attraction is measured in peaks. Love is measured in averages.**

## 1. What happens when it is boring
Attraction needs stimulation — new places, new tension, the chase. Love survives a Tuesday with nothing planned.

## 2. Who you are when they are inconvenient
Attraction disappears the week your partner is ill, stressed or unattractive. Love shows up anyway, without an audience.

## 3. Whether effort is mutual
Attraction happily runs one-sided for months. Love notices imbalance and corrects it. This is the single most predictive signal, and the reason FairCouples measures effort on both sides separately.

## 4. How conflict ends
Attraction ends conflict by winning or by silence. Love ends conflict by repairing.

## 5. Whether you can be unimpressive
If you cannot be tired, wrong or plain in front of them, it is performance — not intimacy.

## 6. The future test
Attraction avoids concrete plans. Love makes them: dates, money, cities, timelines.

## 7. Jealousy vs security
Attraction guards. Love trusts and verifies through consistency, not surveillance.

## 8. What they do with your bad news
Attraction changes the subject. Love asks a second question.

## 9. The 12-week average
Track how you both actually behaved for twelve weeks. Attraction shows spikes and collapses. Love shows a stable line that recovers fast after dips.

## Measure it instead of guessing
Log your own entries for six weeks. Have your partner do the same, independently. Then compare the two curves. If effort, respect and loyalty are within roughly 15 points of each other and recover after conflict — that is love with structure. If one line is permanently higher, you have found the problem before it found you.' AS content
  UNION ALL SELECT 'fair-relationship-checklist', 'The Fair Relationship Checklist: 10 Areas Both Partners Must Score', 'The complete fairness framework — ten areas, thirty behaviours, and the rule that keeps each one honest.', 'guides', true, 12, '["fairness","checklist","framework"]', '["fair relationship checklist","relationship fairness","equal relationship rules","relationship balance"]', 'The Fair Relationship Checklist — 10 Areas Both Partners Must Score', 'A complete, printable fairness framework: emotional connection, communication, respect, trust, money, time, conflict, affection, growth and deal breakers.', 5, 'A healthy relationship is not just love and it is not just attraction. It is **structure + effort + respect + consistency**. Here is the structure, in ten areas. Score each one honestly — and have your partner score it separately, without seeing your answers first.

## 1. 🤝 Emotional Connection
Listen without interrupting. Validate feelings instead of dismissing them. Share real thoughts. Stay emotionally available.
**Fair rule:** no one should always be the "strong one" — both get to be vulnerable.

## 2. 💬 Communication System
Daily check-ins. One deeper conversation a week. No silent treatment. No shouting.
**Fair rule:** if one raises a concern, the other must take it seriously — not ignore or delay.

## 3. ❤️ Respect & Boundaries
Personal space, friends and hobbies respected. No phone checking, no restrictions. Privacy is mutual.
**Fair rule:** freedom should be equal — not one controlling the other.

## 4. 🧠 Trust & Loyalty
No cheating, physical or emotional. Transparency about what matters. Consistency between words and actions.
**Fair rule:** trust is built by both — broken by one, but it affects both.

## 5. 💸 Financial Fairness
Split expenses equally, or balance them by income. No financial pressure on one side. Gifts are mutual, not expected in one direction.
**Fair rule:** effort matters more than money — both contribute fairly.

## 6. 👫 Time & Attention
Quality time, not just texting. Prioritise each other without losing individuality.
**Fair rule:** no one should feel ignored or like an option.

## 7. ⚖️ Conflict Management
No blaming, no "you always" or "you never". Solve, do not win. Take a break when emotions are high.
**Fair rule:** problem vs partner — fight the issue, not each other.

## 8. 💕 Affection & Care
Compliments and appreciation out loud. Physical affection at a comfortable level for both. Support in hard times.
**Fair rule:** love should be shown, not assumed.

## 9. 🎯 Growth & Future Alignment
Career, marriage and lifestyle goals discussed openly. Ambitions actively supported.
**Fair rule:** do not hold each other back — grow together, or separate clearly.

## 10. 🚫 Deal Breakers
No abuse of any kind. No manipulation or gaslighting. No repeated dishonesty.
**Fair rule:** standards apply equally — no double standards.

## The reality check
A perfect 50/50 does not exist daily. Some days one gives 70% and the other 30% — over time it should average out. If one person is *always* giving more, it stops being a relationship and becomes a service.'
  UNION ALL SELECT 'splitting-money-fairly', 'Splitting Money Fairly When You Earn Different Amounts', 'Equal is not always fair. The proportional split, the three-account system, and how to run a money talk that does not become an argument.', 'money', false, 8, '["budget","money","fairness"]', '["splitting bills by income","couples budget split","proportional expense split","fair money split couples"]', 'Splitting Money Fairly When You Earn Different Amounts (Calculator Inside)', 'Equal splits punish the lower earner. Learn the proportional method, the three-account system and a monthly money-talk script that prevents resentment.', 9, 'Two people earning £2,000 and £5,000 a month splitting rent 50/50 are not splitting fairly — they are splitting identically, which is a different thing.

## The proportional method
Add both incomes. Work out each person''s share of the total. Apply that percentage to shared costs.

- Partner A: £2,000 → 28.6%
- Partner B: £5,000 → 71.4%
- Rent £1,400 → A pays £400, B pays £1,000

Both are left with the same *proportion* of free income, which is what fairness actually means.

## The three-account system
1. **Joint account** — rent, bills, food, shared travel. Both pay in by percentage.
2. **Personal accounts** — whatever is left is yours, unquestioned.
3. **Shared savings** — trips and goals, also by percentage.

No permission-asking, no scorekeeping, no resentment.

## Gifts are not expenses
Gift expectations should be mutual and roughly symmetrical in *effort*, not in price. A £30 gift from the lower earner is worth more than a £150 gift from the higher earner.

## The monthly money talk
Twenty minutes, same day each month:
1. Review last month''s shared spending together.
2. Settle who owes whom.
3. Check the split still matches current incomes.
4. Each person names one financial pressure honestly.
5. Agree next month''s number.

Track it, do not remember it. Memory is biased toward the person doing the remembering.'
  UNION ALL SELECT 'honeymoon-destinations-2026', '25 Best Honeymoon Destinations for 2026, Ranked by Season and Budget', 'Where to go, when to go and what a week actually costs — from £900 in Portugal to £6,000 in the Maldives.', 'travel', true, 14, '["honeymoon","destinations","travel"]', '["best honeymoon destinations 2026","honeymoon ideas","cheap honeymoon destinations","europe honeymoon"]', '25 Best Honeymoon Destinations 2026 — Ranked by Season & Budget', 'The 25 best honeymoon destinations for 2026 with real daily costs, best months to travel and a ready-made itinerary for each.', 14, 'The best honeymoon is the one that matches your season, your budget and your energy level — in that order.

## Luxury island (Nov–Apr)
**Maldives** — overwater villas, house reefs, total privacy. ~$430/day.
**Mauritius** — lagoons plus hiking, better value than the Maldives. ~$215/day.
**Bora Bora** — the benchmark, if the budget allows.

## Europe in shoulder season (May–Jun, Sep–Oct)
**Santorini** — caldera sunsets and infinity pools. ~$215/day.
**Amalfi Coast** — cliffside villages, boat days to Capri. ~$210/day.
**Lake Como** — villas and ferries under the Alps. ~$205/day.
**Paris** — still the best three days in Europe. ~$195/day.
**Lake Bled** — an island church in an alpine lake, half the price. ~$125/day.
**Algarve, Portugal** — cliffs and caves from ~$120/day.
**Prague & Budapest** — the best-value romantic weekends on the continent, under $115/day.

## Adventure honeymoons
**Iceland** — waterfalls, ice lagoons, aurora. ~$245/day.
**Norwegian fjords** — Flåm railway, Nærøyfjord. ~$235/day.
**Banff & Lake Louise** — turquoise glacier lakes. ~$195/day.
**Queenstown, New Zealand** — adventure plus vineyards. ~$195/day.
**Scottish Highlands** — castles and single-track roads. ~$165/day.

## Winter and aurora (Dec–Mar)
**Finnish Lapland** — glass igloos and husky safaris. ~$225/day.
**Tromsø, Norway** — the most reliable aurora latitude. ~$230/day.
**Quebec City** — a walled French old town in snow. ~$165/day.

## Long-haul value (Nov–Mar)
**Bali** — rice terraces, cliff temples, private-pool villas from ~$85/day.
**Phuket & Phi Phi** — limestone islands from ~$95/day.
**Riviera Maya** — cenotes, ruins and Caribbean water from ~$150/day.

## Classic USA
**Maui** — Road to Hana and volcano sunrises. ~$320/day.
**California Coast** — Highway 1, Big Sur, Napa. ~$250/day.
**Charleston** — the most romantic small city in America. ~$195/day.

## Culture-first
**Kyoto** — ryokan evenings and temples at dawn. ~$175/day.
**Cape Town & the Winelands** — safari, wine and coast in one trip. ~$125/day.

## Then build the itinerary
Pick the destination, set the dates, and let the itinerary generator lay out each day around your pace. Upload the flight and hotel confirmations to the vault so both of you have them offline — and split the cost fairly in the shared budget.'
  UNION ALL SELECT 'travel-packing-checklist-couples', 'The Complete Couples Travel Checklist (Documents, Gear, Every Climate)', 'Eleven checklists covering documents, carry-on, beach, city, winter, hiking, electronics, health and the 72-hour pre-departure admin.', 'travel', false, 11, '["packing","checklist","travel"]', '["couples packing list","travel checklist","honeymoon packing list","what to pack for europe"]', 'The Complete Couples Travel Checklist 2026 — Every Climate & Trip Type', 'Eleven ready-to-use packing and travel checklists for couples: documents, carry-on, beach, city, winter aurora, hiking, electronics, health and pre-departure.', 18, 'Packing arguments are almost never about the packing. They are about one person carrying the mental load of remembering. Assign items to each partner instead — that is what these checklists do.

## Non-negotiable documents
Passports with six months validity, visa or ESTA/ETA, printed **and** digital tickets, hotel confirmations, insurance policy, two cards on different networks, and copies of all of it stored in a shared vault you can reach without signal.

## Carry-on
Passports, phone and cable, power bank under 100Wh, medication in original packaging, one change of clothes, toothbrush, neck pillow, empty water bottle, and a pen for landing cards.

## Beach and tropical
Three swimwear sets each, reef-safe SPF 50, after-sun, wide-brim hat, cover-ups, water shoes, dry bag, waterproof phone case, DEET 30%+ repellent, two smart dinner outfits, rehydration sachets.

## Europe city break
Broken-in walking shoes, layerable jacket, compact umbrella, one smart outfit each, EU/UK adapter, anti-theft crossbody bag, blister plasters, a scarf for churches, offline maps downloaded.

## Winter and aurora
Thermal base layers, insulated waterproof parka, snow trousers, insulated boots, wool socks, liner + outer gloves, hand warmers, ice grips, tripod, **spare camera batteries** (cold kills them), thermos.

## Hiking
Boots, 25–35L daypack, shell jacket, poles, 2L water, head torch, first aid and blister kit, offline trail maps, emergency bivvy, whistle.

## 72 hours before
Check in online, pick seats together, save boarding passes offline, book the airport transfer, notify your bank, activate roaming or eSIM, sort the house, send your itinerary to someone at home, weigh the bags.

Assign every line to one partner. The person who packs the chargers is not automatically the person who packs the passports.'
  UNION ALL SELECT 'weekly-relationship-check-in', 'The 20-Minute Weekly Check-In That Prevents 80% of Arguments', 'A structured script both partners can follow — including what to do when one of you does not want to talk.', 'guides', false, 7, '["communication","ritual","checkin"]', '["weekly relationship check in","couples communication exercise","relationship check in questions"]', 'The 20-Minute Weekly Relationship Check-In (Script Included)', 'A proven 20-minute weekly check-in script for couples: appreciation, one concern each, fairness review and a concrete action for the week.', 22, 'Most couples do not need more communication. They need *scheduled* communication, so problems are raised at 8pm on Sunday instead of 1am mid-argument.

## The script
**Minutes 0–3 — Appreciation.** Each person names one specific thing the other did this week. Specific. "You handled the call with my mother" beats "you were nice".

**Minutes 3–8 — One concern each.** One only. No absolutes, no "you always". Format: *"When X happened, I felt Y, and what I need is Z."*

**Minutes 8–12 — Repeat it back.** Each person summarises what the other said before responding. If the summary is wrong, the other tries again.

**Minutes 12–16 — Fairness review.** Open the balance index. Who carried more this week? Was that fair given circumstances, or is it becoming a pattern?

**Minutes 16–20 — One action each, plus the calendar.** One concrete change each, and the next date night booked in the calendar before you stand up.

## When one partner refuses
Do not chase. Say: "I''m doing mine at 8pm Sunday. It''s open if you want it." Then log your own entry anyway. A one-sided record is still evidence — and after four weeks, the pattern is no longer deniable by either of you.

## Why the timer matters
Twenty minutes is short enough that neither of you dreads it, and long enough to reach the real thing. Long enough to fix; short enough to repeat every week for a decade.'
  ) v
  JOIN blog_categories c ON c.slug = v.cat
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  excerpt = VALUES(excerpt),
  content = VALUES(content),
  tags = VALUES(tags),
  keywords = VALUES(keywords),
  meta_title = VALUES(meta_title),
  meta_description = VALUES(meta_description);

-- SEO metadata for the key public routes.
INSERT INTO seo_meta (path, title, description, keywords, priority, changefreq) VALUES
  ('/','FairCouples — A Private Space to Love, Understand & Grow Together',
   'FairCouples is a private space for two people to love, understand, remember and grow together — daily feelings, little love notes, Open-when letters, your shared story, fair budgeting and travel planning, with a fairness engine that helps you notice what needs care. Free forever plan.',
   '["relationship app for couples", "couples app", "love and care app", "open when letters", "couples memory timeline", "relationship fairness", "couples emotion tracker", "long distance couples app"]',1.0,'daily'),
  ('/pricing','Pricing — FairCouples Plans in USD, GBP, EUR, CAD & AUD',
   'Simple pricing for couples. One subscription covers both partners. Free forever plan, 14-day trial on paid plans, cancel any time.',
   '["couples app pricing", "relationship app subscription", "faircouples pricing"]',0.9,'weekly'),
  ('/features','Features — Fairness Scoring, Emotions, Messaging, Budgets & Travel',
   'Every FairCouples feature: the 10-area fairness framework, emotion tracking for both partners, private messaging, fair expense splitting, gift planner, ticket vault and itinerary generator.',
   '["couples app features", "relationship tracker", "fair expense split", "couples itinerary generator"]',0.9,'weekly'),
  ('/destinations','Honeymoon & Couples Travel Destinations — Costs, Seasons and Itineraries',
   'Browse honeymoon and couples destinations across Europe, the USA, Canada, Australia and beyond, with daily costs, best months and ready-made itineraries.',
   '["honeymoon destinations", "couples travel guide", "best places for couples", "europe honeymoon"]',0.9,'weekly'),
  ('/fairness','The Fairness Framework — 10 Areas Every Relationship Is Measured On',
   'The complete fairness framework used by FairCouples: ten areas, thirty behaviours and the fair rule that keeps each one honest.',
   '["relationship fairness", "fair relationship checklist", "equal relationship"]',0.8,'monthly'),
  ('/love-or-attraction','Love or Attraction Test — Free Assessment for Couples',
   'Take the free Love vs Attraction assessment. Answer independently from your partner and see whether your relationship is built on consistency or intensity.',
   '["love vs attraction test", "is it love or attraction", "relationship test free"]',0.8,'monthly'),
  ('/blog','FairCouples Blog — Fairness, Emotions, Money and Couples Travel',
   'Guides on relationship fairness, emotional communication, splitting money without resentment and planning trips as a couple.',
   '["relationship blog", "couples advice", "fair relationship guides"]',0.7,'daily')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  keywords = VALUES(keywords),
  priority = VALUES(priority),
  changefreq = VALUES(changefreq);

-- Feature flags.
INSERT INTO feature_flags (flag_key, name, description, is_enabled) VALUES
  ('itinerary_generator','Itinerary generator','Day-by-day itinerary builder from destination attractions.',true),
  ('love_assessment','Love vs Attraction assessment','Free public assessment plus in-app version.',true),
  ('referrals','Referral programme','Give a month, get a month.',false),
  ('ai_insights','AI insights','Narrative summaries on fairness reports.',false),
  ('public_blog','Public blog','Marketing blog on the public site.',true)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_enabled = VALUES(is_enabled);

-- FAQ entries. These also feed the FAQPage schema on the public pages.
INSERT IGNORE INTO faqs (question, answer, category, page_path, sort_order) VALUES
  ('What exactly does FairCouples measure?','Ten areas of a relationship — emotional connection, communication, respect and boundaries, trust and loyalty, financial fairness, time and attention, conflict management, affection and care, growth and future alignment, and deal breakers. Each partner scores themselves and their partner separately, and the platform compares the two.','product','/',1),
  ('Do both partners need their own account?','Yes, and that is the point. Each person logs their own entries privately, from anywhere in the world. The reports combine both sides — one person cannot fill in the relationship for two.','product','/',2),
  ('Can my partner see everything I write?','No. Any entry marked private stays visible only to you, while still counting in your own trend data. Everything else in a shared space is visible to both of you by design.','privacy','/',3),
  ('Does one subscription cover both partners?','Yes. When one partner subscribes, both members of the space get the full plan features. You never pay twice.','billing','/pricing',4),
  ('Which currencies can I pay in?','US dollars, British pounds, euros, Canadian dollars and Australian dollars. You choose your currency at signup and prices are shown in it everywhere.','billing','/pricing',5),
  ('What payment methods do you accept?','All major cards, Apple Pay and Google Pay through Stripe, plus PayPal. Payment details never touch our servers.','billing','/pricing',6),
  ('Is there a free plan?','Yes. The Starter plan is free forever and includes daily emotion check-ins, weekly fairness scoring, one relationship space and a shared checklist.','billing','/pricing',7),
  ('Can I cancel any time?','Yes, from Settings → Billing. You keep access until the end of your paid period, and there is a 14-day money-back guarantee on first purchases.','billing','/pricing',8),
  ('Does this work for relationships that are not romantic?','Yes. A space works for any two people — partners, spouses, a mother and son, siblings or close friends. The fairness framework applies to any relationship where effort should be balanced.','product','/',9),
  ('Can we use it long-distance?','That is the most common use. Both partners log entries independently from different countries and time zones; both see the same report.','product','/',10),
  ('Is my data secure?','Every couple''s space is isolated: each request is checked against your session and your membership before any of your data is returned, and private notes stay private to whoever wrote them. Traffic is served over HTTPS and every admin action is audited.','privacy','/',11),
  ('Is this therapy?','No. FairCouples is a measurement and planning tool, not therapy or counselling. It helps you see patterns clearly — what you do with them is your decision.','product','/',12),
  ('What happens if we break up?','You can remove your partner from the space at any time; their access ends immediately. You can also export or permanently delete your data from Settings → Privacy.','privacy','/',13),
  ('How does the travel planner work?','Pick a destination from our guides, set your dates and pace, and the itinerary generator lays out each day. Upload flight, hotel and attraction tickets to the vault so both of you have them offline, and split the costs fairly in the shared budget.','travel','/features',14);

-- Testimonials shown on the marketing pages.
INSERT IGNORE INTO testimonials (author_name, author_role, author_location, quote, rating, is_featured, sort_order) VALUES
  ('Sarah & James','Married 6 years','Manchester, UK','We stopped arguing about who does more and started looking at the chart instead. Turns out we were both right about different weeks.',5,true,1),
  ('Michael & Ana','Long-distance','Toronto → Lisbon','Two countries, six hours apart. The weekly report is the only place we both see the same version of our relationship.',5,true,2),
  ('Priya & Dev','Engaged','Austin, USA','The money split feature ended a two-year argument in one evening. Proportional, not equal — that was the whole fix.',5,true,3),
  ('Elena & Marco','Together 3 years','Milan, Italy','The Love vs Attraction assessment was uncomfortable and completely accurate. We needed that.',5,true,4),
  ('Hannah & Tom','Honeymoon planning','Sydney, Australia','Planned a 14-day Italy honeymoon in one sitting, with every booking in one place and the costs split fairly.',5,true,5),
  ('Grace & her mother Ruth','Family space','Vancouver, Canada','We use it as mother and daughter. Being able to write our own entries separately and then read each other''s changed how we talk.',5,true,6);

-- ============================================================================

-- ---------------------------------------------------------------------------
-- LOVE & CARE — the emotional layer (also in database/mysql/love-care.sql)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS love_moods (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id  CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  mood_date  DATE NOT NULL,
  feeling    VARCHAR(40) NOT NULL,
  need       VARCHAR(40) NULL,
  note       VARCHAR(280) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY love_moods_day_unique (user_id, mood_date),
  KEY love_moods_couple_idx (couple_id, mood_date),
  CONSTRAINT love_moods_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS love_notes (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id    CHAR(36) NOT NULL,
  sender_id    CHAR(36) NOT NULL,
  recipient_id CHAR(36) NOT NULL,
  note_type    VARCHAR(40) NOT NULL,
  message      VARCHAR(280) NULL,
  is_read      TINYINT(1) NOT NULL DEFAULT 0,
  read_at      DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY love_notes_recipient_idx (recipient_id, is_read),
  KEY love_notes_couple_idx (couple_id, created_at),
  CONSTRAINT love_notes_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS open_when_letters (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id    CHAR(36) NOT NULL,
  author_id    CHAR(36) NOT NULL,
  recipient_id CHAR(36) NOT NULL,
  occasion     VARCHAR(60) NOT NULL,
  title        VARCHAR(160) NULL,
  body         MEDIUMTEXT NOT NULL,
  opened_at    DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY open_when_couple_idx (couple_id),
  KEY open_when_recipient_idx (recipient_id, occasion),
  CONSTRAINT open_when_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS story_milestones (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id    CHAR(36) NOT NULL,
  created_by   CHAR(36) NOT NULL,
  title        VARCHAR(160) NOT NULL,
  happened_on  DATE NULL,
  description  TEXT NULL,
  emoji        VARCHAR(8) NULL,
  location     VARCHAR(160) NULL,
  image_bucket VARCHAR(40) NULL,
  image_path   VARCHAR(255) NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY story_couple_idx (couple_id, happened_on),
  CONSTRAINT story_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gratitude_notes (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id  CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY gratitude_couple_idx (couple_id, created_at),
  CONSTRAINT gratitude_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bucket_list_items (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id  CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  category   VARCHAR(40) NULL,
  emoji      VARCHAR(8) NULL,
  is_done    TINYINT(1) NOT NULL DEFAULT 0,
  done_at    DATETIME NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY bucket_couple_idx (couple_id, is_done),
  CONSTRAINT bucket_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FINAL STEP — make yourself an administrator.
-- Sign up in the app first, then run this with your own email address.
-- ============================================================================
-- UPDATE profiles SET role = 'superadmin' WHERE email = 'you@example.com';

-- ---------------------------------------------------------------------------
-- LOVE & CARE (emotional layer) — see database/mysql/love-care.sql
-- ---------------------------------------------------------------------------
