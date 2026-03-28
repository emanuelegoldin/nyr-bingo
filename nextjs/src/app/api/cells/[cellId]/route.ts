/**
 * Bingo Cell API
 * Spec Reference: 06-bingo-gameplay.md - Card State
 */
import { NextRequest, NextResponse } from 'next/server';
import { updateCellState, getCellById, User } from '@/lib/db';
import type { CellState } from '@/lib/db/types';
import { errorResponse, withAuth, AuthContext } from '../../utils';

/**
 * GET /api/cells/[cellId] - Get cell details
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;
  const cell = await getCellById(cellId);
  if (!cell) {
    return errorResponse('Cell not found', 404);
  }
  return NextResponse.json({ cell });
});

/**
 * PUT /api/cells/[cellId] - Update cell state
 * Spec: 06-bingo-gameplay.md - Toggle between pending and completed
 * Updated: Support new states for proof workflow
 */
export const PUT = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;
  const body = await request.json();
  const { state } = body;

  // Validate state - only pending, completed, and accomplished allowed for direct updates
  const validStates = ['pending', 'completed', 'accomplished'];
  if (!state || !validStates.includes(state)) {
    return errorResponse('Invalid state. Must be "pending", "completed", or "accomplished"', 400);
  }

  // Update cell state
  // Spec: 06-bingo-gameplay.md - Only the card owner can change their card's cell states
  const result = await updateCellState(cellId, currentUser.id, state as CellState);

  if (!result.success) {
    return errorResponse('Failed to update cell state', 400);
  }

  return NextResponse.json({ cell: result.cell });
});
