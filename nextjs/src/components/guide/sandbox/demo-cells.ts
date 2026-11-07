/**
 * Sample cells shared by the tours' demo cards.
 * Spec Reference: 26-guided-tour.md - Demo Card
 */

import { CellState } from "@/lib/shared/types";

/** Translation keys (namespace `Guide.sandbox.cells`) of the demo resolutions. */
export type DemoResolutionKey =
  | "read"
  | "run"
  | "cook"
  | "guitar"
  | "travel"
  | "save"
  | "call"
  | "garden";

/** One cell of a demo card: a resolution, or the joker. */
export type DemoCell =
  | { kind: "joker" }
  | { kind: "resolution"; resolutionKey: DemoResolutionKey; state: CellState };

/** Side length of the demo cards. */
export const DEMO_GRID_SIZE = 3;

/**
 * Builds a 3x3 demo card with the joker in the centre.
 *
 * @param keys - The eight resolutions, in position order, skipping the centre.
 * @param states - States of the cells that are not pending, by position.
 * @returns The cells, in position order.
 */
export const buildDemoCells = (
  keys: readonly DemoResolutionKey[],
  states: Readonly<Partial<Record<number, CellState>>>
): DemoCell[] => {
  const cells: DemoCell[] = keys.map((resolutionKey) => ({ kind: "resolution", resolutionKey, state: CellState.PENDING }));
  cells.splice(4, 0, { kind: "joker" });
  return cells.map((cell, position) => {
    const state = states[position];
    return cell.kind === "resolution" && state ? { ...cell, state } : cell;
  });
};
