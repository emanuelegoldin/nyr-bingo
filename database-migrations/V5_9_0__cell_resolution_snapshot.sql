-- V5.9.0 — Cell Resolution Snapshot
--
-- A resolution is now only a definition: type, title, description, subtask titles and target.
-- Every card cell holds a copy of the definition it was filled with, and its own progress, so the
-- same resolution can be completed in one game and pending in another.
-- Specs: 03-personal-resolutions.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md,
-- 13-resolution-history-and-progress.md
--
-- MariaDB DDL cannot be rolled back, so every step is safe to run again after a partial failure:
-- each step that reads a column or table to be dropped is skipped once it is gone, and the drops
-- come last.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 1 — The definition and progress columns of a cell            ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- title is NULL only for a cell that has no content (an empty cell, or a cell whose resolution
-- was deleted before this migration).
CALL Create_Column('bingo_cells', 'title', 'VARCHAR(255)', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('bingo_cells', 'description', 'TEXT', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('bingo_cells', 'number_of_repetition', 'INT', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('bingo_cells', 'completed_times', 'INT', 0, '0', NULL, NULL, NULL);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 2 — The subtasks of compound cells                           ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- subtask_index is 0-based, the index the API uses.
CREATE TABLE IF NOT EXISTS bingo_cell_subtasks (
  cell_id VARCHAR(36) NOT NULL,
  subtask_index INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (cell_id, subtask_index),
  CONSTRAINT fk_bingo_cell_subtasks_cell FOREIGN KEY (cell_id) REFERENCES bingo_cells(id) ON DELETE CASCADE
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 3 — Copy each resolution, with its progress, into its cells  ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Progress used to be shared by every cell of a resolution, so each cell starts from that shared
-- value. Skipped once resolutions.completed_times is gone (Step 8).
SET @has_resolution_progress := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND COLUMN_NAME = 'completed_times'
);

SET @copy_definitions := IF(
  @has_resolution_progress = 1,
  "UPDATE bingo_cells c
   JOIN resolutions r ON r.id = c.resolution_id
   SET c.title = r.title,
       c.description = r.description,
       c.resolution_type = r.resolution_type,
       c.number_of_repetition = r.number_of_repetition,
       c.completed_times = COALESCE(r.completed_times, 0)",
  'SELECT 1'
);
PREPARE stmt FROM @copy_definitions;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @copy_subtasks := IF(
  @has_resolution_progress = 1,
  "INSERT IGNORE INTO bingo_cell_subtasks (cell_id, subtask_index, title, description, completed)
   SELECT c.id,
          jt.ord - 1,
          COALESCE(jt.title, ''),
          jt.description,
          IF(jt.completed IN ('true', '1'), 1, 0)
   FROM bingo_cells c
   JOIN resolutions r ON r.id = c.resolution_id
   JOIN JSON_TABLE(r.subtasks, '$[*]' COLUMNS (
     ord FOR ORDINALITY,
     title TEXT PATH '$.title',
     description TEXT PATH '$.description',
     completed VARCHAR(5) PATH '$.completed'
   )) jt
   WHERE r.resolution_type = 'compound'
     AND r.subtasks IS NOT NULL",
  'SELECT 1'
);
PREPARE stmt FROM @copy_subtasks;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 4 — History belongs to a cell                                ║
-- ╚═══════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS cell_history_entries (
  id VARCHAR(36) PRIMARY KEY,
  cell_id VARCHAR(36) NOT NULL,
  author_user_id VARCHAR(36) NOT NULL,
  entry_type ENUM('manual_note', 'system_event') NOT NULL,
  event_key VARCHAR(120) NULL,
  content TEXT NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cell_history_entries_cell FOREIGN KEY (cell_id) REFERENCES bingo_cells(id) ON DELETE CASCADE,
  CONSTRAINT fk_cell_history_entries_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_cell_history_cell_created (cell_id, created_at),
  INDEX idx_cell_history_author_created (author_user_id, created_at)
);

-- Each entry of a resolution is copied to every cell that showed it. The NOT EXISTS keeps a
-- second run from copying an entry twice. Skipped once resolution_history_entries is gone.
SET @has_resolution_history := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolution_history_entries'
);
SET @copy_history := IF(
  @has_resolution_history = 1,
  "INSERT INTO cell_history_entries
     (id, cell_id, author_user_id, entry_type, event_key, content, metadata_json, created_at)
   SELECT UUID(), c.id, h.author_user_id, h.entry_type, h.event_key, h.content, h.metadata_json, h.created_at
   FROM resolution_history_entries h
   JOIN bingo_cells c ON c.resolution_id = h.resolution_id
   WHERE NOT EXISTS (
     SELECT 1 FROM cell_history_entries e
     WHERE e.cell_id = c.id
       AND e.author_user_id = h.author_user_id
       AND e.created_at <=> h.created_at
       AND e.entry_type = h.entry_type
       AND e.content = h.content
   )",
  'SELECT 1'
);
PREPARE stmt FROM @copy_history;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 5 — Prepared fallbacks no longer need a resolution row       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Their cells already hold the copy (Step 3), and their history was copied (Step 4).
UPDATE bingo_cells SET resolution_id = NULL WHERE source_type = 'prepared';
DELETE FROM resolutions WHERE scope = 'prepared';
ALTER TABLE resolutions
  MODIFY COLUMN scope ENUM('personal', 'team', 'member_provided') NOT NULL DEFAULT 'personal';

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 6 — A cell is empty only by its source                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- resolution_id is now only a link to the resolution a cell was copied from.
CALL Drop_Column('bingo_cells', 'is_empty');
ALTER TABLE bingo_cells
  ADD COLUMN is_empty TINYINT(1) AS (source_type = 'empty') VIRTUAL;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 7 — Subtasks of a resolution have no completed flag          ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Rebuilds each list from its titles and descriptions, keeping the order. Running it again
-- rebuilds the same list.
UPDATE resolutions r
SET r.subtasks = (
  SELECT JSON_ARRAYAGG(JSON_OBJECT('title', jt.title, 'description', jt.description) ORDER BY jt.ord)
  FROM JSON_TABLE(r.subtasks, '$[*]' COLUMNS (
    ord FOR ORDINALITY,
    title TEXT PATH '$.title',
    description TEXT PATH '$.description'
  )) jt
)
WHERE r.subtasks IS NOT NULL
  AND JSON_LENGTH(r.subtasks) > 0;

-- The prepared pool is a definition too (spec 17), so its seed flags go as well.
UPDATE prepared_resolutions p
SET p.subtasks = (
  SELECT JSON_ARRAYAGG(JSON_OBJECT('title', jt.title, 'description', jt.description) ORDER BY jt.ord)
  FROM JSON_TABLE(p.subtasks, '$[*]' COLUMNS (
    ord FOR ORDINALITY,
    title TEXT PATH '$.title',
    description TEXT PATH '$.description'
  )) jt
)
WHERE p.subtasks IS NOT NULL
  AND JSON_LENGTH(p.subtasks) > 0;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 8 — Drop the progress kept on resolutions                    ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Last on purpose: Steps 3 and 4 read them, so a failed run can pick up from the start.
CALL Drop_Table('resolution_history_entries');
CALL Drop_Column('resolutions', 'completed_times');
