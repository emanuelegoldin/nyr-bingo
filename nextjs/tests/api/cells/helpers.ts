/**
 * Helpers shared by the cell route tests: a card in a running game and its owner's teammate.
 * Spec Reference: 21-authorization.md - Status Rules
 */

import { addMember, createPlayingCard, createUser, type CellFixtureInput, type PlayingCardFixture, type UserFixture } from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';

/** A card in a running game, with a teammate who plays the game too. */
export interface CellSetup extends PlayingCardFixture {
  teammate: UserFixture;
  cellId: string;
}

/**
 * Build a running game where the owner has a card with one cell, and a teammate also plays.
 * @param cell What the cell holds
 * @returns The setup
 */
export const createCellSetup = async (cell: CellFixtureInput = {}): Promise<CellSetup> => {
  const setup = await createPlayingCard([cell]);
  const teammate = await createUser();
  await addMember(setup.team, teammate);
  await execute('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)', [setup.game.id, teammate.id]);
  return { ...setup, teammate, cellId: setup.card.cellIds[0] };
};

/**
 * Read the stored state and progress of a cell.
 * @param cellId The cell
 * @returns Its state and counter
 */
export const readCellState = async (cellId: string): Promise<{ state: string; completed_times: number }> => {
  const rows = await query<{ state: string; completed_times: number }[]>('SELECT state, completed_times FROM bingo_cells WHERE id = ?', [cellId]);
  return rows[0];
};
