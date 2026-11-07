/**
 * Helpers shared by the leaderboard DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { CellState, GameStatus, type GridSize } from '@/lib/shared/types';
import {
  createCard,
  createGame as seedGame,
  createLeaderboardRow,
  createTeam as seedTeam,
  createUser,
  type CellFixtureInput,
  type GameFixture,
  type UserFixture,
} from '../../support/db/fixtures';
import { query } from '../../support/db/test-connection';

/** A player with a card in a started game, and a leaderboard row with no bingo. */
export interface BingoSetup {
  player: UserFixture;
  game: GameFixture;
  cellIds: string[];
}

/**
 * Build a started game of one player whose card holds the given cells.
 * @param gridSize The side length of the card
 * @param cells The stored cells, each at its own position
 * @returns The player, the game and the cell ids in the order given
 */
export const createBingoCard = async (gridSize: GridSize, cells: CellFixtureInput[]): Promise<BingoSetup> => {
  const player = await createUser();
  const game = await seedGame(await seedTeam(player), [player], GameStatus.STARTED, gridSize);
  const card = await createCard(game, player, cells);
  await createLeaderboardRow(game, player);
  return { player, game, cellIds: card.cellIds };
};

/**
 * Cells in one state at the given positions.
 * @param positions The positions
 * @param state The state of every cell (default completed)
 * @returns The cell inputs
 */
export const cellsAt = (positions: number[], state: CellState = CellState.COMPLETED): CellFixtureInput[] =>
  positions.map((position) => ({ position, state }));

/**
 * Read the stored first-bingo time of a player.
 * @param setup The player and game
 * @returns The time as 'YYYY-MM-DD hh:mm:ss', or null without a bingo
 */
export const readFirstBingoAt = async ({ game, player }: BingoSetup): Promise<string | null> => {
  const rows = await query<{ first_bingo_at: string | null }[]>(
    'SELECT CAST(first_bingo_at AS CHAR) AS first_bingo_at FROM team_leaderboard WHERE game_id = ? AND user_id = ?',
    [game.id, player.id]
  );
  return rows[0].first_bingo_at;
};
