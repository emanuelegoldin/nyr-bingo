/**
 * Leave Repository - Leaving a game or a team
 * Spec Reference: 16-games.md - Leaving a Game, 04-bingo-teams.md - Leaving a Team
 */

import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from './connection';
import { getRunningGamesForTeam } from './game-repository';
import { getCardReviewFiles, removeOrphanedFiles } from './review-file-repository';
import type { Game } from './types';

/** Outcome of a leave request; `status` is the HTTP status to report on failure. */
export type LeaveResult =
  | { success: true }
  | { success: false; status: 400; error: string };

/**
 * Find another leader among a game's players.
 * @param gameId The game
 * @param userId The player who wants to leave
 * @returns The id of another player who is a team leader, or null if there is none
 */
async function findOtherGameLeader(gameId: string, userId: string): Promise<string | null> {
  const rows = await query<Array<RowDataPacket & { user_id: string }>>(
    `SELECT p.user_id
     FROM game_players p
     JOIN games g ON g.id = p.game_id
     JOIN team_memberships m ON m.team_id = g.team_id AND m.user_id = p.user_id
     WHERE p.game_id = ? AND p.user_id <> ? AND m.role = 'leader'
     ORDER BY p.joined_at ASC, p.user_id ASC
     LIMIT 1`,
    [gameId, userId]
  );
  return rows.length > 0 ? rows[0].user_id : null;
}

/**
 * Check that a player may leave a game: a leader needs another leader among its players.
 * @param gameId The game
 * @param gameName The game's name, for the error
 * @param userId The player
 * @param isLeader Whether the player leads the game
 * @returns The id of the leader who takes over the team goal (null for a non-leader), or an error
 */
async function checkCanLeaveGame(
  gameId: string,
  gameName: string,
  userId: string,
  isLeader: boolean
): Promise<{ successor: string | null } | { error: string }> {
  if (!isLeader) {
    return { successor: null };
  }
  const successor = await findOtherGameLeader(gameId, userId);
  if (!successor) {
    return { error: `You are the only leader of "${gameName}". Promote another player to leader first.` };
  }
  return { successor };
}

/**
 * Remove a player from a game: their card (cells and threads cascade), the prepared resolutions
 * on it, their leaderboard row, the member-provided resolutions written for them and their
 * roster row. Resolutions they wrote for others stay. A team goal they own passes to `successor`.
 * @param connection The transaction
 * @param gameId The game
 * @param userId The leaving player
 * @param successor Another leader of the game, or null
 */
async function removePlayerFromGame(
  connection: PoolConnection,
  gameId: string,
  userId: string,
  successor: string | null
): Promise<void> {
  if (successor) {
    await execute(
      `UPDATE resolutions SET owner_user_id = ? WHERE game_id = ? AND scope = 'team' AND owner_user_id = ?`,
      [successor, gameId, userId],
      connection
    );
  }

  await execute(`DELETE FROM bingo_cards WHERE game_id = ? AND user_id = ?`, [gameId, userId], connection);
  await execute(`DELETE FROM team_leaderboard WHERE game_id = ? AND user_id = ?`, [gameId, userId], connection);
  await execute(
    `DELETE FROM resolutions WHERE game_id = ? AND scope = 'member_provided' AND to_user_id = ?`,
    [gameId, userId],
    connection
  );
  await execute(`DELETE FROM game_players WHERE game_id = ? AND user_id = ?`, [gameId, userId], connection);
}

/**
 * Leave a running game. The route checks that the user may leave it (spec 21: game.leave).
 * Spec: 16-games.md - Leaving a Game
 * @param game The running game
 * @param userId The player leaving
 * @param isLeader Whether the player leads the game
 * @returns Success, or the error and its HTTP status
 */
export async function leaveGame(game: Pick<Game, 'id' | 'name'>, userId: string, isLeader: boolean): Promise<LeaveResult> {
  const gameId = game.id;
  const check = await checkCanLeaveGame(gameId, game.name, userId, isLeader);
  if ('error' in check) {
    return { success: false, status: 400, error: check.error };
  }

  // Collected first: the card's deletion removes the rows that name these files
  const files = await getCardReviewFiles(gameId, userId);
  await withTransaction((connection) => removePlayerFromGame(connection, gameId, userId, check.successor));
  await removeOrphanedFiles(files);

  return { success: true };
}

/**
 * Leave a team, and with it every running game of the team the user plays.
 * The route checks that the user may leave it (spec 21: team.leave).
 * Spec: 04-bingo-teams.md - Leaving a Team
 * @param teamId The team
 * @param userId The member leaving
 * @param isLeader Whether the member is a team leader, and so leads every game they play
 * @returns Success, or the error and its HTTP status
 */
export async function leaveTeam(teamId: string, userId: string, isLeader: boolean): Promise<LeaveResult> {
  if (isLeader) {
    const otherLeaders = await query<RowDataPacket[]>(
      `SELECT 1 FROM team_memberships WHERE team_id = ? AND user_id <> ? AND role = 'leader' LIMIT 1`,
      [teamId, userId]
    );
    if (otherLeaders.length === 0) {
      return { success: false, status: 400, error: 'You are the only leader of this team. Promote another member to leader first.' };
    }
  }

  const games = await getRunningGamesForTeam(teamId, userId);
  const departures: Array<{ gameId: string; successor: string | null }> = [];
  for (const game of games) {
    const check = await checkCanLeaveGame(game.id, game.name, userId, isLeader);
    if ('error' in check) {
      return { success: false, status: 400, error: check.error };
    }
    departures.push({ gameId: game.id, successor: check.successor });
  }

  const files = (await Promise.all(departures.map(({ gameId }) => getCardReviewFiles(gameId, userId)))).flat();
  await withTransaction(async (connection) => {
    for (const { gameId, successor } of departures) {
      await removePlayerFromGame(connection, gameId, userId, successor);
    }
    await execute(`DELETE FROM team_memberships WHERE team_id = ? AND user_id = ?`, [teamId, userId], connection);
  });
  await removeOrphanedFiles(files);

  return { success: true };
}
