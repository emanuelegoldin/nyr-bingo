/**
 * Personal Resolutions API
 * Spec Reference: 03-personal-resolutions.md, Resolution Rework
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSystemResolutionHistoryEntry,
  createResolution,
  getResolutionsByUser,
  getResolutionById,
  updateResolution,
  deleteResolution,
} from '@/lib/db';
import { AuthContextNoParams, errorResponse, withAuth } from '@/app/api/utils';

/**
 * GET /api/resolutions - Get all resolutions for current user
 * Spec: 03-personal-resolutions.md - User can list and view their own resolutions
 */
export const GET = withAuth(async (_request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const resolutions = await getResolutionsByUser(currentUser.id);
  return NextResponse.json({ resolutions });
});

/**
 * POST /api/resolutions - Create a new resolution
 * Spec: 03-personal-resolutions.md - User can add a resolution (text)
 */
export const POST = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const body = await request.json();
  const { text, title } = body;

  // Spec: 03-personal-resolutions.md - Resolution text must be non-empty
  if (!text || text.trim().length === 0) {
    return errorResponse('Resolution text is required', 400);
  }

  const resolution = await createResolution(currentUser.id, text, title);

  try {
    await createSystemResolutionHistoryEntry(
      resolution.id,
      currentUser.id,
      'resolution.created',
      'Created base resolution',
      { type: 'base' },
    );
  } catch {
    // Preserve core create behavior even if history logging fails.
  }

  return NextResponse.json({ resolution }, { status: 201 });
});

/**
 * PUT /api/resolutions - Update a resolution
 * Spec: 03-personal-resolutions.md - User can edit an existing resolution's text
 */
export const PUT = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const body = await request.json();
  const { id, text, title } = body;

  if (!id) {
    return errorResponse('Resolution ID is required', 400);
  }

  // Spec: 03-personal-resolutions.md - Resolution text must be non-empty
  if (!text || text.trim().length === 0) {
    return errorResponse('Resolution text is required', 400);
  }

  // Check ownership before update
  const existing = await getResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }

  // Spec: 03-personal-resolutions.md - User cannot modify someone else's resolutions
  if (existing.ownerUserId !== currentUser.id) {
    return errorResponse('You can only modify your own resolutions', 403);
  }

  const resolution = await updateResolution(id, currentUser.id, text, title);

  if (!resolution) {
    return errorResponse('Resolution not found', 404);
  }

  try {
    await createSystemResolutionHistoryEntry(
      resolution.id,
      currentUser.id,
      'resolution.updated',
      'Updated base resolution',
      { type: 'base' },
    );
  } catch {
    // Preserve core update behavior even if history logging fails.
  }

  return NextResponse.json({ resolution });
});

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