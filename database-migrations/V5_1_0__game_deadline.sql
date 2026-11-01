-- V5.1.0 — Game deadline
--
-- An optional last playable day. A game with no deadline only ends manually, so existing
-- games keep their behaviour with NULL. Spec: 16-games.md
--
-- Create_Column skips a column that already exists, so this is safe to run again.
CALL Create_Column('games', 'deadline', 'DATE', 1, NULL, NULL, NULL, NULL);
