/**
 * All Resolutions API — returns resolutions of all types for the current user
 *
 * GET /api/resolutions/all — unified list of base + compound + iterative resolutions
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getResolutionsByUser } from '@/lib/db';
import type { Subtask } from '@/lib/shared/types';

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
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

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
  } catch (error) {
    console.error('Get all resolutions error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
