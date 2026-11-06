-- V5.11.0 — Archived Threads
--
-- Closing a review thread no longer deletes its messages and files: the thread becomes a
-- read-only archived thread (spec 07). `review_threads.outcome` keeps the state its cell took
-- when it closed. When a game is archived, its threads are copied into the archive as plain
-- values (spec 18). Spec: 07-proof-and-approval.md, 18-game-archive.md
--
-- Safe to run again: Create_Column and CREATE TABLE IF NOT EXISTS skip what already exists.

-- NULL for threads closed before this migration: their outcome was not recorded.
CALL Create_Column('review_threads', 'outcome', "ENUM('accomplished', 'pending')", 1, NULL, NULL, NULL, NULL);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ The archived threads of each archived cell                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- `id` is the thread's former id. The cell is (archived_game_id, user_id, position): user_id is
-- the card owner, who is also the completing user.
CREATE TABLE IF NOT EXISTS archived_threads (
  id VARCHAR(36) PRIMARY KEY,
  archived_game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  position INT NOT NULL,
  created_at DATETIME NOT NULL,
  closed_at DATETIME NULL,
  outcome ENUM('accomplished', 'pending') NULL,
  accept_votes INT NOT NULL DEFAULT 0,
  deny_votes INT NOT NULL DEFAULT 0,
  INDEX idx_archived_threads_cell (archived_game_id, user_id, position),
  CONSTRAINT fk_archived_threads_cell FOREIGN KEY (archived_game_id, user_id, position)
    REFERENCES archived_cells(archived_game_id, user_id, position) ON DELETE CASCADE
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Their messages                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- The author is kept as a name, so later username changes do not change the archive.
CREATE TABLE IF NOT EXISTS archived_thread_messages (
  id VARCHAR(36) PRIMARY KEY,
  archived_thread_id VARCHAR(36) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_archived_thread_messages_thread (archived_thread_id),
  CONSTRAINT fk_archived_thread_messages_thread FOREIGN KEY (archived_thread_id)
    REFERENCES archived_threads(id) ON DELETE CASCADE
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Their proof files                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- file_path points to the stored file under uploads/review-files/, which stays on disk until the
-- last row naming it, here or in review_files, is deleted.
CREATE TABLE IF NOT EXISTS archived_thread_files (
  id VARCHAR(36) PRIMARY KEY,
  archived_thread_id VARCHAR(36) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100) NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_archived_thread_files_thread (archived_thread_id),
  INDEX idx_archived_thread_files_path (file_path),
  CONSTRAINT fk_archived_thread_files_thread FOREIGN KEY (archived_thread_id)
    REFERENCES archived_threads(id) ON DELETE CASCADE
);
