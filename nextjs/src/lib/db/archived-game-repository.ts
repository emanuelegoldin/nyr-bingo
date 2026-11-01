/**
 * Archived Game Repository - Read-only snapshots of finished games
 * Spec Reference: 18-game-archive.md
 */

import type { RowDataPacket } from 'mysql2/promise';
import { getSourceLabel } from '../shared/cell-source';
import {
  CellSourceType,
  CellState,
  JOKER_POSITION,
  ResolutionType,
  type ArchivedCard,
  type ArchivedCell,
  type ArchivedGameDetail,
  type ArchivedGameSummary,
  type Subtask,
} from '../shared/types';
import { getBingoCard } from './bingo-card-repository';
import { execute, query, withTransaction } from './connection';
import { getGameLeaderboard } from './leaderboard-repository';
import { parseSubtasks } from './resolution-repository';
import { getTeamWithMembers } from './team-repository';
import type { BingoCellWithThread, Game } from './types';

interface ArchivedGameRow extends RowDataPacket {
  id: string;
  leader_user_id: string | null;
  name: string;
  team_name: string;
  ended_at: Date;
}

interface ArchivedPlayerRow extends RowDataPacket {
  user_id: string;
  player_name: string;
  leaderboard_rank: number | null;
  completed_tasks: number;
  first_bingo_at: Date | null;
}

interface ArchivedCellRow extends RowDataPacket {
  user_id: string;
  position: number;
  title: string;
  description: string | null;
  resolution_type: ResolutionType;
  state: CellState;
  source_type: CellSourceType;
  source_user_id: string | null;
  source_label: string;
  is_empty: number | boolean;
  number_of_repetition: number | null;
  completed_times: number | null;
}

interface ArchivedSubtaskRow extends RowDataPacket {
  user_id: string;
  position: number;
  title: string;
  description: string | null;
  completed: number | boolean;
}

interface ResolutionProgressRow extends RowDataPacket {
  id: string;
  subtasks: string | Subtask[] | null;
  number_of_repetition: number | null;
  completed_times: number | null;
}

/** A player's card and leaderboard line, ready to be written to the archive. */
interface PlayerSnapshot {
  userId: string;
  playerName: string;
  leaderboardRank: number | null;
  completedTasks: number;
  firstBingoAt: Date | null;
  cells: ArchivedCell[];
}

function rowToSummary(row: ArchivedGameRow): ArchivedGameSummary {
  return {
    id: row.id,
    leaderUserId: row.leader_user_id,
    name: row.name,
    teamName: row.team_name,
    endedAt: row.ended_at.toISOString(),
  };
}

/**
 * Key of a cell within one archived game.
 * @param userId The card's owner
 * @param position The cell's position
 * @returns A key for maps of cells
 */
function cellKey(userId: string, position: number): string {
  return `${userId}:${position}`;
}

/**
 * Check whether a game still has open review threads. Their cells are not final yet.
 * @param gameId The game
 * @returns True if at least one thread is open
 */
async function hasOpenThreads(gameId: string): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT rt.id
     FROM review_threads rt
     JOIN bingo_cells c ON rt.cell_id = c.id
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE bc.game_id = ? AND rt.status = 'open'
     LIMIT 1`,
    [gameId]
  );
  return rows.length > 0;
}

/**
 * Load the current progress of every resolution on a game's cards.
 * @param gameId The game
 * @returns The progress of each resolution, by resolution id
 */
async function getResolutionProgress(gameId: string): Promise<Map<string, ResolutionProgressRow>> {
  const rows = await query<ResolutionProgressRow[]>(
    `SELECT r.id, r.subtasks, r.number_of_repetition, r.completed_times
     FROM resolutions r
     WHERE r.id IN (
       SELECT c.resolution_id
       FROM bingo_cells c
       JOIN bingo_cards bc ON c.card_id = bc.id
       WHERE bc.game_id = ?
     )`,
    [gameId]
  );
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Copy a live cell into its archived form, as plain values.
 * @param cell The live cell
 * @param progress The cell's resolution, if it still exists
 * @param usernames Map of user id to username, for the source label
 * @returns The archived cell
 */
function snapshotCell(
  cell: BingoCellWithThread,
  progress: ResolutionProgressRow | undefined,
  usernames: Record<string, string>
): ArchivedCell {
  const isCompound = cell.resolutionType === ResolutionType.COMPOUND;
  const isIterative = cell.resolutionType === ResolutionType.ITERATIVE;

  return {
    position: cell.position,
    isJoker: false,
    isEmpty: cell.isEmpty,
    resolutionTitle: cell.resolutionTitle,
    resolutionText: cell.resolutionText,
    resolutionType: cell.resolutionType,
    state: cell.state,
    sourceType: cell.sourceType,
    sourceUserId: cell.sourceUserId,
    sourceLabel: getSourceLabel(cell, usernames),
    subtasks: isCompound && progress ? parseSubtasks(progress.subtasks) : null,
    numberOfRepetition: isIterative ? progress?.number_of_repetition ?? null : null,
    completedTimes: isIterative ? progress?.completed_times ?? null : null,
  };
}

/**
 * Read an ended game into plain values. Its players are the members with a card.
 * @param game The ended game
 * @returns One snapshot per player
 */
async function buildPlayerSnapshots(game: Game): Promise<PlayerSnapshot[]> {
  const team = await getTeamWithMembers(game.teamId);
  if (!team) {
    throw new Error(`Team not found for game ${game.id}`);
  }

  const usernames = Object.fromEntries(team.members.map((m) => [m.user.userId, m.user.username]));
  const progress = await getResolutionProgress(game.id);

  const cards = await Promise.all(
    team.members.map(async (member) => ({
      member,
      card: await getBingoCard(game.id, member.user.userId),
    }))
  );
  const players = cards.filter(({ card }) => card !== null);
  const playerIds = new Set(players.map(({ member }) => member.user.userId));

  const leaderboard = (await getGameLeaderboard(game.id)).filter((entry) => playerIds.has(entry.userId));

  return players.map(({ member, card }) => {
    const userId = member.user.userId;
    const rankIndex = leaderboard.findIndex((entry) => entry.userId === userId);
    const entry = rankIndex >= 0 ? leaderboard[rankIndex] : null;

    return {
      userId,
      playerName: member.user.displayName || member.user.username,
      leaderboardRank: rankIndex >= 0 ? rankIndex + 1 : null,
      completedTasks: entry?.completedTasks ?? 0,
      firstBingoAt: entry?.firstBingoAt ? new Date(entry.firstBingoAt) : null,
      cells: (card?.cells ?? [])
        .filter((cell) => !cell.isJoker)
        .map((cell) => snapshotCell(
          cell,
          cell.resolutionId ? progress.get(cell.resolutionId) : undefined,
          usernames
        )),
    };
  });
}

/**
 * Save a snapshot of an ended game, then delete the game and everything that cascades from it.
 * Both happen in one transaction, so a failure leaves the game to be archived again.
 * Proof files need no cleanup: closing a thread already removes them (spec 07).
 * Spec: 18-game-archive.md - Archiving a Game
 * @param game The ended game
 * @returns False if the game still has open threads and must wait
 */
export async function archiveGame(game: Game): Promise<boolean> {
  if (await hasOpenThreads(game.id)) return false;

  // Safe outside the transaction: nothing can change a game once it has ended
  const players = await buildPlayerSnapshots(game);

  await withTransaction(async (connection) => {
    await execute(
      `INSERT INTO archived_games (id, leader_user_id, name, team_name, ended_at)
       VALUES (?, ?, ?, ?, ?)`,
      [game.id, game.leaderUserId, game.name, game.teamName, game.endedAt ?? game.updatedAt],
      connection
    );

    for (const player of players) {
      await execute(
        `INSERT INTO archived_game_players
           (archived_game_id, user_id, player_name, leaderboard_rank, completed_tasks, first_bingo_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [game.id, player.userId, player.playerName, player.leaderboardRank, player.completedTasks, player.firstBingoAt],
        connection
      );

      for (const cell of player.cells) {
        await execute(
          `INSERT INTO archived_cells
             (archived_game_id, user_id, position, title, description, resolution_type, state,
              source_type, source_user_id, source_label, is_empty, number_of_repetition, completed_times)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            game.id,
            player.userId,
            cell.position,
            cell.resolutionTitle,
            cell.resolutionText !== cell.resolutionTitle ? cell.resolutionText : null,
            cell.resolutionType,
            cell.state,
            cell.sourceType,
            cell.sourceUserId,
            cell.sourceLabel,
            cell.isEmpty,
            cell.numberOfRepetition,
            cell.completedTimes,
          ],
          connection
        );

        for (const [subtaskIndex, subtask] of (cell.subtasks ?? []).entries()) {
          await execute(
            `INSERT INTO archived_cell_subtasks
               (archived_game_id, user_id, position, subtask_index, title, description, completed)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              game.id,
              player.userId,
              cell.position,
              subtaskIndex,
              subtask.title,
              subtask.description || null,
              subtask.completed,
            ],
            connection
          );
        }
      }
    }

    const deleted = await execute(
      `DELETE FROM games WHERE id = ? AND status = 'ended'`,
      [game.id],
      connection
    );
    if (deleted.affectedRows === 0) {
      throw new Error(`Game ${game.id} is no longer in ended status`);
    }
  });

  return true;
}

/**
 * List the archived games a user took part in, most recently ended first.
 * @param userId The user
 * @returns The archived games
 */
export async function getArchivedGamesForUser(userId: string): Promise<ArchivedGameSummary[]> {
  const rows = await query<ArchivedGameRow[]>(
    `SELECT a.*
     FROM archived_games a
     JOIN archived_game_players p ON p.archived_game_id = a.id
     WHERE p.user_id = ?
     ORDER BY a.ended_at DESC`,
    [userId]
  );
  return rows.map(rowToSummary);
}

/**
 * Get an archived game's summary.
 * @param id The archived game
 * @returns The summary, or null if it does not exist
 */
export async function getArchivedGameSummary(id: string): Promise<ArchivedGameSummary | null> {
  const rows = await query<ArchivedGameRow[]>(`SELECT * FROM archived_games WHERE id = ?`, [id]);
  return rows.length > 0 ? rowToSummary(rows[0]) : null;
}

/**
 * Load the cards of an archived game, in player order.
 * @param id The archived game
 * @param players The game's players
 * @returns One card per player, with the implicit Joker added
 */
async function getArchivedCards(id: string, players: ArchivedPlayerRow[]): Promise<ArchivedCard[]> {
  const cellRows = await query<ArchivedCellRow[]>(
    `SELECT * FROM archived_cells WHERE archived_game_id = ? ORDER BY position ASC`,
    [id]
  );
  const subtaskRows = await query<ArchivedSubtaskRow[]>(
    `SELECT * FROM archived_cell_subtasks WHERE archived_game_id = ? ORDER BY subtask_index ASC`,
    [id]
  );

  const subtasksByCell = new Map<string, Subtask[]>();
  for (const row of subtaskRows) {
    const key = cellKey(row.user_id, row.position);
    subtasksByCell.set(key, [
      ...(subtasksByCell.get(key) ?? []),
      { title: row.title, description: row.description ?? '', completed: Boolean(row.completed) },
    ]);
  }

  return players.map((player) => {
    const cells: ArchivedCell[] = cellRows
      .filter((row) => row.user_id === player.user_id)
      .map((row) => ({
        position: row.position,
        isJoker: false,
        isEmpty: Boolean(row.is_empty),
        resolutionTitle: row.title,
        resolutionText: row.description ?? row.title,
        resolutionType: row.resolution_type,
        state: row.state,
        sourceType: row.source_type,
        sourceUserId: row.source_user_id,
        sourceLabel: row.source_label,
        subtasks: subtasksByCell.get(cellKey(row.user_id, row.position)) ?? null,
        numberOfRepetition: row.number_of_repetition,
        completedTimes: row.completed_times,
      }));

    cells.push({
      position: JOKER_POSITION,
      isJoker: true,
      isEmpty: false,
      resolutionTitle: 'Joker',
      resolutionText: 'Joker',
      resolutionType: ResolutionType.BASE,
      state: CellState.PENDING,
      sourceType: CellSourceType.TEAM,
      sourceUserId: null,
      sourceLabel: '',
      subtasks: null,
      numberOfRepetition: null,
      completedTimes: null,
    });
    cells.sort((a, b) => a.position - b.position);

    return { userId: player.user_id, playerName: player.player_name, cells };
  });
}

/**
 * Get an archived game with its leaderboard and cards.
 * @param id The archived game
 * @returns The archived game, or null if it does not exist
 */
export async function getArchivedGame(id: string): Promise<ArchivedGameDetail | null> {
  const summary = await getArchivedGameSummary(id);
  if (!summary) return null;

  const players = await query<ArchivedPlayerRow[]>(
    `SELECT * FROM archived_game_players
     WHERE archived_game_id = ?
     ORDER BY leaderboard_rank IS NULL, leaderboard_rank ASC, player_name ASC`,
    [id]
  );

  return {
    ...summary,
    leaderboard: players
      .filter((player) => player.leaderboard_rank !== null)
      .map((player) => ({
        userId: player.user_id,
        username: player.player_name,
        displayName: null,
        firstBingoAt: player.first_bingo_at ? player.first_bingo_at.toISOString() : null,
        completedTasks: player.completed_tasks,
      })),
    cards: await getArchivedCards(id, players),
  };
}

/**
 * Check whether a user took part in an archived game.
 * @param id The archived game
 * @param userId The user
 * @returns True if the user is one of its players
 */
export async function isArchivedGamePlayer(id: string, userId: string): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT user_id FROM archived_game_players WHERE archived_game_id = ? AND user_id = ?`,
    [id, userId]
  );
  return rows.length > 0;
}

/**
 * Delete an archived game. Its players, cells and subtasks cascade with it.
 * @param id The archived game
 */
export async function deleteArchivedGame(id: string): Promise<void> {
  await execute(`DELETE FROM archived_games WHERE id = ?`, [id]);
}
