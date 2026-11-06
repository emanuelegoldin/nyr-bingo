/**
 * Leaderboard Repository – persisted game leaderboard data
 * Spec Reference: 12-team-tabs.md
 *
 * The `team_leaderboard` table stores per-user-per-game stats:
 *   - `completed_tasks`: count of cells with state "completed" or "accomplished"
 *   - `first_bingo_at`: earliest datetime a complete bingo line was achieved
 *
 * Rows are upserted whenever a cell state changes (updateCellState,
 * undoCompletion, vote resolution) and bulk-initialized when a game starts.
 *
 * Each change of `completed_tasks` is also logged in `leaderboard_progress`
 * (spec 23-progress-chart.md - Recording Progress).
 */

import { notifications } from '../notifications';
import { getBingoLines } from '../shared/bingo-lines';
import { CellState, getJokerPosition, type LeaderboardEntry, type ProgressPoint } from '../shared/types';
import { query } from './connection';
import type { Game } from './types';

// ── Row types ────────────────────────────────────────────────────

interface LeaderboardRow {
  user_id: string;
  game_id: string;
  first_bingo_at: Date | null;
  completed_tasks: number;
  updated_at: Date;
}

interface LeaderboardRowWithUser extends LeaderboardRow {
  username: string;
  display_name: string | null;
}

// ── Bingo detection (server-side, from raw DB rows) ─────────────

/** States that count as "done" for bingo-line purposes. */
const DONE_STATES: ReadonlySet<string> = new Set([
  CellState.COMPLETED,
  CellState.ACCOMPLISHED,
]);

interface CellForBingo {
  position: number;
  state: string;
  is_empty: number | boolean;
}

function isCellDone(cell: CellForBingo): boolean {
  if (cell.is_empty) return false;
  return DONE_STATES.has(cell.state);
}

/**
 * Given a user's cells, compute the datetime of their first bingo line.
 * @param cells The stored cells of the card
 * @param gridSize The side length of the card
 * @returns The first bingo time, or null if no bingo has been achieved yet
 */
function computeFirstBingoAt(cells: Array<CellForBingo & { updated_at: Date | null }>, gridSize: number): Date | null {
  const byPosition = new Map<number, typeof cells[0]>();
  for (const cell of cells) {
    byPosition.set(cell.position, cell);
  }

  let earliest: Date | null = null;
  const jokerPosition = getJokerPosition(gridSize);

  for (const line of getBingoLines(gridSize)) {
    let lineComplete = true;
    let latestUpdate: Date | null = null;

    for (const pos of line) {
      // The joker is implicit: always done, not stored, and adds no timestamp.
      if (pos === jokerPosition) continue;

      const cell = byPosition.get(pos);
      if (!cell || !isCellDone(cell)) {
        lineComplete = false;
        break;
      }
      if (cell.updated_at) {
        if (!latestUpdate || cell.updated_at > latestUpdate) {
          latestUpdate = cell.updated_at;
        }
      }
    }

    if (lineComplete && latestUpdate) {
      if (!earliest || latestUpdate < earliest) {
        earliest = latestUpdate;
      }
    }
  }

  return earliest;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Get the full leaderboard of a game, sorted by first-bingo-at.
 * Uses a JOIN on users for username retrieval. Private display names are omitted.
 */
export async function getGameLeaderboard(gameId: string): Promise<LeaderboardEntry[]> {
  const rows = await query<LeaderboardRowWithUser[]>(
    `SELECT tl.user_id, tl.game_id, tl.first_bingo_at, tl.completed_tasks, tl.updated_at,
            u.username,
            CASE WHEN up.display_name_public THEN up.display_name END AS display_name
     FROM team_leaderboard tl
     JOIN users u ON tl.user_id = u.id
     LEFT JOIN user_profiles up ON tl.user_id = up.user_id
     WHERE tl.game_id = ?
     ORDER BY
       CASE WHEN tl.first_bingo_at IS NOT NULL THEN 0 ELSE 1 END,
       tl.first_bingo_at ASC,
       tl.completed_tasks DESC,
       u.username ASC`,
    [gameId]
  );

  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    firstBingoAt: row.first_bingo_at ? row.first_bingo_at.toISOString() : null,
    completedTasks: row.completed_tasks,
  }));
}

/**
 * Log one value of a player's completed count, from now on.
 * Spec: 23-progress-chart.md - Recording Progress
 * @param gameId The game
 * @param userId The player
 * @param completedTasks The player's new completed count
 */
async function recordProgressPoint(
  gameId: string,
  userId: string,
  completedTasks: number
): Promise<void> {
  await query(
    `INSERT INTO leaderboard_progress (game_id, user_id, recorded_at, completed_tasks)
     VALUES (?, ?, NOW(), ?)`,
    [gameId, userId, completedTasks]
  );
}

/**
 * Get the progress points of a game, oldest first.
 * Spec: 23-progress-chart.md - Progress Tab
 * @param gameId The game
 * @returns Every stored value of every player's completed count
 */
export async function getGameProgress(gameId: string): Promise<ProgressPoint[]> {
  const rows = await query<Array<{ user_id: string; recorded_at: Date; completed_tasks: number }>>(
    `SELECT user_id, recorded_at, completed_tasks
     FROM leaderboard_progress
     WHERE game_id = ?
     ORDER BY recorded_at ASC, id ASC`,
    [gameId]
  );

  return rows.map((row) => ({
    userId: row.user_id,
    recordedAt: row.recorded_at.toISOString(),
    completedTasks: row.completed_tasks,
  }));
}

/**
 * Recalculate and upsert the leaderboard entry for a specific user in a game.
 * Call this after any cell state change.
 *
 * `completed_tasks` counts cells with state 'completed' or 'accomplished' only.
 * `first_bingo_at` is computed from bingo line detection on the card.
 * Gaining or losing it is reported to the notification module (spec 19).
 */
export async function refreshLeaderboardEntry(
  gameId: string,
  userId: string
): Promise<void> {
  // Get the user's card cells for this game
  const cells = await query<Array<CellForBingo & { updated_at: Date | null; grid_size: number }>>(
    `SELECT c.position, c.state, c.is_empty, c.updated_at, bc.grid_size
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE bc.game_id = ? AND bc.user_id = ?`,
    [gameId, userId]
  );

  // Count completed_tasks: only 'completed' or 'accomplished'
  const completedTasks = cells.filter(
    (c) => c.state === CellState.COMPLETED || c.state === CellState.ACCOMPLISHED
  ).length;

  // Compute first bingo timestamp
  // Every cell of a card carries the card's size; a user without cells has no bingo either way
  const firstBingoAt = cells.length > 0 ? computeFirstBingoAt(cells, cells[0].grid_size) : null;

  const previous = await query<Array<{ first_bingo_at: Date | null; completed_tasks: number }>>(
    `SELECT first_bingo_at, completed_tasks FROM team_leaderboard WHERE game_id = ? AND user_id = ?`,
    [gameId, userId]
  );
  const hadBingo = Boolean(previous[0]?.first_bingo_at);

  await query(
    `INSERT INTO team_leaderboard (user_id, team_id, game_id, first_bingo_at, completed_tasks)
     SELECT ?, team_id, id, ?, ? FROM games WHERE id = ?
     ON DUPLICATE KEY UPDATE
       first_bingo_at = VALUES(first_bingo_at),
       completed_tasks = VALUES(completed_tasks)`,
    [userId, firstBingoAt, completedTasks, gameId]
  );

  // A point only when the count changed, or for a player's first row (spec 23)
  if (previous.length === 0 || previous[0].completed_tasks !== completedTasks) {
    await recordProgressPoint(gameId, userId, completedTasks);
  }

  if (firstBingoAt && !hadBingo) {
    await notifications.publish({ type: 'bingo_scored', gameId, actorUserId: userId });
  } else if (!firstBingoAt && hadBingo) {
    await notifications.cancelBingo(gameId, userId);
  }
}

/**
 * Initialize leaderboard rows for all members when a game starts.
 * All entries start with completed_tasks = 0 and first_bingo_at = NULL.
 */
export async function initializeGameLeaderboard(
  game: Pick<Game, 'id' | 'teamId'>,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;

  const placeholders = userIds.map(() => '(?, ?, ?, NULL, 0)').join(', ');
  const params = userIds.flatMap((uid) => [uid, game.teamId, game.id]);

  await query(
    `INSERT INTO team_leaderboard (user_id, team_id, game_id, first_bingo_at, completed_tasks)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE completed_tasks = completed_tasks`,
    params
  );

  // Every player's progress starts at 0 when bingo starts (spec 23); a player who already
  // has a point keeps it, so a repeated call adds nothing.
  const playerList = userIds.map(() => 'SELECT ? AS user_id').join(' UNION ALL ');
  await query(
    `INSERT INTO leaderboard_progress (game_id, user_id, recorded_at, completed_tasks)
     SELECT g.id, p.user_id, COALESCE(g.started_at, NOW()), 0
     FROM games g
     JOIN (${playerList}) p
     WHERE g.id = ?
       AND NOT EXISTS (
         SELECT 1 FROM leaderboard_progress lp
         WHERE lp.game_id = g.id AND lp.user_id = p.user_id
       )`,
    [...userIds, game.id]
  );
}
