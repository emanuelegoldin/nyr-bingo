/**
 * Archived Game Repository - Read-only snapshots of finished games
 * Spec Reference: 18-game-archive.md
 */

import type { RowDataPacket } from 'mysql2/promise';
import { getSourceLabel } from '../shared/cell-source';
import {
  CellSourceType,
  CellState,
  getJokerPosition,
  ResolutionType,
  TeamRole,
  type ArchivedCard,
  type ArchivedCell,
  type ArchivedGameDetail,
  type ArchivedGameSummary,
  type CellSourceLabel,
  type CellSubtask,
} from '../shared/types';
import type { CellReactionMark } from '../shared/reactions';
import { getArchivedProgress, saveProgressSnapshot } from './archived-progress-repository';
import { getArchivedReactions, saveReactionSnapshot } from './archived-reaction-repository';
import { getBingoCard } from './bingo-card-repository';
import {
  buildThreadSnapshots,
  getArchivedGameThreadFiles,
  getArchivedThreads,
  saveThreadSnapshots,
} from './archived-thread-repository';
import { execute, query, withTransaction } from './connection';
import { getGamePlayerIds } from './game-repository';
import { getGameLeaderboard } from './leaderboard-repository';
import { removeOrphanedFiles } from './review-file-repository';
import { getTeamWithMembers } from './team-repository';
import type { BingoCellWithThread, Game } from './types';

/**
 * Text stored in `source_label` for each fixed source. The snapshot keeps the format it had
 * before the label became language-neutral, so older archives read the same way (spec 15, 18).
 */
const STORED_SOURCE_TEXT: Record<Exclude<CellSourceLabel['kind'], 'member'>, string> = {
  team: 'Team Goal',
  prepared: 'Suggested',
  personal: 'Personal',
  formerTeammates: 'Former Teammates',
};

/**
 * Turn a source label into the text stored in the snapshot.
 *
 * @param label - The source label.
 * @returns The member's name, or the stored text of the fixed source.
 */
function toStoredSourceText(label: CellSourceLabel): string {
  return label.kind === 'member' ? label.name : STORED_SOURCE_TEXT[label.kind];
}

/**
 * Read a stored source text back into a source label.
 *
 * @param sourceType - The cell's source type.
 * @param storedText - The text stored in `source_label`.
 * @returns The source label.
 */
function fromStoredSourceText(sourceType: CellSourceType, storedText: string): CellSourceLabel {
  if (sourceType === CellSourceType.TEAM) return { kind: 'team' };
  if (sourceType === CellSourceType.PREPARED) return { kind: 'prepared' };
  if (sourceType === CellSourceType.MEMBER_PROVIDED) {
    return storedText === STORED_SOURCE_TEXT.formerTeammates
      ? { kind: 'formerTeammates' }
      : { kind: 'member', name: storedText };
  }
  return { kind: 'personal' };
}

interface ArchivedGameRow extends RowDataPacket {
  id: string;
  name: string;
  team_name: string;
  started_at: Date | null;
  ended_at: Date;
  grid_size: number;
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

interface CellProgressRow extends RowDataPacket {
  id: string;
  number_of_repetition: number | null;
  completed_times: number;
}

interface CellSubtaskProgressRow extends RowDataPacket {
  cell_id: string;
  title: string;
  description: string | null;
  completed: number | boolean;
}

/** The progress a live cell holds. */
interface CellProgress {
  numberOfRepetition: number | null;
  completedTimes: number;
  subtasks: CellSubtask[];
}

/** A player's card and leaderboard line, ready to be written to the archive. */
interface PlayerSnapshot {
  userId: string;
  playerName: string;
  isLeader: boolean;
  leaderboardRank: number | null;
  completedTasks: number;
  firstBingoAt: Date | null;
  cells: ArchivedCell[];
}

function rowToSummary(row: ArchivedGameRow): ArchivedGameSummary {
  return {
    id: row.id,
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
 * Load the progress of every cell on a game's cards.
 * @param gameId The game
 * @returns The progress of each cell, by cell id
 */
async function getCellProgress(gameId: string): Promise<Map<string, CellProgress>> {
  const [cells, subtasks] = await Promise.all([
    query<CellProgressRow[]>(
      `SELECT c.id, c.number_of_repetition, c.completed_times
       FROM bingo_cells c
       JOIN bingo_cards bc ON c.card_id = bc.id
       WHERE bc.game_id = ?`,
      [gameId]
    ),
    query<CellSubtaskProgressRow[]>(
      `SELECT s.cell_id, s.title, s.description, s.completed
       FROM bingo_cell_subtasks s
       JOIN bingo_cells c ON s.cell_id = c.id
       JOIN bingo_cards bc ON c.card_id = bc.id
       WHERE bc.game_id = ?
       ORDER BY s.cell_id, s.subtask_index`,
      [gameId]
    ),
  ]);

  const progress = new Map<string, CellProgress>(cells.map((row) => [row.id, {
    numberOfRepetition: row.number_of_repetition,
    completedTimes: row.completed_times,
    subtasks: [],
  }]));
  for (const row of subtasks) {
    progress.get(row.cell_id)?.subtasks.push({
      title: row.title,
      description: row.description ?? '',
      completed: Boolean(row.completed),
    });
  }
  return progress;
}

/**
 * Copy a live cell into its archived form, as plain values.
 * @param cell The live cell
 * @param progress The cell's progress
 * @param usernames Map of user id to username, for the source label
 * @returns The archived cell
 */
function snapshotCell(
  cell: BingoCellWithThread,
  progress: CellProgress | undefined,
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
    subtasks: isCompound && progress ? progress.subtasks : null,
    numberOfRepetition: isIterative ? progress?.numberOfRepetition ?? null : null,
    completedTimes: isIterative ? progress?.completedTimes ?? null : null,
    // Copied straight from the live table by saveReactionSnapshot
    reactions: [],
  };
}

/**
 * Read an ended game into plain values. Its players are the roster members with a card. A
 * member-provided cell whose author is no longer a player is labelled "Former Teammates".
 * @param game The ended game
 * @returns One snapshot per player
 */
async function buildPlayerSnapshots(game: Game): Promise<PlayerSnapshot[]> {
  const team = await getTeamWithMembers(game.teamId);
  if (!team) {
    throw new Error(`Team not found for game ${game.id}`);
  }

  const rosterIds = new Set(await getGamePlayerIds(game.id));
  const roster = team.members.filter((member) => rosterIds.has(member.user.userId));
  const usernames = Object.fromEntries(roster.map((m) => [m.user.userId, m.user.username]));
  const progress = await getCellProgress(game.id);

  const cards = await Promise.all(
    roster.map(async (member) => ({
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
      isLeader: member.membership.role === TeamRole.LEADER,
      leaderboardRank: rankIndex >= 0 ? rankIndex + 1 : null,
      completedTasks: entry?.completedTasks ?? 0,
      firstBingoAt: entry?.firstBingoAt ? new Date(entry.firstBingoAt) : null,
      cells: (card?.cells ?? [])
        .filter((cell) => !cell.isJoker)
        .map((cell) => snapshotCell(
          cell,
          progress.get(cell.id),
          usernames
        )),
    };
  });
}

/**
 * Save a snapshot of an ended game, then delete the game and everything that cascades from it.
 * Both happen in one transaction, so a failure leaves the game to be archived again.
 * The game's closed threads are copied with it; their proof files stay on disk (spec 07).
 * Spec: 18-game-archive.md - Archiving a Game
 * @param game The ended game
 * @returns False if the game still has open threads and must wait
 */
export async function archiveGame(game: Game): Promise<boolean> {
  if (await hasOpenThreads(game.id)) return false;

  // Safe outside the transaction: nothing can change a game once it has ended
  const players = await buildPlayerSnapshots(game);
  const archivedCellKeys = new Set(
    players.flatMap((player) => player.cells.map((cell) => cellKey(player.userId, cell.position)))
  );
  const threads = await buildThreadSnapshots(game.id, archivedCellKeys);

  await withTransaction(async (connection) => {
    await execute(
      `INSERT INTO archived_games (id, name, team_name, started_at, ended_at, grid_size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [game.id, game.name, game.teamName, game.startedAt, game.endedAt ?? game.updatedAt, game.gridSize],
      connection
    );

    for (const player of players) {
      await execute(
        `INSERT INTO archived_game_players
           (archived_game_id, user_id, player_name, is_leader, leaderboard_rank, completed_tasks, first_bingo_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [game.id, player.userId, player.playerName, player.isLeader, player.leaderboardRank, player.completedTasks, player.firstBingoAt],
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
            toStoredSourceText(cell.sourceLabel),
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

    await saveThreadSnapshots(game.id, threads, connection);
    await saveProgressSnapshot(game.id, connection);
    await saveReactionSnapshot(game.id, connection);

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
 * @param gridSize The side length of the game's cards, which places the Joker
 * @returns One card per player, with the implicit Joker added
 */
async function getArchivedCards(
  id: string,
  players: ArchivedPlayerRow[],
  gridSize: number
): Promise<ArchivedCard[]> {
  const cellRows = await query<ArchivedCellRow[]>(
    `SELECT * FROM archived_cells WHERE archived_game_id = ? ORDER BY position ASC`,
    [id]
  );
  const subtaskRows = await query<ArchivedSubtaskRow[]>(
    `SELECT * FROM archived_cell_subtasks WHERE archived_game_id = ? ORDER BY subtask_index ASC`,
    [id]
  );
  const reactionRows = await getArchivedReactions(id);

  const reactionsByCell = new Map<string, CellReactionMark[]>();
  for (const row of reactionRows) {
    const key = cellKey(row.user_id, row.position);
    reactionsByCell.set(key, [
      ...(reactionsByCell.get(key) ?? []),
      { reaction: row.reaction, x: row.pos_x, y: row.pos_y },
    ]);
  }

  const subtasksByCell = new Map<string, CellSubtask[]>();
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
        sourceLabel: fromStoredSourceText(row.source_type, row.source_label),
        subtasks: subtasksByCell.get(cellKey(row.user_id, row.position)) ?? null,
        numberOfRepetition: row.number_of_repetition,
        completedTimes: row.completed_times,
        reactions: reactionsByCell.get(cellKey(row.user_id, row.position)) ?? [],
      }));

    cells.push({
      position: getJokerPosition(gridSize),
      isJoker: true,
      isEmpty: false,
      resolutionTitle: 'Joker',
      resolutionText: 'Joker',
      resolutionType: ResolutionType.BASE,
      state: CellState.PENDING,
      sourceType: CellSourceType.TEAM,
      sourceUserId: null,
      sourceLabel: { kind: 'team' },
      subtasks: null,
      numberOfRepetition: null,
      completedTimes: null,
      reactions: [],
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
  const gameRows = await query<ArchivedGameRow[]>(`SELECT * FROM archived_games WHERE id = ?`, [id]);
  if (gameRows.length === 0) return null;
  const gridSize = gameRows[0].grid_size;

  const players = await query<ArchivedPlayerRow[]>(
    `SELECT * FROM archived_game_players
     WHERE archived_game_id = ?
     ORDER BY leaderboard_rank IS NULL, leaderboard_rank ASC, player_name ASC`,
    [id]
  );

  return {
    ...rowToSummary(gameRows[0]),
    gridSize,
    startedAt: gameRows[0].started_at ? gameRows[0].started_at.toISOString() : null,
    leaderboard: players
      .filter((player) => player.leaderboard_rank !== null)
      .map((player) => ({
        userId: player.user_id,
        username: player.player_name,
        displayName: null,
        firstBingoAt: player.first_bingo_at ? player.first_bingo_at.toISOString() : null,
        completedTasks: player.completed_tasks,
      })),
    cards: await getArchivedCards(id, players, gridSize),
    threads: await getArchivedThreads(id),
    progress: await getArchivedProgress(id),
  };
}

/**
 * Delete an archived game. Its players, cells, subtasks and threads cascade with it, then the
 * threads' files are removed from disk unless another thread shares them.
 * Spec: 18-game-archive.md - Deleting an Archived Game
 * @param id The archived game
 */
export async function deleteArchivedGame(id: string): Promise<void> {
  // Collected first: the cascade below removes the rows that name these files
  const threadFiles = await getArchivedGameThreadFiles(id);

  await execute(`DELETE FROM archived_games WHERE id = ?`, [id]);

  await removeOrphanedFiles(threadFiles);
}
