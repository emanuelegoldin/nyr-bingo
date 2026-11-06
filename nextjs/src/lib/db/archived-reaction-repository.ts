/**
 * Archived Reaction Repository - The cell reactions kept in an archived game
 * Spec Reference: 24-cell-reactions.md - Ended and Archived Games
 */

import type { ReactionId } from '../shared/reactions';
import { execute, query, type Executor } from './connection';

/** A reaction of an archived cell, with the cell it is on. */
export interface ArchivedReactionRow {
  user_id: string;
  position: number;
  reaction: ReactionId;
  pos_x: number;
  pos_y: number;
  rotation: number;
  scale: number;
}

/**
 * Copy the reactions on an ended game's cells into its archive, as plain values.
 * Only reactions on archived cells are copied: the archive's foreign key needs their row.
 * @param gameId The ended game, whose archived cells are already written under the same id
 * @param connection The archiving transaction
 */
export async function saveReactionSnapshot(gameId: string, connection: Executor): Promise<void> {
  await execute(
    `INSERT INTO archived_cell_reactions
       (archived_game_id, user_id, position, reactor_user_id, reaction, pos_x, pos_y, rotation, scale)
     SELECT bc.game_id, bc.user_id, c.position, r.user_id, r.reaction, r.pos_x, r.pos_y, r.rotation,
       r.scale
     FROM cell_reactions r
     JOIN bingo_cells c ON c.id = r.cell_id
     JOIN bingo_cards bc ON bc.id = c.card_id
     JOIN archived_cells ac
       ON ac.archived_game_id = bc.game_id AND ac.user_id = bc.user_id AND ac.position = c.position
     WHERE bc.game_id = ?`,
    [gameId],
    connection
  );
}

/**
 * Get the reactions on the cells of an archived game.
 * @param archivedGameId The archived game
 * @returns Every reaction, with the card owner and position of its cell
 */
export async function getArchivedReactions(archivedGameId: string): Promise<ArchivedReactionRow[]> {
  return query<ArchivedReactionRow[]>(
    `SELECT user_id, position, reaction, pos_x, pos_y, rotation, scale
     FROM archived_cell_reactions
     WHERE archived_game_id = ?
     ORDER BY reactor_user_id ASC`,
    [archivedGameId]
  );
}
