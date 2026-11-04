/**
 * All Resolutions API — returns resolutions of all types for the current user
 *
 * GET /api/resolutions/all — unified list of base + compound + iterative resolutions, newest first
 */

import { NextResponse } from 'next/server';
import { getResolutionsByUser } from '@/lib/db';
import { toUnifiedResolution } from '@/lib/shared/resolution-form';
import { withAuth, AuthContextNoParams } from '../../utils';

/**
 * GET /api/resolutions/all — returns all personal resolutions of all types
 */
export const GET = withAuth(async (request: Request, { currentUser }: AuthContextNoParams) => {
  // The repository already returns them newest first
  const resolutions = (await getResolutionsByUser(currentUser.id)).map(toUnifiedResolution);
  return NextResponse.json({ resolutions });
});
