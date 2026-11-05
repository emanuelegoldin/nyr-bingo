/**
 * Decrement Iterative Cell API
 * Spec Reference: 06-bingo-gameplay.md - Progress on a Cell
 *
 * PATCH /api/cells/[cellId]/progress/decrement
 * Subtracts one from the cell's counter (never below 0) and reverts a completed cell below its target.
 */

import { createIterativeProgressHandler } from '../progress-handler';

export const PATCH = createIterativeProgressHandler({
  delta: -1,
  historyEventKey: 'resolution.iterative_decremented',
});
