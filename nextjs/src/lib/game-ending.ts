/**
 * Ending a game, by the leader or at its deadline.
 * Spec Reference: 16-games.md - Ending a Game
 */

import { closeOpenGameThreads, endGame, getExpiredGames } from './db';
import type { Game } from './db';
import { notifyTeams, notifyThreadClosed } from './team-signals';

/**
 * End a started game, close its open review threads and signal the changes.
 *
 * @param game - The game to end.
 * @returns False if the game was not in started status.
 */
export async function finishGame(game: Pick<Game, 'id' | 'teamId'>): Promise<boolean> {
  const ended = await endGame(game.id);
  if (!ended) return false;

  const closedThreadIds = await closeOpenGameThreads(game.id);
  await Promise.all(closedThreadIds.map(notifyThreadClosed));
  await notifyTeams([game.teamId]);
  return true;
}

/**
 * End every started game whose deadline is over. A failure on one game does not stop the
 * others, and a game that fails before it is marked ended is tried again at the next run.
 */
export async function finishExpiredGames(): Promise<void> {
  const games = await getExpiredGames();
  for (const game of games) {
    try {
      await finishGame(game);
    } catch (error) {
      console.error('Failed to end expired game:', game.id, error);
    }
  }
}
