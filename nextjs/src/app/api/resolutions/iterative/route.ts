/**
 * Iterative Resolutions API
 * Spec Reference: Resolution Rework — iterative type
 *
 * GET    /api/resolutions/iterative          — list iterative resolutions for current user
 * DELETE /api/resolutions/iterative?id=...   — delete an iterative resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getIterativeResolutionsByUser,
  getResolutionHistoryAccess,
  getIterativeResolutionById,
  deleteIterativeResolution,
} from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { errorResponse, withAuth, AuthContextNoParams } from '@/app/api/utils';

/**
 * GET /api/resolutions/iterative - Get iterative resolutions
 * Without ?id: returns all iterative resolutions for the current user.
 * With ?id=...: returns a single iterative resolution by ID (any authenticated user).
 */
export const GET = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const access = await getResolutionHistoryAccess(id, currentUser.id);
    if (!access.resolution || access.resolution.resolutionType !== ResolutionType.ITERATIVE) {
      return errorResponse('Resolution not found', 404);
    }
    if (!access.canView) {
      return errorResponse('You are not allowed to view this resolution', 403);
    }
    return NextResponse.json({ resolution: access.resolution });
  }

  const resolutions = await getIterativeResolutionsByUser(currentUser.id);
  return NextResponse.json({ resolutions });
});

/**
 * DELETE /api/resolutions/iterative?id=... - Delete an iterative resolution
 */
export const DELETE = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return errorResponse('Resolution ID is required', 400);
  }

  const existing = await getIterativeResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  if (existing.ownerUserId !== currentUser.id) {
    return errorResponse('You can only delete your own resolutions', 403);
  }

  const deleted = await deleteIterativeResolution(id, currentUser.id);
  if (!deleted) {
    return errorResponse('Failed to delete resolution', 500);
  }

  return NextResponse.json({ message: 'Iterative resolution deleted successfully' });
});
