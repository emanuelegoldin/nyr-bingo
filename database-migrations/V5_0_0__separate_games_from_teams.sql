-- V5.0.0 — Separate Games from Teams
--
-- A team becomes a list of users with a leader. A game is one bingo instance played by a team,
-- and a team can run several. Goal, member-provided resolutions, cards and leaderboard rows
-- now belong to a game. Spec: 16-games.md
--
-- MariaDB DDL cannot be rolled back, so every step is safe to run again after a partial failure.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 1 — Create the games table                                   ║
-- ╚═══════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(36) PRIMARY KEY,
  team_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status ENUM('forming', 'started', 'ended') NOT NULL DEFAULT 'forming',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  CONSTRAINT fk_games_team_id FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_games_team_status (team_id, status)
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 2 — Give every existing team one game                        ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Skipped once teams.status is gone (Step 7): nothing is left to copy from.
SET @has_team_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'teams'
    AND COLUMN_NAME = 'status'
);
SET @backfill_games := IF(
  @has_team_status = 1,
  "INSERT INTO games (id, team_id, name, status, created_at)
   SELECT UUID(), t.id, t.name, t.status, t.created_at
   FROM teams t
   WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.team_id = t.id)",
  'SELECT 1'
);
PREPARE stmt FROM @backfill_games;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 3 — Add game_id and link existing rows to their game         ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- team_id stays on these tables: membership checks and real-time rooms keep using it.
CALL Create_Column('bingo_cards', 'game_id', 'VARCHAR(36)', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('team_leaderboard', 'game_id', 'VARCHAR(36)', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('resolutions', 'game_id', 'VARCHAR(36)', 1, NULL, NULL, NULL, NULL);

-- Each team has exactly one game at this point, so the join cannot be ambiguous.
UPDATE bingo_cards bc
JOIN games g ON g.team_id = bc.team_id
SET bc.game_id = g.id
WHERE bc.game_id IS NULL;

UPDATE team_leaderboard tl
JOIN games g ON g.team_id = tl.team_id
SET tl.game_id = g.id
WHERE tl.game_id IS NULL;

-- Personal resolutions belong to no game and keep game_id = NULL.
UPDATE resolutions r
JOIN games g ON g.team_id = r.team_id
SET r.game_id = g.id
WHERE r.game_id IS NULL
  AND r.scope IN ('team', 'member_provided');

ALTER TABLE bingo_cards MODIFY COLUMN game_id VARCHAR(36) NOT NULL;
ALTER TABLE team_leaderboard MODIFY COLUMN game_id VARCHAR(36) NOT NULL;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 4 — Unique keys per game                                     ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Added before the per-team keys are dropped (Step 6): a foreign key may rely on those as its
-- only index, and the per-game keys or the explicit index below take over from them.
ALTER TABLE bingo_cards ADD UNIQUE KEY IF NOT EXISTS unique_game_card (game_id, user_id);
ALTER TABLE team_leaderboard ADD UNIQUE KEY IF NOT EXISTS unique_user_game (user_id, game_id);
ALTER TABLE resolutions ADD UNIQUE KEY IF NOT EXISTS unique_member_provided_game (game_id, owner_user_id, to_user_id);
ALTER TABLE resolutions ADD INDEX IF NOT EXISTS idx_resolutions_team (team_id);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 5 — Foreign keys to games                                    ║
-- ╚═══════════════════════════════════════════════════════════════════╝
SET @has_card_game_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bingo_cards'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_bingo_cards_game_id'
);
SET @add_card_game_fk := IF(
  @has_card_game_fk = 0,
  'ALTER TABLE bingo_cards ADD CONSTRAINT fk_bingo_cards_game_id FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @add_card_game_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_leaderboard_game_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'team_leaderboard'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_team_leaderboard_game_id'
);
SET @add_leaderboard_game_fk := IF(
  @has_leaderboard_game_fk = 0,
  'ALTER TABLE team_leaderboard ADD CONSTRAINT fk_team_leaderboard_game_id FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @add_leaderboard_game_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_resolution_game_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resolutions'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_resolutions_game_id'
);
SET @add_resolution_game_fk := IF(
  @has_resolution_game_fk = 0,
  'ALTER TABLE resolutions ADD CONSTRAINT fk_resolutions_game_id FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @add_resolution_game_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 6 — Drop the per-team unique keys                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝
ALTER TABLE bingo_cards DROP INDEX IF EXISTS unique_card;
ALTER TABLE team_leaderboard DROP INDEX IF EXISTS unique_user_team;
ALTER TABLE resolutions DROP INDEX IF EXISTS unique_member_provided;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 7 — Remove teams.status                                      ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Last on purpose: Step 2 reads it, so a failed run can pick up from the start.
CALL Drop_Column('teams', 'status');
