/**
 * Bingo Cell Repository - State and content changes on bingo cells
 * Spec Reference: 06-bingo-gameplay.md, 09-bingo-card-editing.md
 */

import { CellSourceType, CellState, ResolutionType } from '../shared/types';
import { getResolvedCellRowById, rowToCell } from './bingo-card-rows';
import { execute, query, withTransaction } from './connection';
import { refreshLeaderboardEntry } from './leaderboard-repository';
import { BingoCell } from './types';

interface OwnedCellRow {
  is_empty: boolean | number;
  source_type: CellSourceType;
  state: CellState;
  card_user_id: string;
  team_id: string;
}

/**
 * Source states each direct update accepts. The WHERE guard built from these prevents
 * races with concurrent proof requests.
 *   pending -> completed (user marks as done)
 *   completed -> pending (user undoes)
 * pending_review and accomplished are never set directly: they come from requesting
 * proof and from closing the review thread.
 */
const VALID_FROM_STATES: Record<CellState.PENDING | CellState.COMPLETED, CellState[]> = {
  [CellState.COMPLETED]: [CellState.PENDING],
  [CellState.PENDING]: [CellState.COMPLETED],
};

/**
 * Load a cell for a change only its card owner may make.
 * @param cellId The cell to load
 * @param userId The user making the change
 * @param notOwnerError The error to report when the user does not own the card
 * @returns The cell, or the error explaining why it cannot be changed
 */
async function loadOwnedCell(
  cellId: string,
  userId: string,
  notOwnerError: string
): Promise<{ cell: OwnedCellRow } | { error: string }> {
  const rows = await query<OwnedCellRow[]>(
    `SELECT c.is_empty, c.source_type, c.state, bc.user_id as card_user_id, bc.team_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.id = ?`,
    [cellId]
  );

  if (rows.length === 0) {
    return { error: 'Cell not found' };
  }

  if (rows[0].card_user_id !== userId) {
    return { error: notOwnerError };
  }

  return { cell: rows[0] };
}

/**
 * Update cell state
 * Spec: 06-bingo-gameplay.md - Card State
 */
export async function updateCellState(
  cellId: string,
  userId: string,
  newState: CellState
): Promise<{ success: boolean; error?: string; cell?: BingoCell }> {
  // Spec: 05-bingo-card-generation.md, 06-bingo-gameplay.md - Joker is implicit and not modifiable.
  if (cellId.startsWith('joker:')) {
    return { success: false, error: 'Joker cell cannot be modified' };
  }

  // Spec: 06-bingo-gameplay.md - Only the card owner can change their card's cell states
  const owned = await loadOwnedCell(cellId, userId, 'Only the card owner can update cell state');
  if ('error' in owned) {
    return { success: false, error: owned.error };
  }

  const { cell } = owned;

  // Spec: 06-bingo-gameplay.md - "empty" filler cells cannot be marked completed
  if (cell.is_empty && newState === CellState.COMPLETED) {
    return { success: false, error: 'Empty cells cannot be marked as completed' };
  }

  if (newState !== CellState.PENDING && newState !== CellState.COMPLETED) {
    return { success: false, error: 'Only pending and completed can be set directly' };
  }

  const validFromStates = VALID_FROM_STATES[newState];
  const placeholders = validFromStates.map(() => '?').join(', ');
  const updateResult = await execute(
    `UPDATE bingo_cells SET state = ? WHERE id = ? AND state IN (${placeholders})`,
    [newState, cellId, ...validFromStates]
  );

  if (updateResult.affectedRows === 0) {
    return { success: false, error: 'Cell state has changed — please refresh and try again' };
  }

  // Refresh persisted leaderboard data after state change
  await refreshLeaderboardEntry(cell.team_id, userId);

  const updatedRow = await getResolvedCellRowById(cellId);
  if (!updatedRow) {
    return { success: false, error: 'Cell not found' };
  }

  return { success: true, cell: rowToCell(updatedRow) };
}

export async function updateCellContent(
  cellId: string,
  userId: string,
  update: {
    resolutionId: string | null;
    resolutionType?: ResolutionType;
    sourceType: CellSourceType;
    sourceUserId: string | null;
  }
): Promise<{ success: boolean; error?: string; cell?: BingoCell }> {

  // Spec: 05-bingo-card-generation.md, 09-bingo-card-editing.md - Joker is implicit and immutable.
  if (cellId.startsWith('joker:')) {
    return { success: false, error: 'Joker cell cannot be modified' };
  }

  const referencesResolution = update.sourceType === 'personal' || update.sourceType === 'member_provided';

  if (referencesResolution && !update.resolutionId) {
    return { success: false, error: 'resolutionId is required for personal/member_provided cells' };
  }

  // Get the cell (and card owner) for authorization and joker protection
  const owned = await loadOwnedCell(cellId, userId, 'Only the card owner can edit cell content');
  if ('error' in owned) {
    return { success: false, error: owned.error };
  }

  // Team resolution cells are immutable (same as Joker for edit-card flow)
  if (owned.cell.source_type === 'team') {
    return { success: false, error: 'Team resolution cell cannot be modified' };
  }

  // Prevent storing ids for types that shouldn't have them
  if (update.sourceType === 'team' || update.sourceType === 'empty') {
    if (update.resolutionId) {
      return { success: false, error: 'Team/empty cells cannot reference a resolution id' };
    }
  }

  const sourceUserId = update.sourceUserId || null;
  const resolutionId = referencesResolution ? update.resolutionId : null;

  // Determine the resolution type for the cell.
  const resolutionType = update.sourceType === 'empty'
    ? ResolutionType.BASE
    : update.resolutionType || ResolutionType.BASE;

  await query(
    `UPDATE bingo_cells
     SET resolution_id = ?,
         resolution_type = ?,
         source_type = ?,
         source_user_id = ?,
         state = 'pending'
     WHERE id = ?`,
    [resolutionId, resolutionType, update.sourceType, sourceUserId, cellId]
  );

  const updatedRow = await getResolvedCellRowById(cellId);
  if (!updatedRow) {
    return { success: false, error: 'Cell not found' };
  }

  return { success: true, cell: rowToCell(updatedRow) };
}

/**
 * Undo completion - revert cell to pending and close any open thread
 * Spec: Resolution Review & Proof Workflow - Undo Completion
 */
export async function undoCompletion(
  cellId: string,
  userId: string
): Promise<{ success: boolean; error?: string; cell?: BingoCell }> {
  // Only the card owner can undo completion
  const owned = await loadOwnedCell(cellId, userId, 'Only the card owner can undo completion');
  if ('error' in owned) {
    return { success: false, error: owned.error };
  }

  const { cell } = owned;

  // Must be in completed, pending_review, or accomplished state
  if (!['completed', 'pending_review', 'accomplished'].includes(cell.state)) {
    return { success: false, error: 'Cell is not completed' };
  }

  const reverted = await withTransaction(async (connection) => {
    // Check for open review thread
    const threadRows = await query<Array<{ id: string; status: string }>>(
      `SELECT id, status FROM review_threads WHERE cell_id = ? AND status = 'open'`,
      [cellId],
      connection
    );

    if (threadRows.length > 0) {
      const threadId = threadRows[0].id;

      // Delete messages and files
      await connection.execute(
        `DELETE FROM review_messages WHERE thread_id = ?`,
        [threadId]
      );

      await connection.execute(
        `DELETE FROM review_files WHERE thread_id = ?`,
        [threadId]
      );

      // Close the thread
      await connection.execute(
        `UPDATE review_threads SET status = 'closed', closed_at = NOW() WHERE id = ?`,
        [threadId]
      );
    }

    // Optimistic lock: only transition if cell is still in a valid
    // "completable" state.  Owner actions prevail over concurrent
    // proof-request operations — if a team member moved the cell to
    // pending_review in the meantime, we still honour the owner's undo
    // because the thread closure above already handled that thread.
    const undoResult = await execute(
      `UPDATE bingo_cells SET state = 'pending' WHERE id = ? AND state IN ('completed', 'pending_review', 'accomplished')`,
      [cellId],
      connection
    );
    return undoResult.affectedRows > 0;
  }, (didRevert) => didRevert);

  if (!reverted) {
    return { success: false, error: 'Cell is not in a completable state' };
  }

  // Refresh persisted leaderboard data after undo
  await refreshLeaderboardEntry(cell.team_id, userId);

  const updatedRow = await getResolvedCellRowById(cellId);
  if (!updatedRow) {
    return { success: false, error: 'Cell not found' };
  }

  return { success: true, cell: rowToCell(updatedRow) };
}

/**
 * Auto-transition bingo cell state for compound/iterative resolutions.
 * When the resolution is fully completed (all subtasks done or counter reached),
 * the cell transitions from pending → completed.
 * When the resolution becomes incomplete again, the cell transitions from completed → pending.
 *
 * This skips cells in pending_review or accomplished states (controlled by voting system).
 *
 * @param resolutionId - The compound or iterative resolution ID
 * @param resolutionType - 'compound' or 'iterative'
 * @param isComplete - Whether the resolution is now fully completed
 * @returns Array of updated cells, or empty if no transitions occurred
 */
export async function autoTransitionCellState(
  resolutionId: string,
  resolutionType: ResolutionType,
  isComplete: boolean
): Promise<BingoCell[]> {
  // Find all bingo cells linked to this resolution
  const cellRows = await query<Array<{ id: string; state: CellState; team_id: string; user_id: string }>>(
    `SELECT c.id, c.state, bc.team_id, bc.user_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.resolution_id = ? AND c.resolution_type = ?`,
    [resolutionId, resolutionType]
  );

  if (cellRows.length === 0) {
    return [];
  }

  const updatedCells: BingoCell[] = [];

  for (const cellRow of cellRows) {
    let newState: CellState | null = null;

    if (isComplete && cellRow.state === CellState.PENDING) {
      // Auto-complete: pending → completed
      newState = CellState.COMPLETED;
    } else if (!isComplete && cellRow.state === CellState.COMPLETED) {
      // Auto-revert: completed → pending
      newState = CellState.PENDING;
    }

    if (newState) {
      await query(
        `UPDATE bingo_cells SET state = ? WHERE id = ? AND state = ?`,
        [newState, cellRow.id, cellRow.state]
      );

      // Refresh leaderboard for this user/team
      await refreshLeaderboardEntry(cellRow.team_id, cellRow.user_id);

      const updatedRow = await getResolvedCellRowById(cellRow.id);
      if (updatedRow) {
        updatedCells.push(rowToCell(updatedRow));
      }
    }
  }

  return updatedCells;
}
