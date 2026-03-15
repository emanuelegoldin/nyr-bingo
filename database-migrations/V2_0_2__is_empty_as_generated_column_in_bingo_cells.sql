-- Set is_empty as a virtual generated column on bingo_cells
-- is_empty = (resolution_id IS NULL AND team_provided_resolution_id IS NULL)
-- Migration is idempotent and safe to re-run.

-- 1. Detect whether is_empty column exists
SET @has_is_empty := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'is_empty'
);

-- 2. If column does not exist, add it as virtual generated
SET @add_is_empty_stmt := IF(
  @has_is_empty = 0,
  'ALTER TABLE bingo_cells ADD COLUMN is_empty TINYINT(1) AS (resolution_id IS NULL AND team_provided_resolution_id IS NULL) VIRTUAL',
  'SELECT 1'
);

PREPARE stmt FROM @add_is_empty_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Detect if an existing is_empty column is non-virtual (needs conversion)
SET @is_empty_needs_conversion := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'is_empty'
    AND EXTRA NOT LIKE '%VIRTUAL%'
);

-- 4. If needed, drop the old non-virtual column
SET @drop_is_empty_stmt := IF(
  @is_empty_needs_conversion = 1,
  'ALTER TABLE bingo_cells DROP COLUMN is_empty',
  'SELECT 1'
);

PREPARE stmt FROM @drop_is_empty_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Re-add is_empty as virtual generated after drop (no-op if not needed)
SET @add_virtual_is_empty_stmt := IF(
  @is_empty_needs_conversion = 1,
  'ALTER TABLE bingo_cells ADD COLUMN is_empty TINYINT(1) AS (resolution_id IS NULL AND team_provided_resolution_id IS NULL) VIRTUAL',
  'SELECT 1'
);

PREPARE stmt FROM @add_virtual_is_empty_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
