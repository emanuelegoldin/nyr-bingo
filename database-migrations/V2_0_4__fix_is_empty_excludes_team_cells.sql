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
CALL Drop_Column('bingo_cells','is_empty');

-- 2. Re-add is_empty with the corrected expression
SET @resolution_id_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bingo_cells' AND column_name = 'resolution_id');
SET @team_provided_resolution_id_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bingo_cells' AND column_name = 'team_provided_resolution_id');
SET @source_type_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bingo_cells' AND column_name = 'source_type');

SET @add_is_empty_sql = IF(@resolution_id_exists > 0 AND @team_provided_resolution_id_exists > 0 AND @source_type_exists > 0,
    'ALTER TABLE bingo_cells ADD COLUMN is_empty BOOLEAN AS (resolution_id IS NULL AND team_provided_resolution_id IS NULL AND source_type = ''empty'') VIRTUAL;',
    'ALTER TABLE bingo_cells ADD COLUMN is_empty BOOLEAN AS (1) VIRTUAL;'); -- Placeholder definition, missing required columns
PREPARE stmt FROM @add_is_empty_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
