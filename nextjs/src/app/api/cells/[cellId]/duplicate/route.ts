/**
 * Cell Duplicate Report API
 * Spec Reference: 05-bingo-card-generation.md - Duplicate Handling
 */
import { NextRequest, NextResponse } from 'next/server';
import { reportDuplicate, getCellById } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/cells/[cellId]/duplicate - Report a duplicate resolution
 * Spec: 05-bingo-card-generation.md - If a generated card contains duplicate resolution texts
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;
  const body = await request.json();
  const { replacementText } = body;

  // Report duplicate
  // Spec: 05-bingo-card-generation.md - The card owner OR the member who provided can report
  const result = await reportDuplicate(cellId, currentUser.id, replacementText);

  if (!result.success) {
    return errorResponse(result.error!, 400);
  }

  // Get updated cell
  const updatedCell = await getCellById(cellId);

  return NextResponse.json({
    message: 'Duplicate reported successfully',
    cell: updatedCell,
  });
});
