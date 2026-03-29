/**
 * Resolution History API
 * Spec Reference: 13-resolution-history-and-progress.md
 *
 * GET  /api/resolutions/[id]/history  - list history entries
 * POST /api/resolutions/[id]/history  - add manual history entry (owner only)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createManualResolutionHistoryEntry,
  getResolutionHistoryAccess,
  getResolutionHistoryEntries,
} from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

function parsePaginationParam(
  rawValue: string | null,
  field: 'limit' | 'offset',
): number | null {
  if (rawValue == null) {
    return field === 'limit' ? 50 : 0;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  if (field === 'limit') {
    if (parsed < 1) return null;
    return parsed;
  }

  if (parsed < 0) {
    return null;
  }

  return parsed;
}

/**
 * GET /api/resolutions/[id]/history
 */
export const GET = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ id: string }>,
) => {
  const { id } = await params;

  const access = await getResolutionHistoryAccess(id, currentUser.id);
  if (!access.resolution) {
    return errorResponse('Resolution not found', 404);
  }
  if (!access.canView) {
    return errorResponse('You are not allowed to view this resolution history', 403);
  }

  const limit = parsePaginationParam(request.nextUrl.searchParams.get('limit'), 'limit');
  if (limit == null) {
    return errorResponse('limit must be an integer greater than 0', 400);
  }

  const offset = parsePaginationParam(request.nextUrl.searchParams.get('offset'), 'offset');
  if (offset == null) {
    return errorResponse('offset must be an integer greater than or equal to 0', 400);
  }

  const entries = await getResolutionHistoryEntries(id, limit, offset);

  return NextResponse.json({
    entries,
    canWrite: access.canWrite,
  });
});

/**
 * POST /api/resolutions/[id]/history
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ id: string }>,
) => {
  const { id } = await params;

  const access = await getResolutionHistoryAccess(id, currentUser.id);
  if (!access.resolution) {
    return errorResponse('Resolution not found', 404);
  }
  if (!access.canWrite) {
    return errorResponse('Only the resolution owner can add history entries', 403);
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content : '';

  if (!content.trim()) {
    return errorResponse('History content is required', 400);
  }

  const entry = await createManualResolutionHistoryEntry(id, currentUser.id, content);
  return NextResponse.json({ entry }, { status: 201 });
});
