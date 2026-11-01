/**
 * Prepared Resolutions API
 * Spec Reference: 17-prepared-resolutions.md
 */

import { NextResponse } from 'next/server';
import { getPreparedResolutions } from '@/lib/db';
import { withAuth } from '@/app/api/utils';

/**
 * GET /api/resolutions/prepared - List the shared pool
 * Spec: 17-prepared-resolutions.md - Browsing the Pool
 */
export const GET = withAuth(async () => {
  const resolutions = await getPreparedResolutions();

  return NextResponse.json({ resolutions });
});
