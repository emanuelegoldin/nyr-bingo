/**
 * Personal Resolutions API
 * Spec Reference: 03-personal-resolutions.md, Resolution Rework
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResolutionById, deleteResolution } from '@/lib/db';
import { AuthContextNoParams, errorResponse, withAuth } from '@/app/api/utils';

/**
 * DELETE /api/resolutions - Delete a resolution
 * Spec: 03-personal-resolutions.md - User can delete a resolution
 */
export const DELETE = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return errorResponse('Resolution ID is required', 400);
  }

  // Check ownership before delete
  const existing = await getResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }

  // Spec: 03-personal-resolutions.md - User cannot modify someone else's resolutions
  if (existing.ownerUserId !== currentUser.id) {
    return errorResponse('You can only delete your own resolutions', 403);
  }

  const deleted = await deleteResolution(id, currentUser.id);

  if (!deleted) {
    return errorResponse('Failed to delete resolution', 500);
  }

  return NextResponse.json({ message: 'Resolution deleted successfully' });
});