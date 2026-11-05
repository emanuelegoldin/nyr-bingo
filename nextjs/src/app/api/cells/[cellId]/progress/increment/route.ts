/**
 * Increment Iterative Cell API
 * Spec Reference: 06-bingo-gameplay.md - Progress on a Cell
 *
 * PATCH /api/cells/[cellId]/progress/increment
 * Adds one to the cell's counter and completes the cell when it reaches its target.
 */

import { createIterativeProgressHandler } from '../progress-handler';

export const PATCH = createIterativeProgressHandler({
  delta: 1,
  historyEventKey: 'resolution.iterative_incremented',
});
