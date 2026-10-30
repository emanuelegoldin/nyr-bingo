/**
 * Increment Iterative Resolution API
 * Spec Reference: Resolution Rework — iterative type
 *
 * PATCH /api/resolutions/iterative/[id]/increment
 * Increments the completed_times counter and auto-completes bingo cell if threshold met.
 */

import { incrementIterativeResolution } from '@/lib/db';
import { createIterativeProgressHandler } from '../progress-handler';

export const PATCH = createIterativeProgressHandler({
  applyChange: incrementIterativeResolution,
  failureMessage: 'Failed to increment',
  historyEventKey: 'resolution.iterative_incremented',
});
