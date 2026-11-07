/**
 * Sample content of the guided tour's demo card, and the elements the tour highlights.
 * Spec Reference: 26-guided-tour.md - Demo Card
 */

import { CellState } from "@/lib/shared/types";
import { buildDemoCells, type DemoCell } from "../sandbox/demo-cells";

/** Position of the cell the tour focuses on and marks as complete. */
export const DEMO_TARGET_POSITION = 1;

/** `data-tour` values of the elements highlighted by the tour steps. */
export const DEMO_TARGETS = {
  card: "demo-card",
  cell: "demo-cell",
  detail: "demo-cell-detail",
  markComplete: "demo-mark-complete",
} as const;

/**
 * Builds the demo card in its initial state: a 3x3 card with a joker in the centre,
 * one completed cell and pending cells. When the target cell is completed, it is shown
 * as completed too.
 *
 * @param targetCompleted - Whether the tour has marked the target cell as complete.
 * @returns The cells, in position order.
 */
export const createDemoCells = (targetCompleted: boolean): DemoCell[] =>
  buildDemoCells(
    ["read", "run", "cook", "guitar", "travel", "save", "call", "garden"],
    { 0: CellState.COMPLETED, ...(targetCompleted ? { [DEMO_TARGET_POSITION]: CellState.COMPLETED } : {}) }
  );
