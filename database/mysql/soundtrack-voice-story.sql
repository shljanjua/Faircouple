-- ============================================================================
-- FairCouples — Our Soundtrack + Voice Notes + Storybook (Phase 3, no AI)
--
-- Safe to run on an existing database: the statements below only add tables
-- that are missing. Also included in faircouples-mysql.sql for fresh installs.
--
--   hPanel -> phpMyAdmin -> select your database -> Import -> this file -> Go.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- The couple's soundtrack — songs tied to moments.
CREATE TABLE IF NOT EXISTS soundtrack_songs (
  id         CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id  CHAR(36) NOT NULL,
  added_by   CHAR(36) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  artist     VARCHAR(200) NULL,
  moment     VARCHAR(40) NULL,
  url        VARCHAR(500) NULL,
  note       VARCHAR(280) NULL,
  is_anthem  TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY soundtrack_couple_idx (couple_id, created_at),
  CONSTRAINT soundtrack_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Voice notes recorded in the browser and left for the partner.
CREATE TABLE IF NOT EXISTS voice_notes (
  id               CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id        CHAR(36) NOT NULL,
  sender_id        CHAR(36) NOT NULL,
  recipient_id     CHAR(36) NOT NULL,
  title            VARCHAR(200) NULL,
  audio_bucket     VARCHAR(40) NOT NULL,
  audio_path       VARCHAR(255) NOT NULL,
  audio_mime       VARCHAR(60) NULL,
  duration_seconds INT NULL,
  is_read          TINYINT(1) NOT NULL DEFAULT 0,
  read_at          DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY voice_notes_recipient_idx (recipient_id, is_read),
  KEY voice_notes_couple_idx (couple_id, created_at),
  CONSTRAINT voice_notes_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The Storybook — written, co-authored chapters of the couple's story.
CREATE TABLE IF NOT EXISTS story_chapters (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id    CHAR(36) NOT NULL,
  author_id    CHAR(36) NOT NULL,
  title        VARCHAR(200) NOT NULL,
  prompt_key   VARCHAR(60) NULL,
  body         MEDIUMTEXT NULL,
  image_bucket VARCHAR(40) NULL,
  image_path   VARCHAR(255) NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY story_chapters_couple_idx (couple_id, sort_order),
  CONSTRAINT story_chapters_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
