/**
 * Bingo Cell API
 * Spec Reference: 06-bingo-gameplay.md - Card State, Cell Detail Dialog
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCellAccess } from '@/lib/authz';
import { announceCellChanges } from '@/lib/notifications';
import { notifyCell } from '@/lib/team-signals';
import { updateCellState } from '@/lib/db';
import { requireCardOwner } from '../card-owner';
import type { CellState } from '@/lib/db/types';
import { errorResponse, withAuth, AuthContext } from '../../utils';

/**
 * GET /api/cells/[cellId] - The cell with its copy of the resolution and its progress
 * Spec: 06-bingo-gameplay.md - Cell Detail Dialog. Visible to whoever can view the card.
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;

  const access = await getCellAccess(cellId, currentUser.id);
  if (!access.cell) {
    return errorResponse('Cell not found', 404);
  }
  if (!access.canView) {
    return errorResponse('You are not allowed to view this cell', 403);
  }

  return NextResponse.json({ cell: access.cell });
});

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

  // Spec: 06-bingo-gameplay.md - Only the card owner can change their card's cell states
  const denied = await requireCardOwner(currentUser, cellId, 'Only the card owner can update cell state');
  if (denied) return denied;

  const result = await updateCellState(cellId, state as CellState);

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
