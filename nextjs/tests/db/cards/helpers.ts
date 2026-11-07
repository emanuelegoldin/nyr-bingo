/**
 * Helpers shared by the cards DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { it } from 'vitest';
import { CellSourceType, GameStatus, type GridSize } from '@/lib/shared/types';
import {
  addMember,
  createGame as seedGame,
  createTeam as seedTeam,
  createTeamGoal,
  createUser,
  type GameFixture,
  type TeamFixture,
  type UserFixture,
} from '../../support/db/fixtures';
import { query } from '../../support/db/test-connection';

/** A forming game with its team goal set. */
export interface FormingGameSetup {
  team: TeamFixture;
  game: GameFixture;
  players: UserFixture[];
}

/**
 * Build a forming game whose admin set the team goal ('Team goal').
 * @param playerCount How many players, the first being the admin (default 2)
 * @param gridSize The side length of its cards (default 5)
 * @returns The team, the game and its players
 */
export const createFormingGame = async (playerCount = 2, gridSize: GridSize = 5): Promise<FormingGameSetup> => {
  const players: UserFixture[] = [await createUser()];
  const team = await seedTeam(players[0]);
  for (let index = 1; index < playerCount; index++) {
    const member = await createUser();
    await addMember(team, member);
    players.push(member);
  }
  const game = await seedGame(team, players, GameStatus.FORMING, gridSize);
  await createTeamGoal(game, players[0]);
  return { team, game, players };
};

/** A generated cell as the tests look at it. */
export interface GeneratedCell {
  position: number;
  source_type: CellSourceType;
  source_user_id: string | null;
  resolution_id: string | null;
  title: string | null;
  state: string;
  completed_times: number;
}

/**
 * Read the cells of a player's card in a game, by position.
 * @param game The game
 * @param player The card owner
 * @returns The stored cells
 */
export const readCardCells = async (game: GameFixture, player: UserFixture): Promise<GeneratedCell[]> =>
  query<GeneratedCell[]>(
    `SELECT c.position, c.source_type, c.source_user_id, c.resolution_id, c.title, c.state, c.completed_times
       FROM bingo_cells c JOIN bingo_cards b ON b.id = c.card_id
      WHERE b.game_id = ? AND b.user_id = ?
      ORDER BY c.position`,
    [game.id, player.id]
  );

/**
 * Count a card's cells by source.
 * @param cells The card's cells
 * @param source The source type
 * @returns How many cells have it
 */
export const countSource = (cells: GeneratedCell[], source: CellSourceType): number =>
  cells.filter((cell) => cell.source_type === source).length;

/**
 * Count a card's prepared cells copied from one category of the pool.
 * @param game The game
 * @param player The card owner
 * @param category short, medium or long
 * @returns How many cells came from that category
 */
export const countPreparedFrom = async (game: GameFixture, player: UserFixture, category: string): Promise<number> => {
  const rows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total
       FROM bingo_cells c JOIN bingo_cards b ON b.id = c.card_id
       JOIN prepared_resolutions p ON p.title = c.title AND p.category = ?
      WHERE b.game_id = ? AND b.user_id = ? AND c.source_type = 'prepared'`,
    [category, game.id, player.id]
  );
  return Number(rows[0].total);
};
