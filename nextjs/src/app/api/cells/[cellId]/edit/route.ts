/**
 * Cell Edit API
 * Spec Reference: 09-bingo-card-editing.md
 */

import { getCurrentUser } from "@/lib/auth";
import { updateCellContent } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { ResolutionType } from "@/lib/shared/types";


/**
 * PUT /api/cells/[cellId]/edit - Edit a cell's content
 * Spec: 09-bingo-card-editing.md - Persisting a Cell Edit
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cellId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { cellId } = await params;
    const body = await request.json().catch(() => ({}));

    const sourceType = body?.sourceType;
    const sourceUserId = typeof body?.sourceUserId === 'string' ? body.sourceUserId : null;
    const resolutionId = typeof body?.resolutionId === 'string' ? body.resolutionId : null;
    const teamProvidedResolutionId = typeof body?.teamProvidedResolutionId === 'string' ? body.teamProvidedResolutionId : null;
    const resolutionType = typeof body?.resolutionType === 'string'
      && [ResolutionType.BASE, ResolutionType.COMPOUND, ResolutionType.ITERATIVE, ResolutionType.TEAM].includes(body.resolutionType as ResolutionType)
      ? (body.resolutionType as ResolutionType)
      : ResolutionType.BASE;

    const validSourceTypes = ['team', 'member_provided', 'personal', 'empty'] as const;
    if (!validSourceTypes.includes(sourceType)) {
      return NextResponse.json(
        { error: 'Invalid sourceType' },
        { status: 400 }
      );
    }

    if (sourceType === 'personal' && !resolutionId) {
      return NextResponse.json(
        { error: 'resolutionId is required for personal cells' },
        { status: 400 }
      );
    }

    if (sourceType === 'member_provided' && !teamProvidedResolutionId) {
      return NextResponse.json(
        { error: 'teamProvidedResolutionId is required for member_provided cells' },
        { status: 400 }
      );
    }

    const result = await updateCellContent(cellId, currentUser.id, {
      resolutionId,
      resolutionType,
      teamProvidedResolutionId,
      sourceType,
      sourceUserId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update cell content' },
        { status: 400 }
      );
    }

    return NextResponse.json({ cell: result.cell });
  } catch (error) {
    console.error('Edit cell error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}