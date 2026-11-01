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
 */

import { BINGO_LINES } from '../shared/bingo-lines';
import { CellState, JOKER_POSITION } from '../shared/types';
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
 * Returns null if no bingo has been achieved yet.
 */
function computeFirstBingoAt(cells: Array<CellForBingo & { updated_at: Date | null }>): Date | null {
  const byPosition = new Map<number, typeof cells[0]>();
  for (const cell of cells) {
    byPosition.set(cell.position, cell);
  }

  let earliest: Date | null = null;

  for (const line of BINGO_LINES) {
    let lineComplete = true;
    let latestUpdate: Date | null = null;

    for (const pos of line) {
      // The joker is implicit: always done, not stored, and adds no timestamp.
      if (pos === JOKER_POSITION) continue;

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

/** Leaderboard entry enriched with user profile info (for the API). */
export interface LeaderboardEntryWithUser {
  userId: string;
  username: string;
  displayName: string | null;
  firstBingoAt: string | null;
  completedTasks: number;
}

/**
 * Get the full leaderboard of a game, sorted by first-bingo-at.
 * Uses a JOIN on users for username retrieval. Private display names are omitted.
 */
export async function getGameLeaderboard(gameId: string): Promise<LeaderboardEntryWithUser[]> {
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
 * Recalculate and upsert the leaderboard entry for a specific user in a game.
 * Call this after any cell state change.
 *
 * `completed_tasks` counts cells with state 'completed' or 'accomplished' only.
 * `first_bingo_at` is computed from bingo line detection on the card.
 */
export async function refreshLeaderboardEntry(
  gameId: string,
  userId: string
): Promise<void> {
  // Get the user's card cells for this game
  const cells = await query<Array<CellForBingo & { updated_at: Date | null }>>(
    `SELECT c.position, c.state, c.is_empty, c.updated_at
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
  const firstBingoAt = computeFirstBingoAt(cells);

  await query(
    `INSERT INTO team_leaderboard (user_id, team_id, game_id, first_bingo_at, completed_tasks)
     SELECT ?, team_id, id, ?, ? FROM games WHERE id = ?
     ON DUPLICATE KEY UPDATE
       first_bingo_at = VALUES(first_bingo_at),
       completed_tasks = VALUES(completed_tasks)`,
    [userId, firstBingoAt, completedTasks, gameId]
  );
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
}
