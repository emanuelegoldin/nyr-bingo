/**
 * Add Prepared Resolution API
 * Spec Reference: 17-prepared-resolutions.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { addPreparedResolutionToUser } from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/resolutions/prepared/[id]/add - Copy a pool entry into the caller's personal resolutions
 * Spec: 17-prepared-resolutions.md - Adding to Personal Resolutions
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ id: string }>
) => {
  const { id } = await params;
  const result = await addPreparedResolutionToUser(id, currentUser.id);

  if ('id' in result) {
    return NextResponse.json({ id: result.id }, { status: 201 });
  }

  return result.error === 'not_found'
    ? errorResponse('Prepared resolution not found', 404)
    : errorResponse('You already have this resolution', 409);
});
