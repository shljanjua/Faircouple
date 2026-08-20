-- ============================================================================
-- FairCouples — Love Language tool + Date Night generator (Phase 2)
--
-- Safe to run on an existing database: CREATE TABLE IF NOT EXISTS only adds
-- what is missing. Also included in faircouples-mysql.sql for fresh installs.
--
--   hPanel -> phpMyAdmin -> select your database -> Import -> this file -> Go.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Each partner's love-language profile (one row per person), scored 1–5.
CREATE TABLE IF NOT EXISTS love_languages (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id     CHAR(36) NOT NULL,
  user_id       CHAR(36) NOT NULL,
  words         TINYINT NOT NULL DEFAULT 3,
  quality_time  TINYINT NOT NULL DEFAULT 3,
  acts          TINYINT NOT NULL DEFAULT 3,
  gifts         TINYINT NOT NULL DEFAULT 3,
  physical      TINYINT NOT NULL DEFAULT 3,
  current_focus VARCHAR(40) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY love_languages_user_unique (user_id),
  KEY love_languages_couple_idx (couple_id),
  CONSTRAINT love_languages_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Saved date-night plans (the generator's output the couple chose to keep).
CREATE TABLE IF NOT EXISTS date_nights (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id   CHAR(36) NOT NULL,
  created_by  CHAR(36) NOT NULL,
  title       VARCHAR(160) NOT NULL,
  mood        VARCHAR(40) NULL,
  location    VARCHAR(20) NULL,
  budget      INT NULL,
  minutes     INT NULL,
  plan        JSON NULL,
  is_favorite TINYINT(1) NOT NULL DEFAULT 0,
  is_done     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY date_nights_couple_idx (couple_id, created_at),
  CONSTRAINT date_nights_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
