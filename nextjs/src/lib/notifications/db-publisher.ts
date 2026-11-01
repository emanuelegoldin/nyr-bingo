/**
 * MariaDB implementation of the notification publisher (spec 19).
 * Events wait in `notification_events` until the dispatcher releases them.
 */

import { v4 as uuidv4 } from 'uuid';
import { execute, query } from '../db/connection';
import type { NotificationEvent, NotificationPublisher } from './types';

/** The names an event keeps, so it outlives its team and game. */
interface EventContext {
  teamId: string;
  teamName: string;
  gameId: string | null;
  gameName: string | null;
}

/**
 * Run a publisher operation and log any failure.
 *
 * @param work - The operation.
 */
async function logFailure(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error('[notifications] failed:', error);
  }
}

/**
 * Load the names of an event's team and game.
 *
 * @param event - The event.
 * @returns The names, or null if the team or game no longer exists.
 */
async function loadContext(event: NotificationEvent): Promise<EventContext | null> {
  if ('teamId' in event) {
    const teams = await query<Array<{ name: string }>>(`SELECT name FROM teams WHERE id = ?`, [event.teamId]);
    return teams[0]
      ? { teamId: event.teamId, teamName: teams[0].name, gameId: null, gameName: null }
      : null;
  }

  const games = await query<Array<{ team_id: string; team_name: string; game_name: string }>>(
    `SELECT g.team_id, t.name AS team_name, g.name AS game_name
     FROM games g JOIN teams t ON g.team_id = t.id
     WHERE g.id = ?`,
    [event.gameId]
  );
  const game = games[0];
  return game
    ? { teamId: game.team_id, teamName: game.team_name, gameId: event.gameId, gameName: game.game_name }
    : null;
}

/**
 * Whether a player's bingo in a game was already announced, or is about to be.
 *
 * @param gameId - The game.
 * @param userId - The player.
 * @returns True if an event exists.
 */
async function hasBingoEvent(gameId: string, userId: string): Promise<boolean> {
  const rows = await query<unknown[]>(
    `SELECT 1 FROM notification_events
     WHERE type = 'bingo_scored' AND game_id = ? AND actor_user_id = ?
     LIMIT 1`,
    [gameId, userId]
  );
  return rows.length > 0;
}

export const dbPublisher: NotificationPublisher = {
  publish: (event) => logFailure(async () => {
    if (event.type === 'bingo_scored' && await hasBingoEvent(event.gameId, event.actorUserId)) return;

    const context = await loadContext(event);
    if (!context) return;

    await execute(
      `INSERT INTO notification_events
         (id, type, team_id, team_name, game_id, game_name, actor_user_id, target_user_id, cell_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        event.type,
        context.teamId,
        context.teamName,
        context.gameId,
        context.gameName,
        event.actorUserId,
        'targetUserId' in event ? event.targetUserId : null,
        'cellId' in event ? event.cellId : null,
      ]
    );
  }),

  cancelCell: (cellId) => logFailure(async () => {
    await execute(`DELETE FROM notification_events WHERE cell_id = ? AND published_at IS NULL`, [cellId]);
  }),

  cancelBingo: (gameId, userId) => logFailure(async () => {
    await execute(
      `DELETE FROM notification_events
       WHERE type = 'bingo_scored' AND game_id = ? AND actor_user_id = ? AND published_at IS NULL`,
      [gameId, userId]
    );
  }),
};
