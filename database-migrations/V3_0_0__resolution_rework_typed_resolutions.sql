-- =====================================================================
-- V3_0_0 — Resolution rework: typed resolutions (base, compound, iterative)
--
-- Adds a title column to resolutions and team_provided_resolutions,
-- creates compound_resolutions and iterative_resolutions tables,
-- and adds a resolution_type discriminator to bingo_cells.
-- =====================================================================

-- 1. Add 'title' column to resolutions (existing "base" resolutions)
SET @has_title := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND COLUMN_NAME = 'title'
);
SET @add_title_stmt := IF(
  @has_title = 0,
  'ALTER TABLE resolutions ADD COLUMN title VARCHAR(255) NULL AFTER owner_user_id',
  'SELECT 1'
);
PREPARE stmt FROM @add_title_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill title from text (truncate to 255 chars)
-- Check whether text column exists before backfill (it may have been removed in a later migration)
SET @has_text := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND COLUMN_NAME = 'text'
);
SET @update_title_stmt := IF(
  @has_text > 0,
  'UPDATE resolutions SET title = LEFT(text, 255) WHERE title IS NULL',
  'UPDATE resolutions SET title = ''Title Placeholder'' WHERE title IS NULL'
);
PREPARE stmt FROM @update_title_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make title NOT NULL after backfill
SET @title_nullable := (
  SELECT IS_NULLABLE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND COLUMN_NAME = 'title'
);
SET @modify_title_stmt := IF(
  @title_nullable = 'YES',
  'ALTER TABLE resolutions MODIFY COLUMN title VARCHAR(255) NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @modify_title_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add 'title' column to team_provided_resolutions
-- Check whether team_provided_resolutions table exists before attempting to modify it (it may not exist in a fresh install at this point in the migration history)
SET @has_tpr_table := (
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_provided_resolutions'
);

SET @has_tpr_title := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_provided_resolutions'
    AND COLUMN_NAME = 'title'
);
SET @add_tpr_title_stmt := IF(
  @has_tpr_title = 0
  AND @has_tpr_table = 1,
  'ALTER TABLE team_provided_resolutions ADD COLUMN title VARCHAR(255) NULL AFTER to_user_id',
  'SELECT 1'
);
PREPARE stmt FROM @add_tpr_title_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill

SET @has_tpr_text := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_provided_resolutions'
    AND COLUMN_NAME = 'text'
);
SET @update_tpr_title_stmt := IF(
  @has_tpr_table = 1 AND @has_tpr_text > 0,
  'UPDATE team_provided_resolutions SET title = LEFT(text, 255) WHERE title IS NULL',
  'SELECT 1'
);
PREPARE stmt FROM @update_tpr_title_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tpr_title_nullable := (
  SELECT IS_NULLABLE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_provided_resolutions'
    AND COLUMN_NAME = 'title'
);
SET @modify_tpr_title_stmt := IF(
  @has_tpr_table = 1
  AND @tpr_title_nullable = 'YES',
  'ALTER TABLE team_provided_resolutions MODIFY COLUMN title VARCHAR(255) NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @modify_tpr_title_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Create compound_resolutions table
CREATE TABLE IF NOT EXISTS compound_resolutions (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  subtasks JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_owner (owner_user_id)
);

-- 4. Create iterative_resolutions table
CREATE TABLE IF NOT EXISTS iterative_resolutions (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  number_of_repetition INT NOT NULL,
  completed_times INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_owner (owner_user_id)
);

-- 5. Add resolution_type to bingo_cells (polymorphic discriminator)
SET @has_resolution_type := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'resolution_type'
);
SET @add_resolution_type_stmt := IF(
  @has_resolution_type = 0,
  'ALTER TABLE bingo_cells ADD COLUMN resolution_type ENUM(''base'', ''team'', ''compound'', ''iterative'') NOT NULL DEFAULT ''base'' AFTER team_provided_resolution_id',
  'SELECT 1'
);
PREPARE stmt FROM @add_resolution_type_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: team source_type cells get resolution_type = 'team'
-- Read current enum definition
SET @resolution_type_column_type := (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'resolution_type'
);
SET @can_store_team := IF(@resolution_type_column_type LIKE '%team%', 1, 0);
SET @update_resolution_type_stmt := IF(
  @can_store_team = 1,
  'UPDATE bingo_cells SET resolution_type = ''team'' WHERE source_type = ''team''',
  'SELECT 1'
);
PREPARE stmt FROM @update_resolution_type_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
