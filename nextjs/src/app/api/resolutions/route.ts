/**
 * Personal Resolutions API
 * Spec Reference: 03-personal-resolutions.md, Resolution Rework
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  createResolution, 
  getResolutionsByUser, 
  getResolutionById,
  updateResolution, 
  deleteResolution 
} from '@/lib/db';

/**
 * GET /api/resolutions - Get all resolutions for current user
 * Spec: 03-personal-resolutions.md - User can list and view their own resolutions
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const resolutions = await getResolutionsByUser(currentUser.id);
    
    return NextResponse.json({ resolutions });
  } catch (error) {
    console.error('Get resolutions error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/resolutions - Create a new resolution
 * Spec: 03-personal-resolutions.md - User can add a resolution (text)
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text, title } = body;

    // Spec: 03-personal-resolutions.md - Resolution text must be non-empty
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Resolution text is required' },
        { status: 400 }
      );
    }

    const resolution = await createResolution(currentUser.id, text, title);
    
    return NextResponse.json({ resolution }, { status: 201 });
  } catch (error) {
    console.error('Create resolution error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/resolutions - Update a resolution
 * Spec: 03-personal-resolutions.md - User can edit an existing resolution's text
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, text, title } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Resolution ID is required' },
        { status: 400 }
      );
    }

    // Spec: 03-personal-resolutions.md - Resolution text must be non-empty
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Resolution text is required' },
        { status: 400 }
      );
    }

    // Check ownership before update
    const existing = await getResolutionById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Resolution not found' },
        { status: 404 }
      );
    }

    // Spec: 03-personal-resolutions.md - User cannot modify someone else's resolutions
    if (existing.ownerUserId !== currentUser.id) {
      return NextResponse.json(
        { error: 'You can only modify your own resolutions' },
        { status: 403 }
      );
    }

    const resolution = await updateResolution(id, currentUser.id, text, title);
    
    if (!resolution) {
      return NextResponse.json(
        { error: 'Resolution not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ resolution });
  } catch (error) {
    console.error('Update resolution error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/resolutions - Delete a resolution
 * Spec: 03-personal-resolutions.md - User can delete a resolution
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Resolution ID is required' },
        { status: 400 }
      );
    }

    // Check ownership before delete
    const existing = await getResolutionById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Resolution not found' },
        { status: 404 }
      );
    }

    // Spec: 03-personal-resolutions.md - User cannot modify someone else's resolutions
    if (existing.ownerUserId !== currentUser.id) {
      return NextResponse.json(
        { error: 'You can only delete your own resolutions' },
        { status: 403 }
      );
    }

    const deleted = await deleteResolution(id, currentUser.id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete resolution' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ message: 'Resolution deleted successfully' });
  } catch (error) {
    console.error('Delete resolution error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
