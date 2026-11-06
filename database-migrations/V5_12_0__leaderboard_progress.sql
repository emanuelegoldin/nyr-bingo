-- V5.12.0 — Leaderboard Progress
--
-- Games record when bingo started (`started_at`), and every change of a player's completed count
-- is logged as a progress point, so the Progress tab can chart it over time. Archived games keep
-- both as plain values. Spec: 23-progress-chart.md, 16-games.md, 18-game-archive.md
--
-- Safe to run again: Create_Column and CREATE TABLE IF NOT EXISTS skip what already exists, and
-- the data steps only fill what is still empty.

CALL Create_Column('games', 'started_at', 'DATETIME', 1, NULL, NULL, NULL, NULL);
CALL Create_Column('archived_games', 'started_at', 'DATETIME', 1, NULL, NULL, NULL, NULL);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Progress points of running and ended games                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- One row per change of a player's completed count (completed + accomplished cells).
CREATE TABLE IF NOT EXISTS leaderboard_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  recorded_at DATETIME NOT NULL,
  completed_tasks INT NOT NULL,
  INDEX idx_leaderboard_progress_game (game_id, recorded_at),
  CONSTRAINT fk_leaderboard_progress_game FOREIGN KEY (game_id)
    REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_leaderboard_progress_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Progress points of archived games                                ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- No reference to users or games (spec 18 Independence): it cascades from the archived player.
CREATE TABLE IF NOT EXISTS archived_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  archived_game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  recorded_at DATETIME NOT NULL,
  completed_tasks INT NOT NULL,
  INDEX idx_archived_progress_player (archived_game_id, user_id),
  CONSTRAINT fk_archived_progress_player FOREIGN KEY (archived_game_id, user_id)
    REFERENCES archived_game_players(archived_game_id, user_id) ON DELETE CASCADE
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Data: start time of games already started                         ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Their cards were generated when bingo started, so the earliest card marks the start.
UPDATE games g
JOIN (
  SELECT game_id, MIN(created_at) AS first_card_at
  FROM bingo_cards
  WHERE game_id IS NOT NULL
  GROUP BY game_id
) c ON c.game_id = g.id
SET g.started_at = c.first_card_at
WHERE g.started_at IS NULL AND g.status IN ('started', 'ended');

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Data: rebuilt history of games already started                    ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Only leaderboard rows with no progress point yet, so a second run adds nothing.
-- A zero point when the player's card was created...
INSERT INTO leaderboard_progress (game_id, user_id, recorded_at, completed_tasks)
SELECT tl.game_id, tl.user_id, bc.created_at, 0
FROM team_leaderboard tl
JOIN games g ON g.id = tl.game_id AND g.status IN ('started', 'ended')
JOIN bingo_cards bc ON bc.game_id = tl.game_id AND bc.user_id = tl.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM leaderboard_progress lp
  WHERE lp.game_id = tl.game_id AND lp.user_id = tl.user_id
);

-- ...then the running count of the cells completed now, in the order they last changed.
-- Players whose only point is the zero just written are the ones still to fill.
INSERT INTO leaderboard_progress (game_id, user_id, recorded_at, completed_tasks)
SELECT done.game_id, done.user_id, done.recorded_at, done.running_count
FROM (
  SELECT bc.game_id, bc.user_id,
         GREATEST(c.updated_at, bc.created_at) AS recorded_at,
         COUNT(*) OVER (
           PARTITION BY bc.id ORDER BY c.updated_at, c.id ROWS UNBOUNDED PRECEDING
         ) AS running_count
  FROM bingo_cells c
  JOIN bingo_cards bc ON bc.id = c.card_id
  JOIN games g ON g.id = bc.game_id AND g.status IN ('started', 'ended')
  JOIN team_leaderboard tl ON tl.game_id = bc.game_id AND tl.user_id = bc.user_id
  WHERE c.state IN ('completed', 'accomplished')
) done
WHERE (
  SELECT COUNT(*) FROM leaderboard_progress lp
  WHERE lp.game_id = done.game_id AND lp.user_id = done.user_id
) = 1;
