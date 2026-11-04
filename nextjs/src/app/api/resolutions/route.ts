/**
 * Personal Resolutions API
 * Spec Reference: 03-personal-resolutions.md, Resolution Rework
 *
 * DELETE /api/resolutions?id=...   — delete a resolution of any type
 */

import { getResolutionById } from '@/lib/db';
import { createDeleteHandler } from './handlers';

export const DELETE = createDeleteHandler(getResolutionById, 'Resolution deleted successfully');
