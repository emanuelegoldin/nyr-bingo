/**
 * Ending a game, by the leader or at its deadline, and archiving it.
 * Spec Reference: 16-games.md - Ending a Game, 18-game-archive.md - Archiving a Game
 */

import { archiveGame, closeOpenGameThreads, endGame, getEndedGames, getExpiredGames } from './db';
import type { Game } from './db';
import { notifyTeams, notifyThreadClosed } from './team-signals';

/**
 * Close the open review threads of an ended game, then archive it.
 *
 * @param game - The ended game.
 */
async function closeThreadsAndArchive(game: Game): Promise<void> {
  const closedThreadIds = await closeOpenGameThreads(game.id);
  await Promise.all(closedThreadIds.map(notifyThreadClosed));
  await archiveGame(game);
}

/**
 * End a started game, close its open review threads, archive it and signal the changes.
 * The game has ended once it is marked, so a later failure is only logged: the sweep
 * finishes the work.
 *
 * @param game - The game to end.
 * @returns False if the game was not in started status.
 */
export async function finishGame(game: Game): Promise<boolean> {
  const ended = await endGame(game.id);
  if (!ended) return false;

  try {
    await closeThreadsAndArchive(game);
  } catch (error) {
    console.error('Failed to archive ended game:', game.id, error);
  }

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

/**
 * Archive every game still in ended status: games that ended before the archive existed, and
 * games whose archiving failed. A failure on one game does not stop the others.
 */
export async function archiveEndedGames(): Promise<void> {
  const games = await getEndedGames();
  for (const game of games) {
    try {
      await closeThreadsAndArchive(game);
    } catch (error) {
      console.error('Failed to archive ended game:', game.id, error);
    }
  }
}
