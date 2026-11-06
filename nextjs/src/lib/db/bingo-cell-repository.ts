/**
 * Bingo Cell Repository - State and content changes on bingo cells
 * Spec Reference: 06-bingo-gameplay.md, 09-bingo-card-editing.md
 */

import { CellSourceType, CellState, GameStatus, ResolutionType } from '../shared/types';
import { getResolvedCellRowById, rowToCell } from './bingo-card-rows';
import { EMPTY_SNAPSHOT, replaceCellSnapshot, snapshotOf } from './cell-snapshot';
import { execute, query, withTransaction } from './connection';
import { refreshLeaderboardEntry } from './leaderboard-repository';
import { getResolutionById } from './resolution-repository';
import { BingoCell, Resolution } from './types';

interface CardCellRow {
  card_id: string;
  is_empty: boolean | number;
  resolution_type: ResolutionType;
  source_type: CellSourceType;
  state: CellState;
  card_user_id: string;
  game_id: string;
  game_status: GameStatus;
}

/**
 * Source states each direct update accepts. The WHERE guard built from these prevents
 * races with concurrent proof requests.
 *   pending or failed -> completed (user marks as done)
 *   completed -> pending (user undoes)
 *   pending -> failed (user marks as failed)
 * pending_review and accomplished are never set directly: they come from requesting
 * proof and from closing the review thread.
 */
const VALID_FROM_STATES: Record<CellState.PENDING | CellState.COMPLETED | CellState.FAILED, CellState[]> = {
  [CellState.COMPLETED]: [CellState.PENDING, CellState.FAILED],
  [CellState.PENDING]: [CellState.COMPLETED],
  [CellState.FAILED]: [CellState.PENDING],
};

/**
 * Check that a user may place a resolution on a cell of a game's card.
 * Spec: 09-bingo-card-editing.md - Backend Rules
 * @param resolution The replacement resolution
 * @param sourceType The source the client selected
 * @param userId The card owner
 * @param gameId The game of the card
 * @returns True for the owner's personal resolutions and for resolutions proposed to them in this game
 */
function canPlaceResolution(
  resolution: Resolution,
  sourceType: CellSourceType,
  userId: string,
  gameId: string
): boolean {
  if (sourceType === CellSourceType.PERSONAL) {
    return resolution.scope === 'personal' && resolution.ownerUserId === userId;
  }
  return resolution.scope === 'member_provided'
    && resolution.toUserId === userId
    && resolution.gameId === gameId;
}

/**
 * Find the owner of the card a cell is on.
 * Spec: 21-authorization.md - Resource Rules (Ownership)
 * @param cellId The cell
 * @returns The card owner's id, or null when the cell does not exist
 */
export async function getCellCardOwnerId(cellId: string): Promise<string | null> {
  const rows = await query<Array<{ user_id: string }>>(
    `SELECT bc.user_id FROM bingo_cells c JOIN bingo_cards bc ON c.card_id = bc.id WHERE c.id = ?`,
    [cellId]
  );
  return rows.length > 0 ? rows[0].user_id : null;
}

/**
 * Load a cell for a change by its card owner. The route checks ownership.
 * @param cellId The cell to load
 * @returns The cell, or the error explaining why it cannot be changed
 */
async function loadCardCell(cellId: string): Promise<{ cell: CardCellRow } | { error: string }> {
  const rows = await query<CardCellRow[]>(
    `SELECT c.card_id, c.is_empty, c.resolution_type, c.source_type, c.state, bc.user_id as card_user_id, bc.game_id, g.status as game_status
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     JOIN games g ON bc.game_id = g.id
     WHERE c.id = ?`,
    [cellId]
  );

  if (rows.length === 0) {
    return { error: 'Cell not found' };
  }

  // Spec: 16-games.md - Ending a Game
  if (rows[0].game_status === GameStatus.ENDED) {
    return { error: 'This game has ended' };
  }

  return { cell: rows[0] };
}

/**
 * Update a cell's state on behalf of its card owner (the route checks ownership).
 * Spec: 06-bingo-gameplay.md - Card State
 * @param cellId The cell
 * @param newState pending, completed or failed
 * @returns The updated cell, or the error
 */
export async function updateCellState(
  cellId: string,
  newState: CellState
): Promise<{ success: boolean; error?: string; cell?: BingoCell }> {
  // Spec: 05-bingo-card-generation.md, 06-bingo-gameplay.md - Joker is implicit and not modifiable.
  if (cellId.startsWith('joker:')) {
    return { success: false, error: 'Joker cell cannot be modified' };
  }

  const owned = await loadCardCell(cellId);
  if ('error' in owned) {
    return { success: false, error: owned.error };
  }

  const { cell } = owned;

  // Spec: 06-bingo-gameplay.md - "empty" filler cells cannot be marked completed
  if (cell.is_empty && newState === CellState.COMPLETED) {
    return { success: false, error: 'Empty cells cannot be marked as completed' };
  }

  // Spec: 06-bingo-gameplay.md - Only cells with a resolution can be failed
  if (cell.is_empty && newState === CellState.FAILED) {
    return { success: false, error: 'Empty cells cannot be marked as failed' };
  }

  if (newState !== CellState.PENDING && newState !== CellState.COMPLETED && newState !== CellState.FAILED) {
    return { success: false, error: 'Only pending, completed and failed can be set directly' };
  }

  // Spec: 06-bingo-gameplay.md - compound and iterative cells follow their progress, but any type can be failed
  if (cell.resolution_type !== ResolutionType.BASE && newState !== CellState.FAILED) {
    return { success: false, error: 'Compound and iterative cells complete automatically' };
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
  await refreshLeaderboardEntry(cell.game_id, cell.card_user_id);

  const updatedRow = await getResolvedCellRowById(cellId);
  if (!updatedRow) {
    return { success: false, error: 'Cell not found' };
  }

  return { success: true, cell: rowToCell(updatedRow) };
}

/**
 * Replace a cell's content on behalf of its card owner (the route checks ownership).
 * Spec: 09-bingo-card-editing.md - Persisting a Cell Edit
 * @param cellId The cell
 * @param update The new source and resolution
 * @returns The updated cell, or the error
 */
export async function updateCellContent(
  cellId: string,
  update: {
    resolutionId: string | null;
    sourceType: Exclude<CellSourceType, CellSourceType.TEAM | CellSourceType.PREPARED>;
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

  const owned = await loadCardCell(cellId);
  if ('error' in owned) {
    return { success: false, error: owned.error };
  }

  // Team resolution cells are immutable (same as Joker for edit-card flow)
  if (owned.cell.source_type === 'team') {
    return { success: false, error: 'Team resolution cell cannot be modified' };
  }

  // Spec: 09-bingo-card-editing.md - A review stays about the content it was opened on
  if (owned.cell.state === CellState.PENDING_REVIEW) {
    return { success: false, error: 'A cell under review cannot be edited' };
  }

  // Prevent storing ids for types that shouldn't have them
  if (update.sourceType === 'empty' && update.resolutionId) {
    return { success: false, error: 'Empty cells cannot reference a resolution id' };
  }

  // The snapshot and source user come from the resolution, never from the client.
  let resolutionId: string | null = null;
  let snapshot = EMPTY_SNAPSHOT;
  let sourceUserId: string | null = null;

  if (referencesResolution) {
    const resolution = await getResolutionById(update.resolutionId as string);
    if (!resolution || !canPlaceResolution(resolution, update.sourceType, owned.cell.card_user_id, owned.cell.game_id)) {
      return { success: false, error: 'This resolution cannot be placed on this card' };
    }

    // Spec: 05-bingo-card-generation.md - No duplicates in a card
    const duplicates = await query<Array<{ id: string }>>(
      `SELECT id FROM bingo_cells WHERE card_id = ? AND resolution_id = ? AND id <> ? LIMIT 1`,
      [owned.cell.card_id, resolution.id, cellId]
    );
    if (duplicates.length > 0) {
      return { success: false, error: 'This resolution is already on this card' };
    }

    resolutionId = resolution.id;
    snapshot = snapshotOf(resolution);
    sourceUserId = resolution.ownerUserId;
  }

  // Spec: 09-bingo-card-editing.md - a fresh copy of the resolution, with progress reset
  const updated = await withTransaction(async (connection) => {
    const updateResult = await execute(
      `UPDATE bingo_cells
       SET resolution_id = ?,
           source_type = ?,
           source_user_id = ?,
           state = 'pending'
       WHERE id = ? AND state <> 'pending_review'`,
      [resolutionId, update.sourceType, sourceUserId, cellId],
      connection
    );
    if (updateResult.affectedRows === 0) return false;

    await replaceCellSnapshot(connection, cellId, snapshot);
    return true;
  }, (didUpdate) => didUpdate);

  if (!updated) {
    return { success: false, error: 'Cell state has changed — please refresh and try again' };
  }

  // The edit resets the state to pending, which can undo a completion or a bingo
  await refreshLeaderboardEntry(owned.cell.game_id, owned.cell.card_user_id);

  const updatedRow = await getResolvedCellRowById(cellId);
  if (!updatedRow) {
    return { success: false, error: 'Cell not found' };
  }

  return { success: true, cell: rowToCell(updatedRow) };
}

/**
 * Undo completion or failure - revert cell to pending and close any open thread.
 * The route checks that the caller owns the card.
 * Spec: Resolution Review & Proof Workflow - Undo Completion
 * @param cellId The cell
 * @returns The updated cell, or the error
 */
export async function undoCompletion(
  cellId: string
): Promise<{ success: boolean; error?: string; cell?: BingoCell }> {
  const owned = await loadCardCell(cellId);
  if ('error' in owned) {
    return { success: false, error: owned.error };
  }

  const { cell } = owned;

  // Must be in completed, pending_review, accomplished or failed state
  if (!['completed', 'pending_review', 'accomplished', 'failed'].includes(cell.state)) {
    return { success: false, error: 'Cell is not completed' };
  }

  const reverted = await withTransaction(async (connection) => {
    // Close any open review thread. It keeps its messages and files as an archived thread
    // (spec 07 - Thread Closure).
    await connection.execute(
      `UPDATE review_threads SET status = 'closed', closed_at = NOW(), outcome = 'pending'
       WHERE cell_id = ? AND status = 'open'`,
      [cellId]
    );

    // Optimistic lock: only transition if cell is still in a valid
    // "completable" state.  Owner actions prevail over concurrent
    // proof-request operations — if a team member moved the cell to
    // pending_review in the meantime, we still honour the owner's undo
    // because the thread closure above already handled that thread.
    const undoResult = await execute(
      `UPDATE bingo_cells SET state = 'pending' WHERE id = ? AND state IN ('completed', 'pending_review', 'accomplished', 'failed')`,
      [cellId],
      connection
    );
    return undoResult.affectedRows > 0;
  }, (didRevert) => didRevert);

  if (!reverted) {
    return { success: false, error: 'Cell is not in a completable state' };
  }

  // Refresh persisted leaderboard data after undo
  await refreshLeaderboardEntry(cell.game_id, cell.card_user_id);

  const updatedRow = await getResolvedCellRowById(cellId);
  if (!updatedRow) {
    return { success: false, error: 'Cell not found' };
  }

  return { success: true, cell: rowToCell(updatedRow) };
}

/**
 * Move a compound or iterative cell to the state its own progress calls for. Only this cell
 * changes, even if other cells were copied from the same resolution.
 * Spec: 06-bingo-gameplay.md - Automatic Completion
 *   complete: pending or failed -> completed
 *   incomplete: completed -> pending
 * Cells in pending_review or accomplished, and cells of an ended game, are left unchanged.
 * @param cellId The cell whose progress changed
 * @param isComplete Whether its progress is now complete
 * @returns The cell after the change, or an empty list if its state did not change
 */
export async function autoTransitionCellState(
  cellId: string,
  isComplete: boolean
): Promise<BingoCell[]> {
  const [fromStates, newState] = isComplete
    ? [[CellState.PENDING, CellState.FAILED], CellState.COMPLETED]
    : [[CellState.COMPLETED], CellState.PENDING];

  const owners = await query<Array<{ game_id: string; user_id: string }>>(
    `SELECT bc.game_id, bc.user_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     JOIN games g ON bc.game_id = g.id
     WHERE c.id = ? AND g.status <> 'ended'`,
    [cellId]
  );
  if (owners.length === 0) {
    return [];
  }

  const result = await execute(
    `UPDATE bingo_cells SET state = ?
     WHERE id = ? AND state IN (${fromStates.map(() => '?').join(', ')})`,
    [newState, cellId, ...fromStates]
  );
  if (result.affectedRows === 0) {
    return [];
  }

  await refreshLeaderboardEntry(owners[0].game_id, owners[0].user_id);

  const updatedRow = await getResolvedCellRowById(cellId);
  return updatedRow ? [rowToCell(updatedRow)] : [];
}
