/**
 * Decrement Iterative Resolution API
 * Spec Reference: Resolution Rework — iterative type
 *
 * PATCH /api/resolutions/iterative/[id]/decrement
 * Decrements the completed_times counter (floor 0) and reverts bingo cell if below threshold.
 */

import { createIterativeProgressHandler } from '../progress-handler';

export const PATCH = createIterativeProgressHandler({
  delta: -1,
  failureMessage: 'Failed to decrement',
  historyEventKey: 'resolution.iterative_decremented',
});
