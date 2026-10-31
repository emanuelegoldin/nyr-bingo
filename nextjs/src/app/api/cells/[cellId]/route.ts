/**
 * Bingo Cell API
 * Spec Reference: 06-bingo-gameplay.md - Card State
 */
import { NextRequest, NextResponse } from 'next/server';
import { notifyCell } from '@/lib/team-signals';
import { updateCellState } from '@/lib/db';
import type { CellState } from '@/lib/db/types';
import { errorResponse, withAuth, AuthContext } from '../../utils';

/**
 * PUT /api/cells/[cellId] - Update cell state
 * Spec: 06-bingo-gameplay.md - Toggle between pending and completed
 */
export const PUT = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;
  const body = await request.json();
  const { state } = body;

  // Validate state - only pending and completed are allowed for direct updates
  const validStates = ['pending', 'completed'];
  if (!state || !validStates.includes(state)) {
    return errorResponse('Invalid state. Must be "pending" or "completed"', 400);
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

  return NextResponse.json({ cell: result.cell });
});
