/**
 * Game Repository - Database operations for games
 * Spec Reference: 16-games.md
 */

import type { RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { GameStatus } from '../shared/types';
import { execute, query } from './connection';
import { getGameGoalResolution } from './resolution-repository';
import { getGameReviewFiles, removeOrphanedFiles } from './review-file-repository';
import { getTeamMembers, getTeamWithMembers, isTeamLeader } from './team-repository';
import type { Game, GameWithMembers } from './types';

interface GameRow extends RowDataPacket {
  id: string;
  team_id: string;
  name: string;
  status: GameStatus;
  created_at: Date;
  updated_at: Date;
  ended_at: Date | null;
  // The deadline as text: a DATE read as a Date object can shift a day when serialized
  deadline_date: string | null;
  // Derived from the JOIN with teams
  team_name: string;
  leader_user_id: string;
  // Derived from LEFT JOIN with resolutions (scope='team')
  team_resolution_text: string | null;
}

const SELECT_GAME = `
  SELECT g.*, CAST(g.deadline AS CHAR) AS deadline_date, t.name AS team_name, t.leader_user_id,
         COALESCE(r.description, r.title) AS team_resolution_text
  FROM games g
  JOIN teams t ON g.team_id = t.id
  LEFT JOIN resolutions r ON r.game_id = g.id AND r.scope = 'team'
`;

function rowToGame(row: GameRow): Game {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    leaderUserId: row.leader_user_id,
    name: row.name,
    teamResolutionText: row.team_resolution_text,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endedAt: row.ended_at,
    deadline: row.deadline_date,
  };
}

/**
 * Create a game for a team. It starts in forming status, with no goal and no resolutions.
 * Spec: 16-games.md - Game Creation
 * @param teamId The team that will play it
 * @param name The game's name
 * @returns The new game
 */
export async function createGame(teamId: string, name: string): Promise<Game> {
  const id = uuidv4();
  await query(
    `INSERT INTO games (id, team_id, name, status) VALUES (?, ?, ?, 'forming')`,
    [id, teamId, name]
  );

  const game = await getGameById(id);
  if (!game) {
    throw new Error('Game not found after creation');
  }
  return game;
}

/**
 * Get a game by ID, whatever its status.
 * @param id The game
 * @returns The game, or null if it does not exist
 */
export async function getGameById(id: string): Promise<Game | null> {
  const rows = await query<GameRow[]>(`${SELECT_GAME} WHERE g.id = ?`, [id]);
  return rows.length > 0 ? rowToGame(rows[0]) : null;
}

/**
 * Get a game that has not ended. Routes and pages use this, so an ended game is not found.
 * Spec: 16-games.md - Listing and Reading Games
 * @param id The game
 * @returns The game, or null if it does not exist or has ended
 */
export async function getRunningGame(id: string): Promise<Game | null> {
  const game = await getGameById(id);
  return game && game.status !== GameStatus.ENDED ? game : null;
}

/**
 * Get a running game with the members of its team.
 * @param id The game
 * @returns The game and its members, or null if it does not exist or has ended
 */
export async function getGameWithMembers(id: string): Promise<GameWithMembers | null> {
  const game = await getRunningGame(id);
  if (!game) return null;

  const team = await getTeamWithMembers(game.teamId);
  return team ? { ...game, members: team.members } : null;
}

/**
 * List the running games of a user's teams, newest first.
 * @param userId The user
 * @returns The games
 */
export async function getRunningGamesForUser(userId: string): Promise<Game[]> {
  const rows = await query<GameRow[]>(
    `${SELECT_GAME}
     JOIN team_memberships m ON m.team_id = g.team_id
     WHERE m.user_id = ? AND g.status <> 'ended'
     ORDER BY g.created_at DESC`,
    [userId]
  );
  return rows.map(rowToGame);
}

/**
 * List a team's running games, newest first.
 * @param teamId The team
 * @returns The games
 */
export async function getRunningGamesForTeam(teamId: string): Promise<Game[]> {
  const rows = await query<GameRow[]>(
    `${SELECT_GAME}
     WHERE g.team_id = ? AND g.status <> 'ended'
     ORDER BY g.created_at DESC`,
    [teamId]
  );
  return rows.map(rowToGame);
}

/**
 * Mark a started game as ended. Spec 16 requires this to come first, so nothing new can
 * start while the caller closes the game's open review threads.
 * Spec: 16-games.md - Ending a Game
 * @param gameId The game to end
 * @returns False if the game was not in started status
 */
export async function endGame(gameId: string): Promise<boolean> {
  // The status guard stops two concurrent ends, and ending a game that never started.
  const result = await execute(
    `UPDATE games SET status = 'ended', ended_at = NOW() WHERE id = ? AND status = 'started'`,
    [gameId]
  );
  return result.affectedRows > 0;
}

/**
 * Set or clear the deadline of a game. Only a forming game can be configured.
 * Spec: 16-games.md - Game Configuration
 * @param gameId The game
 * @param deadline The last playable day as YYYY-MM-DD, or null for no deadline
 * @returns False if the game was not in forming status
 */
export async function setGameDeadline(gameId: string, deadline: string | null): Promise<boolean> {
  const result = await execute(
    `UPDATE games SET deadline = ? WHERE id = ? AND status = 'forming'`,
    [deadline, gameId]
  );
  return result.affectedRows > 0;
}

/**
 * Check whether a deadline is over. The chosen day itself is still playable.
 * Spec: 16-games.md - Game Configuration
 * @param deadline The last playable day as YYYY-MM-DD
 * @returns True if that day is before today on the database clock
 */
export async function isDeadlinePast(deadline: string): Promise<boolean> {
  const rows = await query<Array<RowDataPacket & { is_past: number }>>(
    `SELECT ? < CURDATE() AS is_past`,
    [deadline]
  );
  return rows[0].is_past === 1;
}

/**
 * List the started games whose deadline is over.
 * Spec: 16-games.md - Ending a Game
 * @returns The games to end
 */
export async function getExpiredGames(): Promise<Game[]> {
  const rows = await query<GameRow[]>(
    `${SELECT_GAME} WHERE g.status = 'started' AND g.deadline < CURDATE()`
  );
  return rows.map(rowToGame);
}

/**
 * List the ended games that have not been archived yet.
 * Spec: 18-game-archive.md - Archiving a Game
 * @returns The games to archive
 */
export async function getEndedGames(): Promise<Game[]> {
  const rows = await query<GameRow[]>(`${SELECT_GAME} WHERE g.status = 'ended'`);
  return rows.map(rowToGame);
}

/**
 * Delete a game. This is a hard delete: ON DELETE CASCADE foreign keys remove its
 * resolutions, leaderboard rows and bingo cards (and their cells, reviews, etc.).
 * Spec: 16-games.md - Deleting a Game
 * @param gameId The game to delete
 */
export async function deleteGame(gameId: string): Promise<void> {
  // Collected first: the cascade below removes the rows that name these files
  const reviewFiles = await getGameReviewFiles(gameId);

  await query(`DELETE FROM games WHERE id = ?`, [gameId]);

  await removeOrphanedFiles(reviewFiles);
}

/**
 * Check which member-provided resolutions exist. Missing ones do not block the start: they
 * are replaced by prepared resolutions.
 * Spec: 16-games.md - Member-Provided Resolutions
 */
export async function checkAllResolutionsProvided(game: Pick<Game, 'id' | 'teamId'>): Promise<{
  ready: boolean;
  missing: { fromUserId: string; toUserId: string }[];
}> {
  // Get all team members
  const members = await getTeamMembers(game.teamId);
  const memberIds = members.map(m => m.userId);

  // If there are fewer than 2 members, there are no (from -> to) pairs required.
  // Spec: 16-games.md - each member is expected to provide one for every other member.
  // For a 1-person team, that is vacuously satisfied.
  if (memberIds.length < 2) {
    return { ready: true, missing: [] };
  }

  // Get all provided resolutions (from unified resolutions table)
  const providedRows = await query<{ owner_user_id: string; to_user_id: string }[]>(
    `SELECT owner_user_id, to_user_id FROM resolutions
     WHERE scope = 'member_provided' AND game_id = ?`,
    [game.id]
  );

  const providedSet = new Set(
    providedRows.map(r => `${r.owner_user_id}->${r.to_user_id}`)
  );

  // Check each pair
  const missing: { fromUserId: string; toUserId: string }[] = [];

  for (const fromId of memberIds) {
    for (const toId of memberIds) {
      if (fromId !== toId) {
        const key = `${fromId}->${toId}`;
        if (!providedSet.has(key)) {
          missing.push({ fromUserId: fromId, toUserId: toId });
        }
      }
    }
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Check whether the bingo game can start. startGameWithCards does the actual start.
 * Spec: 16-games.md - Start Conditions
 */
export async function checkGameCanStart(
  gameId: string,
  leaderUserId: string
): Promise<{ success: boolean; error?: string }> {
  const game = await getGameById(gameId);
  if (!game) {
    return { success: false, error: 'Game not found' };
  }

  // Only team leader can start
  const isLeader = await isTeamLeader(game.teamId, leaderUserId);
  if (!isLeader) {
    return { success: false, error: 'Only the team leader can start the game' };
  }

  // Check if game is still in forming status
  if (game.status !== GameStatus.FORMING) {
    return { success: false, error: 'Game is not in forming status' };
  }

  // A game must not start only to be ended by the next sweep
  if (game.deadline && await isDeadlinePast(game.deadline)) {
    return { success: false, error: 'The game deadline has passed' };
  }

  // Check if team resolution is set (via resolution entity)
  const teamGoal = await getGameGoalResolution(gameId);
  if (!teamGoal) {
    return { success: false, error: 'Team resolution must be set before starting' };
  }

  return { success: true };
}
