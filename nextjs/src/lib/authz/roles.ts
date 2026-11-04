/**
 * Role lookups: the role a user holds in a team, game or archived game.
 * Spec Reference: 21-authorization.md - Scopes and Roles
 */

import type { RowDataPacket } from 'mysql2/promise';
import { query } from '@/lib/db/connection';
import type { ArchiveScopeRole, GameScopeRole, TeamScopeRole } from './permissions';

/**
 * Get a user's role in a team.
 * @param teamId The team
 * @param userId The user
 * @returns `leader` or `member`, or null when the user is not a member (or the team does not exist)
 */
export async function getTeamRole(teamId: string, userId: string): Promise<TeamScopeRole | null> {
  const rows = await query<Array<RowDataPacket & { role: TeamScopeRole }>>(
    `SELECT role FROM team_memberships WHERE team_id = ? AND user_id = ?`,
    [teamId, userId]
  );
  return rows.length > 0 ? rows[0].role : null;
}

/**
 * Get a user's role in a game: a player who is a leader of the game's team leads the game.
 * The game's status is not checked here.
 * @param gameId The game
 * @param userId The user
 * @returns `leader` or `player`, or null when the user is not on the game's roster
 */
export async function getGameRole(gameId: string, userId: string): Promise<GameScopeRole | null> {
  const rows = await query<Array<RowDataPacket & { team_role: string | null }>>(
    `SELECT m.role AS team_role
     FROM game_players p
     JOIN games g ON g.id = p.game_id
     LEFT JOIN team_memberships m ON m.team_id = g.team_id AND m.user_id = p.user_id
     WHERE p.game_id = ? AND p.user_id = ?`,
    [gameId, userId]
  );
  if (rows.length === 0) return null;
  return rows[0].team_role === 'leader' ? 'leader' : 'player';
}

/**
 * Get a user's role in an archived game.
 * @param archivedGameId The archived game
 * @param userId The user
 * @returns `leader` or `player`, or null when the user did not take part in it
 */
export async function getArchiveRole(archivedGameId: string, userId: string): Promise<ArchiveScopeRole | null> {
  const rows = await query<Array<RowDataPacket & { is_leader: number }>>(
    `SELECT is_leader FROM archived_game_players WHERE archived_game_id = ? AND user_id = ?`,
    [archivedGameId, userId]
  );
  if (rows.length === 0) return null;
  return rows[0].is_leader ? 'leader' : 'player';
}

/**
 * Find the game a bingo cell belongs to.
 * @param cellId The cell
 * @returns The id of the cell's game, or null when the cell does not exist
 */
export async function getGameIdForCell(cellId: string): Promise<string | null> {
  const rows = await query<Array<RowDataPacket & { game_id: string }>>(
    `SELECT bc.game_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON bc.id = c.card_id
     WHERE c.id = ?`,
    [cellId]
  );
  return rows.length > 0 ? rows[0].game_id : null;
}

/**
 * Find the game a review thread belongs to, through its cell.
 * @param threadId The thread
 * @returns The id of the thread's game, or null when the thread or its cell does not exist
 */
export async function getGameIdForThread(threadId: string): Promise<string | null> {
  const rows = await query<Array<RowDataPacket & { game_id: string }>>(
    `SELECT bc.game_id
     FROM review_threads t
     JOIN bingo_cells c ON c.id = t.cell_id
     JOIN bingo_cards bc ON bc.id = c.card_id
     WHERE t.id = ?`,
    [threadId]
  );
  return rows.length > 0 ? rows[0].game_id : null;
}
