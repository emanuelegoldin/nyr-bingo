-- V5.7.0 — Multiple Team Leaders
--
-- A team can have several leaders: every membership with role = 'leader'. The single
-- teams.leader_user_id column goes away, and so does archived_games.leader_user_id, replaced by a
-- flag on each archived player. Specs: 04-bingo-teams.md, 18-game-archive.md
--
-- MariaDB DDL cannot be rolled back, so every step is safe to run again after a partial failure:
-- each step that reads a column to be dropped is skipped once that column is gone.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 1 — Every teams.leader_user_id has the leader role           ║
-- ╚═══════════════════════════════════════════════════════════════════╝
SET @has_team_leader := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'teams'
    AND COLUMN_NAME = 'leader_user_id'
);
SET @sync_leader_role := IF(
  @has_team_leader = 1,
  "UPDATE team_memberships m
   JOIN teams t ON t.id = m.team_id AND t.leader_user_id = m.user_id
   SET m.role = 'leader'
   WHERE m.role <> 'leader'",
  'SELECT 1'
);
PREPARE stmt FROM @sync_leader_role;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 2 — Remove teams.leader_user_id                              ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Drop_Column also drops the foreign key to users.
CALL Drop_Column('teams', 'leader_user_id');

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 3 — Flag the leaders of each archived game                   ║
-- ╚═══════════════════════════════════════════════════════════════════╝
CALL Create_Column('archived_game_players', 'is_leader', 'TINYINT(1)', 0, '0', NULL, NULL, NULL);

SET @has_archive_leader := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'archived_games'
    AND COLUMN_NAME = 'leader_user_id'
);
SET @flag_archive_leaders := IF(
  @has_archive_leader = 1,
  "UPDATE archived_game_players p
   JOIN archived_games a ON a.id = p.archived_game_id AND a.leader_user_id = p.user_id
   SET p.is_leader = 1",
  'SELECT 1'
);
PREPARE stmt FROM @flag_archive_leaders;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Step 4 — Remove archived_games.leader_user_id                     ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Last on purpose: Step 3 reads it, so a failed run can pick up from the start.
CALL Drop_Column('archived_games', 'leader_user_id');
