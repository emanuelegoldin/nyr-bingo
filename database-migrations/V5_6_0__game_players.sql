-- V5.6.0 — Game Players
--
-- A game's players become an explicit roster instead of every member of its team, so a leader can
-- choose who plays and a player can leave a game. Every existing game keeps its team's current
-- members as players. Spec: 16-games.md
--
-- Safe to run again: CREATE TABLE IF NOT EXISTS skips an existing table, and INSERT IGNORE skips
-- rows that are already there.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 1 — The roster                                               ║
-- ╚═══════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS game_players (
  game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (game_id, user_id),
  CONSTRAINT fk_game_players_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_players_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_game_players_user (user_id)
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 2 — Existing games are played by their team's members        ║
-- ╚═══════════════════════════════════════════════════════════════════╝
INSERT IGNORE INTO game_players (game_id, user_id, joined_at)
SELECT g.id, m.user_id, m.joined_at
FROM games g
JOIN team_memberships m ON m.team_id = g.team_id;
