-- V5.4.0 — Game archive
--
-- A game that ends becomes a read-only snapshot: its leaderboard and every player's card, stored
-- as plain values. Nothing here references games, teams or resolutions, so later changes to
-- those rows cannot alter an archived game. Spec: 18-game-archive.md
--
-- Safe to run again: CREATE TABLE IF NOT EXISTS skips a table that already exists.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ The game                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- id is the id the game had, so one game cannot be archived twice.
CREATE TABLE IF NOT EXISTS archived_games (
  id VARCHAR(36) PRIMARY KEY,
  leader_user_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  ended_at DATETIME NOT NULL,
  CONSTRAINT fk_archived_games_leader FOREIGN KEY (leader_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Its players: who can view it, and each final leaderboard line     ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- leaderboard_rank is NULL for a player who had no leaderboard row.
CREATE TABLE IF NOT EXISTS archived_game_players (
  archived_game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  leaderboard_rank INT NULL,
  completed_tasks INT NOT NULL DEFAULT 0,
  first_bingo_at DATETIME NULL,
  PRIMARY KEY (archived_game_id, user_id),
  CONSTRAINT fk_archived_players_game FOREIGN KEY (archived_game_id) REFERENCES archived_games(id) ON DELETE CASCADE,
  CONSTRAINT fk_archived_players_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_archived_players_user (user_id)
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ The cells of each card                                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- The Joker is implicit, as in bingo_cells. source_user_id only links to a profile, so it has no
-- foreign key.
CREATE TABLE IF NOT EXISTS archived_cells (
  archived_game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  position INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  resolution_type ENUM('base', 'compound', 'iterative') NOT NULL DEFAULT 'base',
  state ENUM('pending', 'completed', 'pending_review', 'accomplished', 'failed') NOT NULL,
  source_type ENUM('team', 'member_provided', 'personal', 'empty', 'prepared') NOT NULL,
  source_user_id VARCHAR(36) NULL,
  source_label VARCHAR(255) NOT NULL,
  is_empty BOOLEAN NOT NULL DEFAULT FALSE,
  number_of_repetition INT NULL,
  completed_times INT NULL,
  PRIMARY KEY (archived_game_id, user_id, position),
  CONSTRAINT fk_archived_cells_player FOREIGN KEY (archived_game_id, user_id)
    REFERENCES archived_game_players(archived_game_id, user_id) ON DELETE CASCADE
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ The subtasks of compound cells                                    ║
-- ╚═══════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS archived_cell_subtasks (
  archived_game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  position INT NOT NULL,
  subtask_index INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (archived_game_id, user_id, position, subtask_index),
  CONSTRAINT fk_archived_subtasks_cell FOREIGN KEY (archived_game_id, user_id, position)
    REFERENCES archived_cells(archived_game_id, user_id, position) ON DELETE CASCADE
);
