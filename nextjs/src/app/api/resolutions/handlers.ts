/**
 * Shared handlers for the personal resolution routes.
 * Spec Reference: 03-personal-resolutions.md - Read, Delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { isResolutionOwner } from '@/lib/authz';
import { getResolutionTeamIds, notifyTeams } from '@/lib/team-signals';
import { deleteResolution, getResolutionById } from '@/lib/db';
import type { Resolution } from '@/lib/db/types';
import { ResolutionType } from '@/lib/shared/types';
import { errorResponse, withAuth, AuthContextNoParams } from '@/app/api/utils';

/**
 * Builds a DELETE handler for `?id=<id>` that only lets the owner delete the resolution.
 * @param loadResolution Loads the resolution to delete; a type-specific loader makes other types 404
 * @param successMessage Message returned when the delete succeeds
 * @returns The route handler
 */
export function createDeleteHandler(
  loadResolution: (id: string) => Promise<Resolution | null>,
  successMessage: string
) {
  return withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return errorResponse('Resolution ID is required', 400);
    }

    const existing = await loadResolution(id);
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

    return NextResponse.json({ message: successMessage });
  });
}

/**
 * Builds the GET handler of a type-specific resolution route.
 * Without ?id it lists the caller's resolutions of that type.
 * With ?id it returns a single resolution of that type, to its owner only (spec 03).
 * @param type The resolution type served by the route
 * @param listByUser Lists the caller's resolutions of that type
 * @returns The route handler
 */
export function createTypedGetHandler(
  type: ResolutionType,
  listByUser: (userId: string) => Promise<Resolution[]>
) {
  return withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
    const id = new URL(request.url).searchParams.get('id');

    if (id) {
      const resolution = await getResolutionById(id);
      if (!resolution || resolution.resolutionType !== type || !isResolutionOwner(resolution, currentUser.id)) {
        return errorResponse('Resolution not found', 404);
      }
      return NextResponse.json({ resolution });
    }

    const resolutions = await listByUser(currentUser.id);
    return NextResponse.json({ resolutions });
  });
}
