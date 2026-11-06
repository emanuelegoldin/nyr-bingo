-- V5.13.0 — Cell Reactions
--
-- Players can put one emoji reaction on each of a teammate's completed or accomplished cells. The
-- server picks a random spot for it, stored as the reaction's center in percent of the cell.
-- Archived games keep the reactions their cards had. Spec: 24-cell-reactions.md, 18-game-archive.md
--
-- Safe to run again: CREATE TABLE IF NOT EXISTS skips what already exists. No data migration:
-- existing cells start with no reaction.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Reactions on live cells                                           ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- One reaction per player per cell. Deleted with the cell, and by every write that moves the
-- cell out of completed or accomplished.
CREATE TABLE IF NOT EXISTS cell_reactions (
  cell_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  reaction VARCHAR(32) NOT NULL,
  pos_x TINYINT UNSIGNED NOT NULL,
  pos_y TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cell_id, user_id),
  CONSTRAINT fk_cell_reactions_cell FOREIGN KEY (cell_id)
    REFERENCES bingo_cells(id) ON DELETE CASCADE,
  CONSTRAINT fk_cell_reactions_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Reactions on archived cells                                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- No reference to users (spec 18 Independence): it cascades from the archived cell.
CREATE TABLE IF NOT EXISTS archived_cell_reactions (
  archived_game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  position INT NOT NULL,
  reactor_user_id VARCHAR(36) NOT NULL,
  reaction VARCHAR(32) NOT NULL,
  pos_x TINYINT UNSIGNED NOT NULL,
  pos_y TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (archived_game_id, user_id, position, reactor_user_id),
  CONSTRAINT fk_archived_cell_reactions_cell FOREIGN KEY (archived_game_id, user_id, position)
    REFERENCES archived_cells(archived_game_id, user_id, position) ON DELETE CASCADE
);
