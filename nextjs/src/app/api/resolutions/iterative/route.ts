/**
 * Iterative Resolutions API
 * Spec Reference: Resolution Rework — iterative type
 *
 * GET    /api/resolutions/iterative          — list iterative resolutions for current user
 * POST   /api/resolutions/iterative          — create a new iterative resolution
 * PUT    /api/resolutions/iterative          — update an iterative resolution
 * DELETE /api/resolutions/iterative?id=...   — delete an iterative resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSystemResolutionHistoryEntry,
  createIterativeResolution,
  getIterativeResolutionsByUser,
  getResolutionHistoryAccess,
  updateIterativeResolution,
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
 * POST /api/resolutions/iterative - Create a new iterative resolution
 * Body: { title: string, numberOfRepetition: number, description?: string }
 */
export const POST = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const body = await request.json();
  const { title, numberOfRepetition, description } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return errorResponse('Title is required', 400);
  }

  if (typeof numberOfRepetition !== 'number' || numberOfRepetition < 2) {
    return errorResponse('numberOfRepetition must be a positive integer greater than 1', 400);
  }

  const resolution = await createIterativeResolution(
    currentUser.id,
    title,
    numberOfRepetition,
    description ?? null
  );

  return NextResponse.json({ resolution }, { status: 201 });
});

/**
 * PUT /api/resolutions/iterative - Update an iterative resolution
 * Body: { id: string, title?: string, description?: string, numberOfRepetition?: number }
 */
export const PUT = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const body = await request.json();
  const { id, title, description, numberOfRepetition } = body;

  if (!id) {
    return errorResponse('Resolution ID is required', 400);
  }

  const existing = await getIterativeResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  if (existing.ownerUserId !== currentUser.id) {
    return errorResponse('You can only modify your own resolutions', 403);
  }

  const updates: { title?: string; description?: string | null; numberOfRepetition?: number } = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (numberOfRepetition !== undefined) {
    if (typeof numberOfRepetition !== 'number' || numberOfRepetition < 2) {
      return errorResponse('numberOfRepetition must be a positive integer greater than 1', 400);
    }
    updates.numberOfRepetition = numberOfRepetition;
  }

  const resolution = await updateIterativeResolution(id, currentUser.id, updates);
  if (!resolution) {
    return errorResponse('Resolution not found', 404);
  }

  try {
    await createSystemResolutionHistoryEntry(
      id,
      currentUser.id,
      'resolution.iterative_updated',
      'Updated iterative resolution details',
      {
        titleUpdated: title !== undefined,
        descriptionUpdated: description !== undefined,
        repetitionUpdated: numberOfRepetition !== undefined,
      },
    );
  } catch {
    // Preserve core update behavior even if history logging fails.
  }

  return NextResponse.json({ resolution });
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
