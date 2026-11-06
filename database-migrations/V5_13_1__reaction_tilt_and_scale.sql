-- V5.13.1 — Reaction Tilt and Scale
--
-- Each cell reaction also gets a random tilt (rotation in degrees, -45 to 45) and size (scale in
-- percent of the base size, 75 to 125), picked again every time the reaction is placed. Archived
-- reactions keep them. Spec: 24-cell-reactions.md, 18-game-archive.md
--
-- Safe to run again: Create_Column skips columns that already exist. Reactions stored before this
-- migration get no tilt and the base size, so they look as before.

CALL Create_Column('cell_reactions', 'rotation', 'TINYINT', 0, '0', NULL, NULL, NULL);
CALL Create_Column('cell_reactions', 'scale', 'TINYINT UNSIGNED', 0, '100', NULL, NULL, NULL);

CALL Create_Column('archived_cell_reactions', 'rotation', 'TINYINT', 0, '0', NULL, NULL, NULL);
CALL Create_Column('archived_cell_reactions', 'scale', 'TINYINT UNSIGNED', 0, '100', NULL, NULL, NULL);
