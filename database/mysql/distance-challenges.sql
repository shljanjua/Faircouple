-- ============================================================================
-- FairCouples — Long-distance mode + Couple Challenges (Phase 2)
--
-- Safe to run on an existing database: every table uses CREATE TABLE IF NOT
-- EXISTS, so importing this only adds what is missing. These tables are also
-- included in faircouples-mysql.sql, so a fresh install already has them.
--
--   hPanel -> phpMyAdmin -> select your database -> Import -> this file -> Go.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Long-distance settings: one row per couple, with the next time they meet.
CREATE TABLE IF NOT EXISTS long_distance (
  id                  CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id           CHAR(36) NOT NULL,
  is_enabled          TINYINT(1) NOT NULL DEFAULT 1,
  next_visit_on       DATE NULL,
  next_visit_location VARCHAR(160) NULL,
  next_visit_note     VARCHAR(280) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY long_distance_couple_unique (couple_id),
  CONSTRAINT long_distance_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A challenge a couple has started (definition lives in code: Challenges.php).
CREATE TABLE IF NOT EXISTS couple_challenges (
  id            CHAR(36) NOT NULL DEFAULT (UUID()),
  couple_id     CHAR(36) NOT NULL,
  challenge_key VARCHAR(60) NOT NULL,
  title         VARCHAR(160) NOT NULL,
  total_days    INT NOT NULL,
  started_on    DATE NOT NULL,
  status        ENUM('active','completed','abandoned') NOT NULL DEFAULT 'active',
  completed_at  DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY couple_challenges_couple_idx (couple_id, status),
  CONSTRAINT couple_challenges_couple_fk FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per day of a started challenge, ticked off by either partner.
CREATE TABLE IF NOT EXISTS challenge_days (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  challenge_id CHAR(36) NOT NULL,
  couple_id    CHAR(36) NOT NULL,
  day_number   INT NOT NULL,
  is_done      TINYINT(1) NOT NULL DEFAULT 0,
  done_by      CHAR(36) NULL,
  done_at      DATETIME NULL,
  note         VARCHAR(280) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY challenge_days_unique (challenge_id, day_number),
  KEY challenge_days_couple_idx (couple_id),
  CONSTRAINT challenge_days_challenge_fk FOREIGN KEY (challenge_id) REFERENCES couple_challenges(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
