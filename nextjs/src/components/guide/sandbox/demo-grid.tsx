"use client";

/**
 * Grid of a demo card, drawn like a real card; it calls no API.
 * Spec Reference: 26-guided-tour.md - Demo Card
 */

import { CardGrid } from "@/components/bingo-card/card-grid";
import { CellFace } from "@/components/cell/cell-face";
import { JokerCell } from "@/components/cell/joker";
import { CellSourceType, CellState } from "@/lib/shared/types";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DEMO_GRID_SIZE, type DemoCell } from "./demo-cells";

/** States whose mark (stamp or hourglass) animates in when a cell reaches them. */
const MARKED_STATES: ReadonlySet<CellState> = new Set([CellState.COMPLETED, CellState.PENDING_REVIEW]);

interface DemoResolutionCellProps {
  title: string;
  state: CellState;
  /** Click handler; the cell can be clicked only when it is set. */
  onClick?: () => void;
}

/**
 * A demo resolution cell drawn like a real one. Like a real cell (spec 06 - Card Display
 * Rules), its stamp or hourglass animates in when it changes while shown, not on load.
 *
 * @param props - The resolution title, the cell state and the optional click handler.
 * @returns The cell.
 */
const DemoResolutionCell = ({ title, state, onClick }: DemoResolutionCellProps) => {
  const previousStateRef = useRef(state);
  const [stamping, setStamping] = useState(false);

  useEffect(() => {
    const previousState = previousStateRef.current;
    previousStateRef.current = state;
    if (previousState === state) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setStamping(MARKED_STATES.has(state) && !prefersReducedMotion);
  }, [state]);

  return (
    <CellFace
      cell={{
        state,
        resolutionTitle: title,
        resolutionText: title,
        isEmpty: false,
        sourceType: CellSourceType.PERSONAL,
        sourceUserId: null,
      }}
      canInteract={onClick !== undefined}
      sourceLabel={{ kind: "personal" }}
      onClick={onClick ?? (() => { })}
      markMotion={stamping ? "stamping" : "still"}
      onMarkAnimationEnd={() => setStamping(false)} />
  );
};

interface DemoGridProps {
  cells: DemoCell[];
  /** Position of the cell the tour highlights. */
  targetPosition: number;
  /** `data-tour` value of the target cell. */
  targetMarker: string;
  /** Set while the tour waits for the user to click the target cell. */
  onClickTarget?: () => void;
}

/**
 * The cells of a demo card. Only the target cell can be clicked, and only while
 * `onClickTarget` is set.
 *
 * @param props - The cells, the target cell, its marker and its click handler.
 * @returns The grid.
 */
export const DemoGrid = ({ cells, targetPosition, targetMarker, onClickTarget }: DemoGridProps) => {
  const t = useTranslations("Guide.sandbox.cells");

  return (
    <CardGrid gridSize={DEMO_GRID_SIZE}>
      {cells.map((cell, position) => (
        // Each cell sits in its own grid box, so the target can carry its tour marker. The box's
        // column may shrink (minmax(0, 1fr)), or a one-line title from md would widen the cell
        <div
          key={position}
          className="grid min-w-0 grid-cols-1"
          data-tour={position === targetPosition ? targetMarker : undefined}
        >
          {cell.kind === "joker"
            ? <JokerCell />
            : (
              <DemoResolutionCell
                title={t(cell.resolutionKey)}
                state={cell.state}
                onClick={position === targetPosition ? onClickTarget : undefined} />
            )}
        </div>
      ))}
    </CardGrid>
  );
};
