/**
 * Compound Resolutions API
 * Spec Reference: Resolution Rework — compound type
 *
 * GET    /api/resolutions/compound          — list compound resolutions for current user
 * DELETE /api/resolutions/compound?id=...   — delete a compound resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCompoundResolutionsByUser,
  getCompoundResolutionById,
  getResolutionHistoryAccess,
  deleteCompoundResolution,
} from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { errorResponse, withAuth, AuthContextNoParams } from '@/app/api/utils';

/**
 * GET /api/resolutions/compound - Get compound resolutions
 * Without ?id: returns all compound resolutions for the current user.
 * With ?id=...: returns a single compound resolution by ID (any authenticated user).
 */
export const GET = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const access = await getResolutionHistoryAccess(id, currentUser.id);
    if (!access.resolution || access.resolution.resolutionType !== ResolutionType.COMPOUND) {
      return errorResponse('Resolution not found', 404);
    }
    if (!access.canView) {
      return errorResponse('You are not allowed to view this resolution', 403);
    }
    return NextResponse.json({ resolution: access.resolution });
  }

  const resolutions = await getCompoundResolutionsByUser(currentUser.id);
  return NextResponse.json({ resolutions });
});

/**
 * DELETE /api/resolutions/compound?id=... - Delete a compound resolution
 */
export const DELETE = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return errorResponse('Resolution ID is required', 400);
  }

  const existing = await getCompoundResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  if (existing.ownerUserId !== currentUser.id) {
    return errorResponse('You can only delete your own resolutions', 403);
  }

  const deleted = await deleteCompoundResolution(id, currentUser.id);
  if (!deleted) {
    return errorResponse('Failed to delete resolution', 500);
  }

  return NextResponse.json({ message: 'Compound resolution deleted successfully' });
});