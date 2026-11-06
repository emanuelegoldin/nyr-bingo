/**
 * Archived Progress Repository - The progress points kept in an archived game
 * Spec Reference: 23-progress-chart.md - Archiving
 */

import type { ProgressPoint } from '../shared/types';
import { execute, query, type Executor } from './connection';

/**
 * Copy an ended game's progress points into its archive, as plain values.
 * Only the archived players' points are copied: the archive's foreign key needs their row.
 * @param gameId The ended game, whose archived players are already written under the same id
 * @param connection The archiving transaction
 */
export async function saveProgressSnapshot(gameId: string, connection: Executor): Promise<void> {
  await execute(
    `INSERT INTO archived_progress (archived_game_id, user_id, recorded_at, completed_tasks)
     SELECT lp.game_id, lp.user_id, lp.recorded_at, lp.completed_tasks
     FROM leaderboard_progress lp
     JOIN archived_game_players p ON p.archived_game_id = lp.game_id AND p.user_id = lp.user_id
     WHERE lp.game_id = ?
     ORDER BY lp.recorded_at ASC, lp.id ASC`,
    [gameId],
    connection
  );
}

/**
 * Get the progress points of an archived game, oldest first.
 * @param archivedGameId The archived game
 * @returns Every stored value of every player's completed count
 */
export async function getArchivedProgress(archivedGameId: string): Promise<ProgressPoint[]> {
  const rows = await query<Array<{ user_id: string; recorded_at: Date; completed_tasks: number }>>(
    `SELECT user_id, recorded_at, completed_tasks
     FROM archived_progress
     WHERE archived_game_id = ?
     ORDER BY recorded_at ASC, id ASC`,
    [archivedGameId]
  );

  return rows.map((row) => ({
    userId: row.user_id,
    recordedAt: row.recorded_at.toISOString(),
    completedTasks: row.completed_tasks,
  }));
}
