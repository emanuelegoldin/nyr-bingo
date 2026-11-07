/**
 * Sample content of the guided tour's demo card, and the elements the tour highlights.
 * Spec Reference: 26-guided-tour.md - Demo Card
 */

import { CellState } from "@/lib/shared/types";

/** Translation keys (namespace `Guide`, under `cells`) of the demo resolutions. */
export type DemoResolutionKey =
  | "read"
  | "run"
  | "cook"
  | "guitar"
  | "travel"
  | "save"
  | "call"
  | "garden";

/** One cell of the demo card: a resolution, or the joker. */
export type DemoCell =
  | { kind: "joker" }
  | { kind: "resolution"; resolutionKey: DemoResolutionKey; state: CellState };

/** Side length of the demo card. */
export const DEMO_GRID_SIZE = 3;

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
 * Builds the selector of an element marked with a `data-tour` attribute.
 *
 * @param target - The `data-tour` value.
 * @returns The CSS selector.
 */
export const tourSelector = (target: string): string => `[data-tour="${target}"]`;

/**
 * Builds the demo card in its initial state: a 3x3 card with a joker in the centre,
 * one completed cell and pending cells. When the target cell is completed, it is shown
 * as completed too.
 *
 * @param targetCompleted - Whether the tour has marked the target cell as complete.
 * @returns The cells, in position order.
 */
export const createDemoCells = (targetCompleted: boolean): DemoCell[] => {
  const pending = (resolutionKey: DemoResolutionKey): DemoCell => ({
    kind: "resolution",
    resolutionKey,
    state: CellState.PENDING,
  });

  return [
    { kind: "resolution", resolutionKey: "read", state: CellState.COMPLETED },
    { kind: "resolution", resolutionKey: "run", state: targetCompleted ? CellState.COMPLETED : CellState.PENDING },
    pending("cook"),
    pending("guitar"),
    { kind: "joker" },
    pending("travel"),
    pending("save"),
    pending("call"),
    pending("garden"),
  ];
};
