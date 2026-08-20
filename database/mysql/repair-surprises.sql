-- ============================================================================
-- FairCouples — Conflict Repair + Surprise Mode (Phase 3, no AI)
--
-- Safe to run on an existing database: the statements below only add tables
-- that are missing. These are also included in faircouples-mysql.sql, so a
-- fresh install already has them.
--
--   hPanel -> phpMyAdmin -> select your database -> Import -> this file -> Go.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- A single disagreement the couple is working through.
CREATE TABLE IF NOT EXISTS conflict_repairs (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id   CHAR(36) NOT NULL,
  started_by  CHAR(36) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  status      ENUM('open','resolved') NOT NULL DEFAULT 'open',
  resolved_at DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY conflict_repairs_couple_idx (couple_id, status),
  CONSTRAINT conflict_repairs_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Each partner's own side of a repair (the five guided steps). One per person.
CREATE TABLE IF NOT EXISTS repair_reflections (
  id              CHAR(36) NOT NULL DEFAULT (UUID()),
  repair_id       CHAR(36) NOT NULL,
  couple_id       CHAR(36) NOT NULL,
  user_id         CHAR(36) NOT NULL,
  what_happened   TEXT NULL,
  how_felt        TEXT NULL,
  what_needed     TEXT NULL,
  wish_understood TEXT NULL,
  do_differently  TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY repair_reflections_unique (repair_id, user_id),
  KEY repair_reflections_couple_idx (couple_id),
  CONSTRAINT repair_reflections_repair_fk FOREIGN KEY (repair_id) REFERENCES conflict_repairs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The warm "repair together" gestures exchanged during a repair.
CREATE TABLE IF NOT EXISTS repair_responses (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  repair_id     CHAR(36) NOT NULL,
  couple_id     CHAR(36) NOT NULL,
  user_id       CHAR(36) NOT NULL,
  response_type VARCHAR(30) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY repair_responses_repair_idx (repair_id),
  CONSTRAINT repair_responses_repair_fk FOREIGN KEY (repair_id) REFERENCES conflict_repairs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A scheduled secret surprise, sealed until its reveal time.
CREATE TABLE IF NOT EXISTS surprises (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id     CHAR(36) NOT NULL,
  sender_id     CHAR(36) NOT NULL,
  recipient_id  CHAR(36) NOT NULL,
  surprise_type VARCHAR(40) NOT NULL,
  title         VARCHAR(200) NULL,
  message       MEDIUMTEXT NULL,
  image_bucket  VARCHAR(40) NULL,
  image_path    VARCHAR(255) NULL,
  reveal_at     DATETIME NOT NULL,
  opened_at     DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY surprises_recipient_idx (recipient_id, reveal_at),
  KEY surprises_couple_idx (couple_id),
  CONSTRAINT surprises_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
