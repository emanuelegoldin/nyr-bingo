-- V5.2.0 — Prepared resolutions
--
-- A shared pool of ready-made resolutions, grouped by how long they take. Users copy entries
-- into their personal resolutions, and game start copies entries onto cards as fallbacks.
-- Spec: 17-prepared-resolutions.md
--
-- Every statement is safe to run again: the table is only created if missing, and MODIFY
-- COLUMN sets a column to the same definition on a second run.

CREATE TABLE IF NOT EXISTS prepared_resolutions (
  id VARCHAR(36) PRIMARY KEY,
  category ENUM('short', 'medium', 'long') NOT NULL,
  resolution_type ENUM('base', 'compound', 'iterative') NOT NULL DEFAULT 'base',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  subtasks JSON NULL,
  number_of_repetition INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prepared_resolutions_category (category)
);

-- A fallback on a card is a copy owned by the card owner and tied to the game.
ALTER TABLE resolutions
  MODIFY COLUMN scope ENUM('personal', 'team', 'member_provided', 'prepared') NOT NULL DEFAULT 'personal';

ALTER TABLE bingo_cells
  MODIFY COLUMN source_type ENUM('team', 'member_provided', 'personal', 'empty', 'prepared') NOT NULL;
