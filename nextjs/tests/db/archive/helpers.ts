/**
 * Helpers shared by the archive DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { archiveGame } from '@/lib/db/archived-game-repository';
import { getGameById } from '@/lib/db/game-repository';
import type { Game } from '@/lib/db/types';
import { CellState, GameStatus, ResolutionType } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createLeaderboardRow,
  createTeam as seedTeam,
  createUser,
  type GameFixture,
  type TeamFixture,
  type UserFixture,
} from '../../support/db/fixtures';

/** An ended game of an admin and a member, each with a card. */
export interface EndedGameSetup {
  admin: UserFixture;
  member: UserFixture;
  team: TeamFixture;
  game: GameFixture;
  adminCellIds: string[];
  memberCellIds: string[];
}

/**
 * Build an ended game of two players with cards and leaderboard rows.
 * The admin's card holds an accomplished base cell and a compound cell; the member's a pending cell.
 * @returns The players, the team, the game and the cells
 */
export const createEndedGame = async (): Promise<EndedGameSetup> => {
  const admin = await createUser();
  const member = await createUser();
  const team = await seedTeam(admin);
  await addMember(team, member);
  const game = await seedGame(team, [admin, member], GameStatus.ENDED);
  const adminCard = await createCard(game, admin, [
    { state: CellState.ACCOMPLISHED },
    { type: ResolutionType.COMPOUND },
  ]);
  const memberCard = await createCard(game, member, [{}]);
  await createLeaderboardRow(game, admin);
  await createLeaderboardRow(game, member);
  return { admin, member, team, game, adminCellIds: adminCard.cellIds, memberCellIds: memberCard.cellIds };
};

/**
 * Load the repository's view of a game, which archiveGame takes.
 * @param game The game
 * @returns The game
 */
export const loadGame = async (game: GameFixture): Promise<Game> => {
  const loaded = await getGameById(game.id);
  if (!loaded) throw new Error('Fixture game not found');
  return loaded;
};
