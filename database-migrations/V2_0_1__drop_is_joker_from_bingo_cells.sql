-- Drop is_joker column from bingo_cells table if it exists
SET @has_is_joker := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'is_joker'
);
SET @drop_is_joker_stmt := IF(
  @has_is_joker > 0,
  'ALTER TABLE bingo_cells DROP COLUMN is_joker',
  'SELECT 1'
);
PREPARE stmt FROM @drop_is_joker_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;