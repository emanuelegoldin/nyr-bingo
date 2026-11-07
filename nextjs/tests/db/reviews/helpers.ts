/**
 * Helpers shared by the reviews DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { CellState, GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createTeam as seedTeam,
  createUser,
  type UserFixture,
} from '../../support/db/fixtures';
import { query } from '../../support/db/test-connection';

/** A game with a card owner and two other players. */
export interface ReviewSetup {
  owner: UserFixture;
  voterA: UserFixture;
  voterB: UserFixture;
  cellId: string;
}

/**
 * Build a started game of three players where the owner's only cell is in the given state.
 * @param state The state of the owner's cell
 * @param gameStatus The game's status (default started)
 * @returns The players and the cell
 */
export const createReviewSetup = async (state: CellState, gameStatus = GameStatus.STARTED): Promise<ReviewSetup> => {
  const owner = await createUser();
  const voterA = await createUser();
  const voterB = await createUser();
  const team = await seedTeam(owner);
  await addMember(team, voterA);
  await addMember(team, voterB);
  const game = await seedGame(team, [owner, voterA, voterB], gameStatus);
  const card = await createCard(game, owner, [{ state }]);
  return { owner, voterA, voterB, cellId: card.cellIds[0] };
};

/** The persisted fields of a thread that the tests look at. */
export interface StoredThread {
  status: 'open' | 'closed';
  outcome: 'accomplished' | 'pending' | null;
  closed: number;
}

/**
 * Read a thread and its cell's state straight from the tables.
 * @param threadId The thread
 * @returns The thread's status, outcome and whether closed_at is set, with the cell state
 */
export const readThread = async (threadId: string): Promise<StoredThread & { cell_state: CellState }> => {
  const rows = await query<(StoredThread & { cell_state: CellState })[]>(
    `SELECT t.status, t.outcome, t.closed_at IS NOT NULL AS closed, c.state AS cell_state
       FROM review_threads t JOIN bingo_cells c ON c.id = t.cell_id WHERE t.id = ?`,
    [threadId]
  );
  return { ...rows[0], closed: Number(rows[0].closed) };
};
