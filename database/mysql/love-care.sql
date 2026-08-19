-- ============================================================================
-- FairCouples — "Love & Care" tables (Phase 1 emotional layer)
--
-- Adds the emotional-experience features that sit on top of the fairness
-- engine: a daily feeling + need, little love notes, "Open when…" letters,
-- the Our Story timeline, daily gratitude and a shared bucket list.
--
-- Safe to run on an existing database: every table uses CREATE TABLE IF NOT
-- EXISTS, so importing this file only adds what is missing. These tables are
-- also included in faircouples-mysql.sql, so a fresh install already has them.
--
--   hPanel -> phpMyAdmin -> select your database -> Import -> this file -> Go.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- One feeling + need per person per day (upserted).
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

-- "Send a little love" — one-tap affection notes.
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

-- "Open when…" letters — written once, opened by the partner when it fits.
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

-- Our Story — a beautiful, ordered timeline of milestones.
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

-- Daily gratitude — "today I'm grateful for you because…".
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

-- Shared bucket list — things to do together.
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

SET FOREIGN_KEY_CHECKS = 1;
