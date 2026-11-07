/**
 * Helpers shared by the reactions DB tests: a teammate's card and direct reads of its reactions.
 * Spec Reference: 24-cell-reactions.md - Who Can React
 */

import { CellState } from '@/lib/shared/types';
import { addMember, createPlayingCard, createUser, type PlayingCardFixture, type UserFixture } from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';

/** A card owner's card in a running game, and two teammates who play it too. */
export interface ReactionSetup extends PlayingCardFixture {
  teammates: UserFixture[];
  cellId: string;
}

/**
 * Build a running game whose owner has one cell in the given state, with two teammates playing.
 * @param state The cell's state (default completed)
 * @returns The setup
 */
export const createReactionSetup = async (state: CellState = CellState.COMPLETED): Promise<ReactionSetup> => {
  const setup = await createPlayingCard([{ state }]);
  const teammates = [await createUser(), await createUser()];
  for (const teammate of teammates) {
    await addMember(setup.team, teammate);
    await execute('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)', [setup.game.id, teammate.id]);
  }
  return { ...setup, teammates, cellId: setup.card.cellIds[0] };
};

/**
 * Read the reactions on a cell, by reactor.
 * @param cellId The cell
 * @returns The reactor and emoji of each reaction
 */
export const readReactions = async (cellId: string): Promise<{ user_id: string; reaction: string }[]> =>
  query<{ user_id: string; reaction: string }[]>('SELECT user_id, reaction FROM cell_reactions WHERE cell_id = ? ORDER BY user_id', [cellId]);
