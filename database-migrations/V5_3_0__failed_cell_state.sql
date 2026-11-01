-- V5.3.0 — Failed cell state
--
-- A card owner can mark a cell as failed to track it on the card. Spec: 06-bingo-gameplay.md
--
-- Safe to run again: MODIFY COLUMN sets the column to the same definition on a second run.
-- The new value goes last, so existing rows keep their state.

ALTER TABLE bingo_cells
  MODIFY COLUMN state ENUM('pending', 'completed', 'pending_review', 'accomplished', 'failed') DEFAULT 'pending';
