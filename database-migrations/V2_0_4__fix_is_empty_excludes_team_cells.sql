-- Fix is_empty generated column to exclude team-goal cells.
--
-- The previous definition:
--   is_empty = (resolution_id IS NULL AND team_provided_resolution_id IS NULL)
--
-- incorrectly marked the team-goal cell as empty because it has no FK to
-- either resolutions or team_provided_resolutions.  Team-goal cells use
-- source_type = 'team' and resolve their display text from teams.team_resolution_text.
--
-- New definition:
--   is_empty = (resolution_id IS NULL AND team_provided_resolution_id IS NULL AND source_type = 'empty')
--
-- Migration is idempotent and safe to re-run.

-- 1. Drop the existing virtual column
SET @has_is_empty := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'is_empty'
);

SET @drop_stmt := IF(
  @has_is_empty > 0,
  'ALTER TABLE bingo_cells DROP COLUMN is_empty',
  'SELECT 1'
);
PREPARE stmt FROM @drop_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Re-add is_empty with the corrected expression
ALTER TABLE bingo_cells
  ADD COLUMN is_empty TINYINT(1)
  AS (resolution_id IS NULL AND team_provided_resolution_id IS NULL AND source_type = 'empty') VIRTUAL;
