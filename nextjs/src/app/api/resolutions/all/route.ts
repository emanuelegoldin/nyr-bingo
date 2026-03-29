/**
 * All Resolutions API — returns resolutions of all types for the current user
 *
 * GET /api/resolutions/all — unified list of base + compound + iterative resolutions
 */

import { NextResponse } from 'next/server';
import { getResolutionsByUser } from '@/lib/db';
import type { Subtask } from '@/lib/shared/types';
import { errorResponse, withAuth, AuthContextNoParams } from '../../utils';

interface UnifiedResolution {
  id: string;
  type: 'base' | 'compound' | 'iterative';
  ownerUserId: string;
  title: string;
  text: string;
  subtasks?: Subtask[];
  numberOfRepetition?: number;
  completedTimes?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * GET /api/resolutions/all — returns all personal resolutions of all types
 */
export const GET = withAuth(async (request: Request, { currentUser }: AuthContextNoParams) => {
  const allResolutions = await getResolutionsByUser(currentUser.id);

  const resolutions: UnifiedResolution[] = allResolutions.map((r) => {
    const base = {
      id: r.id,
      type: r.resolutionType as 'base' | 'compound' | 'iterative',
      ownerUserId: r.ownerUserId,
      title: r.title,
      text: r.description ?? '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };

    if (r.resolutionType === 'compound') {
      return { ...base, subtasks: r.subtasks ?? undefined };
    }
    if (r.resolutionType === 'iterative') {
      return { ...base, numberOfRepetition: r.numberOfRepetition ?? undefined, completedTimes: r.completedTimes };
    }
    return base;
  });

  // Sort by creation date (newest first)
  resolutions.sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return db - da;
  });

  return NextResponse.json({ resolutions });
});
