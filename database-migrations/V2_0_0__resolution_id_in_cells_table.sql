-- Replace resolution_text column in cells table with resolution_id foreign key
-- 1. Add resolution_id and team_provided_resolution_id columns (guarded for reruns/partial state)
SET @has_resolution_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'resolution_id'
);
SET @add_resolution_id_stmt := IF(
  @has_resolution_id = 0,
  'ALTER TABLE bingo_cells ADD COLUMN resolution_id VARCHAR(36) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @add_resolution_id_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_team_provided_resolution_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'team_provided_resolution_id'
);
SET @add_team_provided_resolution_id_stmt := IF(
  @has_team_provided_resolution_id = 0,
  'ALTER TABLE bingo_cells ADD COLUMN team_provided_resolution_id VARCHAR(36) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @add_team_provided_resolution_id_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add FKs only if they don't already exist (migration may be re-run after partial application)
SET @resolution_id_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'resolution_id'
    AND REFERENCED_TABLE_NAME = 'resolutions'
);

SET @resolution_id_fk_stmt := IF(
  @resolution_id_fk_exists = 0,
  'ALTER TABLE bingo_cells ADD CONSTRAINT fk_bingo_cells_resolution_id FOREIGN KEY (resolution_id) REFERENCES resolutions(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @resolution_id_fk_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @team_provided_resolution_id_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'team_provided_resolution_id'
    AND REFERENCED_TABLE_NAME = 'team_provided_resolutions'
);

SET @team_provided_resolution_id_fk_stmt := IF(
  @team_provided_resolution_id_fk_exists = 0,
  'ALTER TABLE bingo_cells ADD CONSTRAINT fk_bingo_cells_team_provided_resolution_id FOREIGN KEY (team_provided_resolution_id) REFERENCES team_provided_resolutions(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @team_provided_resolution_id_fk_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Join resolution_text to resolutions table to get corresponding ids (only if resolution_text still exists)
SET @has_resolution_text := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'resolution_text'
);

SET @update_resolution_id_stmt := IF(
  @has_resolution_text > 0,
  'UPDATE bingo_cells bc JOIN resolutions r ON bc.resolution_text = r.text SET bc.resolution_id = r.id WHERE bc.resolution_id IS NULL',
  'SELECT 1'
);
PREPARE stmt FROM @update_resolution_id_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Join resolution_text to team_provided_resolutions to get corresponding ids (only if resolution_text still exists)
SET @update_team_provided_resolution_id_stmt := IF(
  @has_resolution_text > 0,
  'UPDATE bingo_cells bc JOIN team_provided_resolutions tpr ON bc.resolution_text = tpr.text SET bc.team_provided_resolution_id = tpr.id WHERE bc.team_provided_resolution_id IS NULL',
  'SELECT 1'
);
PREPARE stmt FROM @update_team_provided_resolution_id_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Drop resolution_text column
SET @drop_resolution_text_stmt := IF(
  @has_resolution_text > 0,
  'ALTER TABLE bingo_cells DROP COLUMN resolution_text',
  'SELECT 1'
);
PREPARE stmt FROM @drop_resolution_text_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;