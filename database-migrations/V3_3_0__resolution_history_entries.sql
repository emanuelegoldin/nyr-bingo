-- V3.3.0 — Resolution History Entries
--
-- Adds a single timeline table for manual and system progress entries keyed by resolution_id.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 1 — Create resolution_history_entries table                  ║
-- ╚═══════════════════════════════════════════════════════════════════╝
SET @history_table_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolution_history_entries'
);

SET @create_history_table := IF(
  @history_table_exists = 0,
  "CREATE TABLE resolution_history_entries (
    id VARCHAR(36) PRIMARY KEY,
    resolution_id VARCHAR(36) NOT NULL,
    author_user_id VARCHAR(36) NOT NULL,
    entry_type ENUM('manual_note', 'system_event') NOT NULL,
    event_key VARCHAR(120) NULL,
    content TEXT NOT NULL,
    metadata_json JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resolution_history_entries_resolution_id
      FOREIGN KEY (resolution_id) REFERENCES resolutions(id) ON DELETE CASCADE,
    CONSTRAINT fk_resolution_history_entries_author_user_id
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
  )",
  'SELECT 1'
);
PREPARE stmt FROM @create_history_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 2 — Add timeline indexes                                     ║
-- ╚═══════════════════════════════════════════════════════════════════╝
SET @has_resolution_created_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolution_history_entries'
    AND INDEX_NAME = 'idx_resolution_history_resolution_created'
);
SET @add_resolution_created_index := IF(
  @has_resolution_created_index = 0,
  'ALTER TABLE resolution_history_entries ADD INDEX idx_resolution_history_resolution_created (resolution_id, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @add_resolution_created_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_author_created_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolution_history_entries'
    AND INDEX_NAME = 'idx_resolution_history_author_created'
);
SET @add_author_created_index := IF(
  @has_author_created_index = 0,
  'ALTER TABLE resolution_history_entries ADD INDEX idx_resolution_history_author_created (author_user_id, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @add_author_created_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
