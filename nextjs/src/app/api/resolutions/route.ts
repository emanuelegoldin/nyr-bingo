/**
 * Resolutions API - delete one of the caller's resolutions
 * Spec Reference: 03-personal-resolutions.md - Delete
 *
 * DELETE /api/resolutions?id=...   — delete a resolution of any type and scope that the caller owns
 */

import { AuthContextNoParams, errorResponse, withAuth } from '@/app/api/utils';
import { isResolutionOwner } from '@/lib/authz';
import { deleteResolution, getResolutionById } from '@/lib/db';
import { getResolutionTeamIds, notifyTeams } from '@/lib/team-signals';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/resolutions?id=<id> - Delete a resolution. Only its owner may, and cards keep their copy of it.
 * Spec: 03-personal-resolutions.md - Delete, Permissions
 */
export const DELETE = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return errorResponse('Resolution ID is required', 400);
  }

  const existing = await getResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  // Spec: 03-personal-resolutions.md - User cannot modify someone else's resolutions
  if (!isResolutionOwner(existing, currentUser.id)) {
    return errorResponse('You can only delete your own resolutions', 403);
  }

  // Read first: the row is gone after the delete. Cards keep their copy (spec 03).
  const teamIds = await getResolutionTeamIds(id);
  const deleted = await deleteResolution(id, currentUser.id);
  if (!deleted) {
    return errorResponse('Failed to delete resolution', 500);
  }

  await notifyTeams(teamIds);

  return NextResponse.json({ message: 'Resolution deleted successfully' });
});
