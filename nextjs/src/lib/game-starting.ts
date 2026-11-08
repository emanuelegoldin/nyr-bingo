/**
 * Starting a game at the end of its preparation phase: when every player is ready, or at its preparation deadline.
 * Spec Reference: 16-games.md - Automatic Start
 */

import {
  areAllPlayersReady,
  getGamePlayerIds,
  getGameWithMembers,
  getGamesDueToStart,
  initializeGameLeaderboard,
  startGameWithCards,
} from './db';
import { notifications } from './notifications';
import { notifyTeams } from './team-signals';

/**
 * Start a game in preparation: generate the cards (and a goal if none is set), create the leaderboard rows, then
 * notify the players and refresh their pages.
 *
 * @param gameId - The game to start.
 * @returns False if the game could not start, e.g. because it already did.
 */
export async function startGame(gameId: string): Promise<boolean> {
  const result = await startGameWithCards(gameId);
  if (!result.success) return false;

  const game = await getGameWithMembers(gameId);
  if (game) {
    await initializeGameLeaderboard(game, await getGamePlayerIds(gameId));
    await notifyTeams([game.teamId]);
  }
  await notifications.publish({ type: 'game_started', gameId, actorUserId: null });
  return true;
}

/**
 * Start a game in preparation if every player is ready. Used right after a player becomes ready or leaves.
 * A failure is only logged: the sweep tries again.
 *
 * @param gameId - The game.
 * @returns True if the game started.
 */
export async function startGameIfAllReady(gameId: string): Promise<boolean> {
  try {
    return (await areAllPlayersReady(gameId)) && (await startGame(gameId));
  } catch (error) {
    console.error('Failed to start game after the last player was ready:', gameId, error);
    return false;
  }
}

/**
 * Start every game in preparation whose preparation deadline has passed or whose players are all ready.
 * A failure on one game does not stop the others, and a game that fails is tried again at the next run.
 */
export async function startDueGames(): Promise<void> {
  const games = await getGamesDueToStart();
  for (const game of games) {
    try {
      await startGame(game.id);
    } catch (error) {
      console.error('Failed to start game:', game.id, error);
    }
  }
}
