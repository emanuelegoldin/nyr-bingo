/**
 * Compound Resolutions API
 * Spec Reference: Resolution Rework — compound type
 *
 * GET    /api/resolutions/compound          — list compound resolutions for current user
 * POST   /api/resolutions/compound          — create a new compound resolution
 * PUT    /api/resolutions/compound          — update a compound resolution
 * DELETE /api/resolutions/compound?id=...   — delete a compound resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createCompoundResolution,
  createSystemResolutionHistoryEntry,
  getCompoundResolutionsByUser,
  getCompoundResolutionById,
  getResolutionHistoryAccess,
  updateCompoundResolution,
  deleteCompoundResolution,
} from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import type { Subtask } from '@/lib/shared/types';
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
 * POST /api/resolutions/compound - Create a new compound resolution
 * Body: { title: string, subtasks: Subtask[], description?: string }
 */
export const POST = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const body = await request.json();
  const { title, subtasks, description } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return errorResponse('Title is required', 400);
  }

  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    return errorResponse('At least one subtask is required', 400);
  }

  // Validate subtask shape
  for (const st of subtasks) {
    if (!st.title || typeof st.title !== 'string') {
      return errorResponse('Each subtask must have a title', 400);
    }
  }

  const normalizedSubtasks: Subtask[] = subtasks.map((st: Subtask) => ({
    title: st.title.trim(),
    description: st.description?.trim() ?? '',
    completed: st.completed ?? false,
  }));

  const resolution = await createCompoundResolution(
    currentUser.id,
    title,
    normalizedSubtasks,
    description ?? null
  );

  return NextResponse.json({ resolution }, { status: 201 });
});

/**
 * PUT /api/resolutions/compound - Update a compound resolution
 * Body: { id: string, title?: string, description?: string, subtasks?: Subtask[] }
 */
export const PUT = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const body = await request.json();
  const { id, title, description, subtasks } = body;

  if (!id) {
    return errorResponse('Resolution ID is required', 400);
  }

  const existing = await getCompoundResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  if (existing.ownerUserId !== currentUser.id) {
    return errorResponse('You can only modify your own resolutions', 403);
  }

  const updates: { title?: string; description?: string | null; subtasks?: Subtask[] } = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (subtasks !== undefined) {
    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      return errorResponse('At least one subtask is required', 400);
    }
    updates.subtasks = subtasks.map((st: Subtask) => ({
      title: st.title.trim(),
      description: st.description?.trim() ?? '',
      completed: st.completed ?? false,
    }));
  }

  const resolution = await updateCompoundResolution(id, currentUser.id, updates);
  if (!resolution) {
    return errorResponse('Resolution not found', 404);
  }

  try {
    await createSystemResolutionHistoryEntry(
      id,
      currentUser.id,
      'resolution.compound_updated',
      'Updated compound resolution details',
      {
        titleUpdated: title !== undefined,
        descriptionUpdated: description !== undefined,
        subtasksUpdated: subtasks !== undefined,
      },
    );
  } catch {
    // Preserve core update behavior even if history logging fails.
  }

  return NextResponse.json({ resolution });
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