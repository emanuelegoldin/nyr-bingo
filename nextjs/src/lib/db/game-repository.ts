/**
 * Game Repository - Database operations for games
 * Spec Reference: 16-games.md
 */

import type { RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { GameStatus } from '../shared/types';
import { query } from './connection';
import { getTeamWithMembers } from './team-repository';
import type { Game, GameWithMembers } from './types';

interface GameRow extends RowDataPacket {
  id: string;
  team_id: string;
  name: string;
  status: GameStatus;
  created_at: Date;
  updated_at: Date;
  ended_at: Date | null;
  // Derived from the JOIN with teams
  team_name: string;
  leader_user_id: string;
  // Derived from LEFT JOIN with resolutions (scope='team')
  team_resolution_text: string | null;
}

const SELECT_GAME = `
  SELECT g.*, t.name AS team_name, t.leader_user_id,
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
