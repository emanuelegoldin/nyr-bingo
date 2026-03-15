-- V3.2.0 — Unified Resolutions Table
--
-- Merges all resolution types (base, compound, iterative) and all scopes
-- (personal, team, member_provided) into a single `resolutions` table.
--
-- Before:
--   resolutions               → personal base resolutions
--   compound_resolutions      → personal compound resolutions
--   iterative_resolutions     → personal iterative resolutions
--   team_provided_resolutions → member-provided resolutions (base only)
--   teams.team_resolution_text → team goal text (no proper entity)
--
-- After:
--   resolutions → ALL resolutions with:
--     resolution_type : base | compound | iterative
--     scope           : personal | team | member_provided
--     + nullable scope/type-specific columns
--
-- Benefits:
--   - bingo_cells uses a single resolution_id FK (no more dual ID columns)
--   - one JOIN to resolve cell text (was 4 LEFT JOINs)
--   - team and member-provided resolutions gain compound/iterative support

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 1 — Extend the resolutions table                             ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- Rename `text` → `description` (also widen to TEXT NULL to match compound/iterative)
SET @has_text_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND COLUMN_NAME = 'text'
);
SET @update_text_column := IF(
  @has_text_column > 0,
  'ALTER TABLE resolutions CHANGE COLUMN text description TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @update_text_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add resolution metadata columns
CALL Create_Column('resolutions', 'resolution_type', "ENUM('base', 'compound', 'iterative')", 0, 'base', NULL, NULL, NULL);
CALL Create_Column('resolutions', 'scope', "ENUM('personal', 'team', 'member_provided')", 0, 'personal', NULL, NULL, NULL);
CALL Create_Column('resolutions', 'team_id', 'VARCHAR(36)', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('resolutions', 'to_user_id', 'VARCHAR(36)', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('resolutions', 'subtasks', 'JSON', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('resolutions', 'number_of_repetition', 'INT', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('resolutions', 'completed_times', 'INT', 0, '0', NULL, NULL, NULL);

-- Foreign keys for scope-specific columns
-- TODO: adapt syntax to use Create_Column with referencedTable
SET @has_team_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_resolutions_team'
);
SET @add_team_fk := IF(
  @has_team_fk = 0,
  'ALTER TABLE resolutions ADD CONSTRAINT fk_resolutions_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @add_team_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_to_user_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_resolutions_to_user'
);
SET @add_to_user_fk := IF(
  @has_to_user_fk = 0,
  'ALTER TABLE resolutions ADD CONSTRAINT fk_resolutions_to_user FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @add_to_user_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Indexes TODO: add only if needed
-- ALTER TABLE resolutions
--   ADD INDEX idx_resolutions_team (team_id),
--   ADD INDEX idx_resolutions_scope (scope),
--   ADD INDEX idx_resolutions_type (resolution_type);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 2 — Migrate compound_resolutions                             ║
-- ╚═══════════════════════════════════════════════════════════════════╝
SET @cr_exists := (
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'compound_resolutions'
);
SET @migrate_cr := IF(
  @cr_exists = 1,
  "INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope, subtasks, created_at, updated_at) SELECT id, owner_user_id, title, description, 'compound', 'personal', subtasks, created_at, updated_at FROM compound_resolutions",
  'SELECT 1'
);
PREPARE stmt FROM @migrate_cr;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 3 — Migrate iterative_resolutions                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝
SET @ir_exists := (
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'iterative_resolutions'
);
SET @migrate_ir := IF(
  @ir_exists = 1,
  "INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope, number_of_repetition, completed_times, created_at, updated_at) SELECT id, owner_user_id, title, description, 'iterative', 'personal', number_of_repetition, completed_times, created_at, updated_at FROM iterative_resolutions",
  "SELECT 1"
);
PREPARE stmt FROM @migrate_ir;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 4 — Migrate team_provided_resolutions                        ║
-- ╚═══════════════════════════════════════════════════════════════════╝

SET @tpr_exists := (
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_provided_resolutions'
);
SET @migrate_tpr := IF(
  @tpr_exists = 1,
  "INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope, team_id, to_user_id, created_at, updated_at) SELECT id, from_user_id, title, text, 'base', 'member_provided', team_id, to_user_id, created_at, updated_at FROM team_provided_resolutions",
  "SELECT 1"
);
PREPARE stmt FROM @migrate_tpr;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 5 — Create resolution entities for team goals                ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Each team with a non-empty team_resolution_text gets a proper resolution row.
SET @has_team_resolution_text := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'teams'
    AND COLUMN_NAME = 'team_resolution_text'
);
SET @migrate_team_goals := IF(
  @has_team_resolution_text > 0,
  "INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope, team_id, created_at, updated_at) SELECT UUID(), leader_user_id, LEFT(team_resolution_text, 255), team_resolution_text, 'base', 'team', id, created_at, updated_at FROM teams WHERE team_resolution_text IS NOT NULL AND TRIM(team_resolution_text) != ''",
  "SELECT 1"
);
PREPARE stmt FROM @migrate_team_goals;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 6 — Update bingo_cells references                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- 6a. Point member-provided cells to the (now-migrated) resolution_id.
--     The team_provided_resolution_id values match the IDs copied into resolutions.
SET @has_tpr_id_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'team_provided_resolution_id'
);
SET @update_member_provided_cells := IF(
  @has_tpr_id_column > 0,
  "UPDATE bingo_cells SET resolution_id = team_provided_resolution_id WHERE team_provided_resolution_id IS NOT NULL",
  "SELECT 1"
);
PREPARE stmt FROM @update_member_provided_cells;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6b. Point team-goal cells (source_type='team') to their new resolution entry.
UPDATE bingo_cells bc
  JOIN bingo_cards bca ON bc.card_id = bca.id
  JOIN resolutions r   ON r.team_id = bca.team_id AND r.scope = 'team'
SET bc.resolution_id = r.id
WHERE bc.source_type = 'team' AND bc.resolution_id IS NULL;

-- 6c. Normalise resolution_type: 'team' → 'base' (team is a scope, not a content type).
UPDATE bingo_cells SET resolution_type = 'base' WHERE resolution_type = 'team';

-- 6d. Shrink the ENUM to remove the obsolete 'team' value.
ALTER TABLE bingo_cells
  MODIFY COLUMN resolution_type ENUM('base', 'compound', 'iterative') NOT NULL DEFAULT 'base';

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 7 — Drop team_provided_resolution_id from bingo_cells        ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- 7a. Drop FK (idempotent — looks up the actual constraint name by column)
SET @tpr_fk_name := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND COLUMN_NAME = 'team_provided_resolution_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @drop_tpr_fk := IF(
  @tpr_fk_name IS NOT NULL,
  CONCAT('ALTER TABLE bingo_cells DROP FOREIGN KEY `', @tpr_fk_name, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @drop_tpr_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7b. Drop virtual column is_empty (it references team_provided_resolution_id)
CALL Drop_Column('bingo_cells', 'is_empty');

-- 7c. Drop the column itself
CALL Drop_Column('bingo_cells', 'team_provided_resolution_id');

-- 7d. Re-create is_empty with simplified expression
-- TODO: provide way to define AS clause in Create_Column procedure and use that instead of raw SQL
ALTER TABLE bingo_cells
  ADD COLUMN is_empty TINYINT(1)
    AS (resolution_id IS NULL AND source_type = 'empty') VIRTUAL;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 8 — Re-add FK from bingo_cells.resolution_id → resolutions   ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- The FK was dropped in V3.1.0 because resolution_id was polymorphic across
-- multiple tables. Now that everything lives in `resolutions`, we can restore it.
SET @has_resolution_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_bingo_cells_resolution_id'
);
SET @add_resolution_fk := IF(
  @has_resolution_fk = 0,
  'ALTER TABLE bingo_cells ADD CONSTRAINT fk_bingo_cells_resolution_id FOREIGN KEY (resolution_id) REFERENCES resolutions(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @add_resolution_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 9 — Unique constraint for member-provided resolutions        ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- Enforces one resolution per (team, author, target) triplet.
-- Personal resolutions have team_id=NULL and to_user_id=NULL; MariaDB allows
-- duplicate NULLs in unique indexes, so they are unaffected.
SET @has_unique_constraint := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND CONSTRAINT_TYPE = 'UNIQUE'
    AND CONSTRAINT_NAME = 'unique_member_provided'
);
SET @add_unique_constraint := IF(
  @has_unique_constraint = 0,
  'ALTER TABLE resolutions ADD UNIQUE KEY unique_member_provided (team_id, owner_user_id, to_user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @add_unique_constraint;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 10 — Remove teams.team_resolution_text                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
CALL Drop_Column('teams', 'team_resolution_text');

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 11 — Drop legacy tables                                      ║
-- ╚═══════════════════════════════════════════════════════════════════╝

DROP TABLE IF EXISTS compound_resolutions;
DROP TABLE IF EXISTS iterative_resolutions;
DROP TABLE IF EXISTS team_provided_resolutions;
