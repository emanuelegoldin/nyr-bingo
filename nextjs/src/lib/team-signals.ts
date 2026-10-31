/**
 * Work out which rooms a change affects, and signal them (spec 11).
 * Signals are hints to refetch, so none of these functions ever throw: a failed lookup
 * must not turn a committed mutation into an error response.
 */

import { query } from './db/connection';
import { notifyRooms, type RoomNotification } from './ws-notify';

/**
 * Build the notifications, send them, and log any failure.
 *
 * @param build - Resolves the rooms to signal.
 */
async function sendSignals(build: () => Promise<RoomNotification[]>): Promise<void> {
  try {
    await notifyRooms(await build());
  } catch (error) {
    console.error('[team-signals] failed:', error);
  }
}

const teamRooms = (teamIds: string[]): RoomNotification[] =>
  teamIds.map((id) => ({ type: 'card', id }));

/**
 * List the teams showing a resolution, through linked cells or as its own team.
 * Call this before deleting the resolution, because the delete clears the cell links.
 *
 * @param resolutionId - The resolution.
 * @returns The team ids, or an empty list if the lookup fails.
 */
export async function getResolutionTeamIds(resolutionId: string): Promise<string[]> {
  try {
    const rows = await query<Array<{ team_id: string }>>(
      `SELECT bc.team_id FROM bingo_cells c
       JOIN bingo_cards bc ON c.card_id = bc.id
       WHERE c.resolution_id = ?
       UNION
       SELECT team_id FROM resolutions WHERE id = ? AND team_id IS NOT NULL`,
      [resolutionId, resolutionId]
    );
    return rows.map((row) => row.team_id);
  } catch (error) {
    console.error('[team-signals] failed:', error);
    return [];
  }
}

/**
 * Signal that teams changed.
 *
 * @param teamIds - The teams.
 */
export async function notifyTeams(teamIds: string[]): Promise<void> {
  await sendSignals(async () => teamRooms(teamIds));
}

/**
 * Signal that a cell changed: its team, and any review thread on it.
 *
 * @param cellId - The cell.
 */
export async function notifyCell(cellId: string): Promise<void> {
  await sendSignals(async () => {
    const teams = await query<Array<{ team_id: string }>>(
      `SELECT bc.team_id FROM bingo_cells c JOIN bingo_cards bc ON c.card_id = bc.id WHERE c.id = ?`,
      [cellId]
    );
    const threads = await query<Array<{ id: string }>>(
      `SELECT id FROM review_threads WHERE cell_id = ?`,
      [cellId]
    );
    return [
      ...teamRooms(teams.map((row) => row.team_id)),
      ...threads.map(({ id }): RoomNotification => ({ type: 'thread', id })),
    ];
  });
}

/**
 * Signal that a thread changed, without touching its cell (messages, files, open votes).
 *
 * @param threadId - The thread.
 */
export async function notifyThread(threadId: string): Promise<void> {
  await notifyRooms([{ type: 'thread', id: threadId }]);
}

/**
 * Signal that a closing thread changed its cell.
 *
 * @param threadId - The thread.
 */
export async function notifyThreadClosed(threadId: string): Promise<void> {
  await sendSignals(async () => {
    const teams = await query<Array<{ team_id: string }>>(
      `SELECT bc.team_id FROM review_threads rt
       JOIN bingo_cells c ON rt.cell_id = c.id
       JOIN bingo_cards bc ON c.card_id = bc.id
       WHERE rt.id = ?`,
      [threadId]
    );
    return [{ type: 'thread', id: threadId }, ...teamRooms(teams.map((row) => row.team_id))];
  });
}

/**
 * Signal that a resolution changed: its open dialogs, and every team showing it.
 *
 * @param resolutionId - The resolution.
 */
export async function notifyResolution(resolutionId: string): Promise<void> {
  await sendSignals(async () => [
    { type: 'resolution', id: resolutionId },
    ...teamRooms(await getResolutionTeamIds(resolutionId)),
  ]);
}

/**
 * Signal the teams of a user whose profile changed.
 *
 * @param userId - The user.
 */
export async function notifyUserTeams(userId: string): Promise<void> {
  await sendSignals(async () => {
    const rows = await query<Array<{ team_id: string }>>(
      `SELECT team_id FROM team_memberships WHERE user_id = ?`,
      [userId]
    );
    return teamRooms(rows.map((row) => row.team_id));
  });
}
