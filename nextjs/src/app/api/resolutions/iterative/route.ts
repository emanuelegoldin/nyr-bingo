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
import { getCurrentUser } from '@/lib/auth';
import {
  createIterativeResolution,
  getIterativeResolutionsByUser,
  getIterativeResolutionById,
  updateIterativeResolution,
  deleteIterativeResolution,
} from '@/lib/db';

/**
 * GET /api/resolutions/iterative - Get iterative resolutions
 * Without ?id: returns all iterative resolutions for the current user.
 * With ?id=...: returns a single iterative resolution by ID (must own it).
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
      const resolution = await getIterativeResolutionById(id);
      if (!resolution) {
        return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
      }
      if (resolution.ownerUserId !== currentUser.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      return NextResponse.json({ resolution });
    }

    const resolutions = await getIterativeResolutionsByUser(currentUser.id);
    return NextResponse.json({ resolutions });
  } catch (error) {
    console.error('Get iterative resolutions error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/resolutions/iterative - Create a new iterative resolution
 * Body: { title: string, numberOfRepetition: number, description?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { title, numberOfRepetition, description } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (typeof numberOfRepetition !== 'number' || numberOfRepetition < 1) {
      return NextResponse.json(
        { error: 'numberOfRepetition must be a positive integer' },
        { status: 400 }
      );
    }

    const resolution = await createIterativeResolution(
      currentUser.id,
      title,
      numberOfRepetition,
      description ?? null
    );

    return NextResponse.json({ resolution }, { status: 201 });
  } catch (error) {
    console.error('Create iterative resolution error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * PUT /api/resolutions/iterative - Update an iterative resolution
 * Body: { id: string, title?: string, description?: string, numberOfRepetition?: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, description, numberOfRepetition } = body;

    if (!id) {
      return NextResponse.json({ error: 'Resolution ID is required' }, { status: 400 });
    }

    const existing = await getIterativeResolutionById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }
    if (existing.ownerUserId !== currentUser.id) {
      return NextResponse.json({ error: 'You can only modify your own resolutions' }, { status: 403 });
    }

    const updates: { title?: string; description?: string | null; numberOfRepetition?: number } = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (numberOfRepetition !== undefined) {
      if (typeof numberOfRepetition !== 'number' || numberOfRepetition < 1) {
        return NextResponse.json(
          { error: 'numberOfRepetition must be a positive integer' },
          { status: 400 }
        );
      }
      updates.numberOfRepetition = numberOfRepetition;
    }

    const resolution = await updateIterativeResolution(id, currentUser.id, updates);
    if (!resolution) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }

    return NextResponse.json({ resolution });
  } catch (error) {
    console.error('Update iterative resolution error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

/**
 * DELETE /api/resolutions/iterative?id=... - Delete an iterative resolution
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

    const existing = await getIterativeResolutionById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }
    if (existing.ownerUserId !== currentUser.id) {
      return NextResponse.json({ error: 'You can only delete your own resolutions' }, { status: 403 });
    }

    const deleted = await deleteIterativeResolution(id, currentUser.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete resolution' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Iterative resolution deleted successfully' });
  } catch (error) {
    console.error('Delete iterative resolution error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
