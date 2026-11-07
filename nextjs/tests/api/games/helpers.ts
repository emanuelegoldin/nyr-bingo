/**
 * Helpers shared by the game route tests: a game of an admin and a player, with one of them logged in.
 * Spec Reference: 16-games.md - Game Model
 */

import { GameStatus } from '@/lib/shared/types';
import { addMember, createGame, createTeam, createUser, type GameFixture, type TeamFixture, type UserFixture } from '../../support/db/fixtures';

/** A game whose team has an admin and a player who both play it. */
export interface GameSetup {
  admin: UserFixture;
  player: UserFixture;
  team: TeamFixture;
  game: GameFixture;
}

/**
 * Build a game of an admin and a player.
 * @param status The game's status (default started)
 * @returns The users, team and game
 */
export const createGameSetup = async (status: GameStatus = GameStatus.STARTED): Promise<GameSetup> => {
  const [admin, player] = [await createUser(), await createUser()];
  const team = await createTeam(admin);
  await addMember(team, player);
  const game = await createGame(team, [admin, player], status);
  return { admin, player, team, game };
};
