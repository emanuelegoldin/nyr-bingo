/**
 * Cell Edit API
 * Spec Reference: 09-bingo-card-editing.md
 */
import { updateCellContent, User } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { ResolutionType } from "@/lib/shared/types";
import { errorResponse, withAuth, AuthContext } from "@/app/api/utils";

/**
 * PUT /api/cells/[cellId]/edit - Edit a cell's content
 * Spec: 09-bingo-card-editing.md - Persisting a Cell Edit
 */
export const PUT = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;
  const body = await request.json().catch(() => ({}));

  const sourceType = body?.sourceType;
  const sourceUserId = typeof body?.sourceUserId === 'string' ? body.sourceUserId : null;
  const resolutionId = typeof body?.resolutionId === 'string' ? body.resolutionId : null;
  const resolutionType = typeof body?.resolutionType === 'string'
    && [ResolutionType.BASE, ResolutionType.COMPOUND, ResolutionType.ITERATIVE].includes(body.resolutionType as ResolutionType)
    ? (body.resolutionType as ResolutionType)
    : ResolutionType.BASE;

  const validSourceTypes = ['team', 'member_provided', 'personal', 'empty'] as const;
  if (!validSourceTypes.includes(sourceType)) {
    return errorResponse('Invalid sourceType', 400);
  }

  if (sourceType === 'personal' && !resolutionId) {
    return errorResponse('resolutionId is required for personal cells', 400);
  }

  if (sourceType === 'member_provided' && !resolutionId) {
    return errorResponse('resolutionId is required for member_provided cells', 400);
  }
  const result = await updateCellContent(cellId, currentUser.id, { // If we are her, authentication was successful, so currentUser is guaranteed to be non-null
    resolutionId,
    resolutionType,
    sourceType,
    sourceUserId,
  });

  if (!result.success) {
    return errorResponse(result.error || 'Failed to update cell content', 400);
  }

  return NextResponse.json({ cell: result.cell });
});