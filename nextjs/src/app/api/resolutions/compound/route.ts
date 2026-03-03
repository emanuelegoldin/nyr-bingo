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
import { getCurrentUser } from '@/lib/auth';
import {
  createCompoundResolution,
  getCompoundResolutionsByUser,
  getCompoundResolutionById,
  updateCompoundResolution,
  deleteCompoundResolution,
} from '@/lib/db';
import type { Subtask } from '@/lib/shared/types';

/**
 * GET /api/resolutions/compound - Get compound resolutions
 * Without ?id: returns all compound resolutions for the current user.
 * With ?id=...: returns a single compound resolution by ID (must own it).
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const resolution = await getCompoundResolutionById(id);
      if (!resolution) {
        return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
      }
      if (resolution.ownerUserId !== currentUser.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      return NextResponse.json({ resolution });
    }

    const resolutions = await getCompoundResolutionsByUser(currentUser.id);
    return NextResponse.json({ resolutions });
  } catch (error) {
    console.error('Get compound resolutions error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/resolutions/compound - Create a new compound resolution
 * Body: { title: string, subtasks: Subtask[], description?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { title, subtasks, description } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      return NextResponse.json({ error: 'At least one subtask is required' }, { status: 400 });
    }

    // Validate subtask shape
    for (const st of subtasks) {
      if (!st.title || typeof st.title !== 'string') {
        return NextResponse.json({ error: 'Each subtask must have a title' }, { status: 400 });
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
  } catch (error) {
    console.error('Create compound resolution error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * PUT /api/resolutions/compound - Update a compound resolution
 * Body: { id: string, title?: string, description?: string, subtasks?: Subtask[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, description, subtasks } = body;

    if (!id) {
      return NextResponse.json({ error: 'Resolution ID is required' }, { status: 400 });
    }

    const existing = await getCompoundResolutionById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }
    if (existing.ownerUserId !== currentUser.id) {
      return NextResponse.json({ error: 'You can only modify your own resolutions' }, { status: 403 });
    }

    const updates: { title?: string; description?: string | null; subtasks?: Subtask[] } = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (subtasks !== undefined) {
      if (!Array.isArray(subtasks) || subtasks.length === 0) {
        return NextResponse.json({ error: 'At least one subtask is required' }, { status: 400 });
      }
      updates.subtasks = subtasks.map((st: Subtask) => ({
        title: st.title.trim(),
        description: st.description?.trim() ?? '',
        completed: st.completed ?? false,
      }));
    }

    const resolution = await updateCompoundResolution(id, currentUser.id, updates);
    if (!resolution) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }

    return NextResponse.json({ resolution });
  } catch (error) {
    console.error('Update compound resolution error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * DELETE /api/resolutions/compound?id=... - Delete a compound resolution
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Resolution ID is required' }, { status: 400 });
    }

    const existing = await getCompoundResolutionById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }
    if (existing.ownerUserId !== currentUser.id) {
      return NextResponse.json({ error: 'You can only delete your own resolutions' }, { status: 403 });
    }

    const deleted = await deleteCompoundResolution(id, currentUser.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete resolution' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Compound resolution deleted successfully' });
  } catch (error) {
    console.error('Delete compound resolution error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
