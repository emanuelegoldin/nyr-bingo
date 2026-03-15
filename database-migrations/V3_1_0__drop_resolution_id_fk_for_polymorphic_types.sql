-- V3.1.0 - Drop resolution_id FK for polymorphic resolution types
--
-- The V2_0_0 migration added a foreign key fk_bingo_cells_resolution_id that
-- references the `resolutions` table. Since V3_0_0, `resolution_id` on
-- `bingo_cells` is polymorphic: it can point to `resolutions`,
-- `compound_resolutions`, or `iterative_resolutions` depending on
-- `resolution_type`. MariaDB FKs can only reference a single table, so this
-- constraint must be dropped. Referential integrity for compound/iterative
-- is enforced at the application layer.

-- Drop the FK only if it exists (idempotent)
SET @has_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND CONSTRAINT_NAME = 'fk_bingo_cells_resolution_id'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @drop_fk_stmt := IF(
  @has_fk > 0,
  'ALTER TABLE bingo_cells DROP FOREIGN KEY fk_bingo_cells_resolution_id',
  'SELECT 1'
);
PREPARE stmt FROM @drop_fk_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
