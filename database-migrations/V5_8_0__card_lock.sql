-- V5.8.0 — Card Lock
--
-- A card owner can shuffle their card until they lock it. locked_at is NULL while the card can
-- still be shuffled, so every existing card starts unlocked. Spec: 22-card-shuffle.md
--
-- Safe to run again: Create_Column does nothing when the column already exists.

CALL Create_Column('bingo_cards', 'locked_at', 'DATETIME', 1, NULL, NULL, NULL, NULL);
