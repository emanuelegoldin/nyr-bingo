-- Team leaderboard persistence table
-- Spec: 12-team-tabs.md - Leaderboard data is persisted for efficient retrieval
-- instead of being computed on the fly from bingo_cells.

CREATE TABLE IF NOT EXISTS team_leaderboard (
  user_id VARCHAR(36) NOT NULL,
  team_id VARCHAR(36) NOT NULL,
  first_bingo_at DATETIME NULL,
  completed_tasks INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_team (user_id, team_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_team (team_id)
);
