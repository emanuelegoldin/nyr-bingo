-- V5.14.0 — Game Preparation Phase
--
-- A forming game is now a preparation phase with a fixed deadline, during which players write their
-- own resolutions for the game and mark themselves ready. Personal resolutions belong to a game
-- (resolutions.game_id set); the old ones without a game stay read-only until 2027-05-08.
-- Spec: 16-games.md (Preparation Phase), 03-personal-resolutions.md
--
-- Safe to run again: Create_Column skips columns that already exist, the deadline is only set where
-- it is NULL, and the backfill only creates rows whose id does not exist yet.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Preparation deadline and readiness                                ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- In UTC. Set at creation and never changed; NULL for games that started before this migration.
CALL Create_Column('games', 'preparation_deadline', 'DATETIME', 1, NULL, NULL, NULL, NULL);
-- When the player marked themselves ready, or NULL.
CALL Create_Column('game_players', 'ready_at', 'DATETIME', 1, NULL, NULL, NULL, NULL);

-- Games already in preparation get a week from now.
UPDATE games
SET preparation_deadline = UTC_TIMESTAMP() + INTERVAL 7 DAY
WHERE status = 'forming' AND preparation_deadline IS NULL;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Backfill the Personal tab of started games                        ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Every personal cell of a started game becomes a personal resolution of that game, owned by the
-- card owner, copied from the cell's snapshot. The new row takes the cell's id, so a second run
-- finds it and skips the cell. The cell is then linked to it, which card editing needs to know the
-- resolution is already on the card. The legacy row the cell came from is left as it is.
INSERT INTO resolutions
  (id, owner_user_id, title, description, resolution_type, scope, team_id, game_id, subtasks, number_of_repetition)
SELECT
  c.id,
  b.user_id,
  c.title,
  c.description,
  c.resolution_type,
  'personal',
  g.team_id,
  g.id,
  IF(c.resolution_type = 'compound',
     (SELECT JSON_ARRAYAGG(JSON_OBJECT('title', s.title, 'description', COALESCE(s.description, ''))
                           ORDER BY s.subtask_index)
        FROM bingo_cell_subtasks s
       WHERE s.cell_id = c.id),
     NULL),
  IF(c.resolution_type = 'iterative', c.number_of_repetition, NULL)
FROM bingo_cells c
JOIN bingo_cards b ON b.id = c.card_id
JOIN games g ON g.id = b.game_id
WHERE g.status = 'started'
  AND c.source_type = 'personal'
  AND c.title IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM resolutions r WHERE r.id = c.id);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Backfill the Teammates tab of started games                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Member-provided resolutions are already rows of their game. Only one whose row was deleted
-- (the cell lost its link) is recreated from the cell, when its author still plays the game and
-- has no resolution for that player. INSERT IGNORE leaves the existing row alone if the unique key
-- (game_id, owner_user_id, to_user_id) is already taken.
INSERT IGNORE INTO resolutions
  (id, owner_user_id, title, description, resolution_type, scope, team_id, game_id, to_user_id, subtasks,
   number_of_repetition)
SELECT
  c.id,
  c.source_user_id,
  c.title,
  c.description,
  c.resolution_type,
  'member_provided',
  g.team_id,
  g.id,
  b.user_id,
  IF(c.resolution_type = 'compound',
     (SELECT JSON_ARRAYAGG(JSON_OBJECT('title', s.title, 'description', COALESCE(s.description, ''))
                           ORDER BY s.subtask_index)
        FROM bingo_cell_subtasks s
       WHERE s.cell_id = c.id),
     NULL),
  IF(c.resolution_type = 'iterative', c.number_of_repetition, NULL)
FROM bingo_cells c
JOIN bingo_cards b ON b.id = c.card_id
JOIN games g ON g.id = b.game_id
WHERE g.status = 'started'
  AND c.source_type = 'member_provided'
  AND c.resolution_id IS NULL
  AND c.source_user_id IS NOT NULL
  AND c.title IS NOT NULL
  AND EXISTS (SELECT 1 FROM game_players p WHERE p.game_id = g.id AND p.user_id = c.source_user_id)
  AND NOT EXISTS (
    SELECT 1 FROM resolutions r
     WHERE r.game_id = g.id AND r.scope = 'member_provided'
       AND r.owner_user_id = c.source_user_id AND r.to_user_id = b.user_id
  );

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Link the cells to their new resolutions                           ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- A row whose id is the cell's id was created from that cell above, by this migration.
UPDATE bingo_cells c
JOIN resolutions r ON r.id = c.id
SET c.resolution_id = r.id
WHERE c.source_type IN ('personal', 'member_provided')
  AND (c.resolution_id IS NULL OR c.resolution_id <> r.id);
