/**
 * Compound Resolutions API
 * Spec Reference: 03-personal-resolutions.md, Resolution Rework — compound type
 *
 * GET    /api/resolutions/compound          — list compound resolutions for current user
 * GET    /api/resolutions/compound?id=...   — get a single compound resolution
 * DELETE /api/resolutions/compound?id=...   — delete a compound resolution
 */

import { getCompoundResolutionsByUser, getCompoundResolutionById } from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { createDeleteHandler, createTypedGetHandler } from '../handlers';

export const GET = createTypedGetHandler(ResolutionType.COMPOUND, getCompoundResolutionsByUser);

export const DELETE = createDeleteHandler(getCompoundResolutionById, 'Compound resolution deleted successfully');
