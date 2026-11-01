/**
 * Bingo Cell API
 * Spec Reference: 06-bingo-gameplay.md - Card State
 */
import { NextRequest, NextResponse } from 'next/server';
import { announceCellChanges } from '@/lib/notifications';
import { notifyCell } from '@/lib/team-signals';
import { updateCellState } from '@/lib/db';
import type { CellState } from '@/lib/db/types';
import { errorResponse, withAuth, AuthContext } from '../../utils';

/**
 * PUT /api/cells/[cellId] - Update cell state
 * Spec: 06-bingo-gameplay.md - Toggle between pending and completed, or mark as failed
 */
export const PUT = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;
  const body = await request.json();
  const { state } = body;

  // Validate state - only pending, completed and failed are allowed for direct updates
  const validStates = ['pending', 'completed', 'failed'];
  if (!state || !validStates.includes(state)) {
    return errorResponse('Invalid state. Must be "pending", "completed" or "failed"', 400);
  }

  // Update cell state
  // Spec: 06-bingo-gameplay.md - Only the card owner can change their card's cell states
  const result = await updateCellState(cellId, currentUser.id, state as CellState);

  if (!result.success) {
    const message = typeof result.error === 'string' && result.error.trim().length > 0
      ? result.error
      : 'Failed to update cell state';
    return errorResponse(message, 400);
  }

  await notifyCell(cellId);
  if (result.cell) await announceCellChanges([result.cell], currentUser.id);

  return NextResponse.json({ cell: result.cell });
});
