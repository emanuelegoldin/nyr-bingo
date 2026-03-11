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
ALTER TABLE resolutions CHANGE COLUMN text description TEXT NULL;

-- Add resolution metadata columns
ALTER TABLE resolutions
  ADD COLUMN resolution_type ENUM('base', 'compound', 'iterative') NOT NULL DEFAULT 'base',
  ADD COLUMN scope ENUM('personal', 'team', 'member_provided') NOT NULL DEFAULT 'personal',
  ADD COLUMN team_id VARCHAR(36) NULL,
  ADD COLUMN to_user_id VARCHAR(36) NULL,
  ADD COLUMN subtasks JSON NULL,
  ADD COLUMN number_of_repetition INT NULL,
  ADD COLUMN completed_times INT NOT NULL DEFAULT 0;

-- Foreign keys for scope-specific columns
ALTER TABLE resolutions
  ADD CONSTRAINT fk_resolutions_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_resolutions_to_user FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Indexes
ALTER TABLE resolutions
  ADD INDEX idx_resolutions_team (team_id),
  ADD INDEX idx_resolutions_scope (scope),
  ADD INDEX idx_resolutions_type (resolution_type);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 2 — Migrate compound_resolutions                             ║
-- ╚═══════════════════════════════════════════════════════════════════╝

INSERT INTO resolutions
  (id, owner_user_id, title, description, resolution_type, scope, subtasks, created_at, updated_at)
SELECT
  id, owner_user_id, title, description, 'compound', 'personal', subtasks, created_at, updated_at
FROM compound_resolutions;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 3 — Migrate iterative_resolutions                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝

INSERT INTO resolutions
  (id, owner_user_id, title, description, resolution_type, scope,
   number_of_repetition, completed_times, created_at, updated_at)
SELECT
  id, owner_user_id, title, description, 'iterative', 'personal',
  number_of_repetition, completed_times, created_at, updated_at
FROM iterative_resolutions;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 4 — Migrate team_provided_resolutions                        ║
-- ╚═══════════════════════════════════════════════════════════════════╝

INSERT INTO resolutions
  (id, owner_user_id, title, description, resolution_type, scope,
   team_id, to_user_id, created_at, updated_at)
SELECT
  id, from_user_id, title, text, 'base', 'member_provided',
  team_id, to_user_id, created_at, updated_at
FROM team_provided_resolutions;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 5 — Create resolution entities for team goals                ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- Each team with a non-empty team_resolution_text gets a proper resolution row.
INSERT INTO resolutions
  (id, owner_user_id, title, description, resolution_type, scope,
   team_id, created_at, updated_at)
SELECT
  UUID(), leader_user_id,
  LEFT(team_resolution_text, 255),
  team_resolution_text,
  'base', 'team', id,
  created_at, updated_at
FROM teams
WHERE team_resolution_text IS NOT NULL AND TRIM(team_resolution_text) != '';

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 6 — Update bingo_cells references                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- 6a. Point member-provided cells to the (now-migrated) resolution_id.
--     The team_provided_resolution_id values match the IDs copied into resolutions.
UPDATE bingo_cells
SET resolution_id = team_provided_resolution_id
WHERE team_provided_resolution_id IS NOT NULL;

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

-- 7a. Drop FK (idempotent)
SET @has_tpr_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cells'
    AND CONSTRAINT_NAME = 'fk_bingo_cells_team_provided_resolution_id'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @drop_tpr_fk := IF(
  @has_tpr_fk > 0,
  'ALTER TABLE bingo_cells DROP FOREIGN KEY fk_bingo_cells_team_provided_resolution_id',
  'SELECT 1'
);
PREPARE stmt FROM @drop_tpr_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7b. Drop virtual column is_empty (it references team_provided_resolution_id)
ALTER TABLE bingo_cells DROP COLUMN is_empty;

-- 7c. Drop the column itself
ALTER TABLE bingo_cells DROP COLUMN team_provided_resolution_id;

-- 7d. Re-create is_empty with simplified expression
ALTER TABLE bingo_cells
  ADD COLUMN is_empty TINYINT(1)
    AS (resolution_id IS NULL AND source_type = 'empty') VIRTUAL;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 8 — Re-add FK from bingo_cells.resolution_id → resolutions   ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- The FK was dropped in V3.1.0 because resolution_id was polymorphic across
-- multiple tables. Now that everything lives in `resolutions`, we can restore it.
ALTER TABLE bingo_cells
  ADD CONSTRAINT fk_bingo_cells_resolution_id
    FOREIGN KEY (resolution_id) REFERENCES resolutions(id) ON DELETE SET NULL;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 9 — Unique constraint for member-provided resolutions        ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- Enforces one resolution per (team, author, target) triplet.
-- Personal resolutions have team_id=NULL and to_user_id=NULL; MariaDB allows
-- duplicate NULLs in unique indexes, so they are unaffected.
ALTER TABLE resolutions
  ADD UNIQUE KEY unique_member_provided (team_id, owner_user_id, to_user_id);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 10 — Remove teams.team_resolution_text                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝

ALTER TABLE teams DROP COLUMN team_resolution_text;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 11 — Drop legacy tables                                      ║
-- ╚═══════════════════════════════════════════════════════════════════╝

DROP TABLE IF EXISTS compound_resolutions;
DROP TABLE IF EXISTS iterative_resolutions;
DROP TABLE IF EXISTS team_provided_resolutions;
