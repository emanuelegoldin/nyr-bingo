-- V5.10.0 — Game Grid Size
--
-- The admin picks a 3x3, 5x5 or 9x9 card size when creating a game, and it never changes.
-- Every existing game, and every archived game, was played on 5x5 cards. The allowed values are
-- checked by the game creation route. Spec: 16-games.md, 18-game-archive.md
--
-- Safe to run again: Create_Column does nothing when the column already exists.

CALL Create_Column('games', 'grid_size', 'TINYINT', 0, '5', NULL, NULL, NULL);
CALL Create_Column('archived_games', 'grid_size', 'TINYINT', 0, '5', NULL, NULL, NULL);
