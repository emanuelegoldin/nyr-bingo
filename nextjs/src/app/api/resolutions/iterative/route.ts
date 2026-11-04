/**
 * Iterative Resolutions API
 * Spec Reference: 03-personal-resolutions.md, Resolution Rework — iterative type
 *
 * GET    /api/resolutions/iterative          — list iterative resolutions for current user
 * GET    /api/resolutions/iterative?id=...   — get a single iterative resolution
 * DELETE /api/resolutions/iterative?id=...   — delete an iterative resolution
 */

import { getIterativeResolutionsByUser, getIterativeResolutionById } from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { createDeleteHandler, createTypedGetHandler } from '../handlers';

export const GET = createTypedGetHandler(ResolutionType.ITERATIVE, getIterativeResolutionsByUser);

export const DELETE = createDeleteHandler(getIterativeResolutionById, 'Iterative resolution deleted successfully');
