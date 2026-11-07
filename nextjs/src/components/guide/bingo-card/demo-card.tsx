"use client";

/**
 * The demo card the guided tour runs on, shown above the page; it calls no API.
 * Spec Reference: 26-guided-tour.md - Demo Card
 */

import { CardGrid } from "@/components/bingo-card/card-grid";
import { CellFace } from "@/components/cell/cell-face";
import { JokerCell } from "@/components/cell/joker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CellSourceType, CellState } from "@/lib/shared/types";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SandboxLayer } from "../sandbox/sandbox-layer";
import { DemoCellDetail } from "./demo-cell-detail";
import { createDemoCells, DEMO_GRID_SIZE, DEMO_TARGET_POSITION, DEMO_TARGETS } from "./demo-data";

interface DemoResolutionCellProps {
  title: string;
  state: CellState;
  /** Click handler; the cell can be clicked only when it is set. */
  onClick?: () => void;
}

/**
 * A demo resolution cell drawn like a real one. Like a real cell (spec 06 - Card Display
 * Rules), its stamp animates in when it becomes completed while shown, not on load.
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
    setStamping(state === CellState.COMPLETED && !prefersReducedMotion);
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

interface DemoCardProps {
  /** Whether the details of the target cell are shown. */
  detailOpen: boolean;
  /** Whether the tour has marked the target cell as complete. */
  targetCompleted: boolean;
  /** Set while the tour waits for the user to open the target cell. */
  onOpenTarget?: () => void;
  /** Set while the tour waits for the user to mark the target cell as complete. */
  onMarkComplete?: () => void;
}

/**
 * The demo card above the page, and the details of its target cell drawn over the card like
 * the real cell dialog.
 *
 * @param props - The demo state derived from the current tour step.
 * @returns The demo layer with the card.
 */
export const DemoCard = ({ detailOpen, targetCompleted, onOpenTarget, onMarkComplete }: DemoCardProps) => {
  const t = useTranslations("Guide.bingoCard");
  const cells = createDemoCells(targetCompleted);
  const target = cells[DEMO_TARGET_POSITION];
  const targetTitle = target.kind === "resolution" ? t(`cells.${target.resolutionKey}`) : "";

  return (
    // As wide as a real card on larger screens, so the cell titles are not cut
    <SandboxLayer label={t("demo.title")} notice={t("demo.notice")} className="max-w-2xl">
      <Card data-tour={DEMO_TARGETS.card}>
        <CardHeader>
          <CardTitle className="font-headline text-xl">{t("demo.title")}</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <CardGrid gridSize={DEMO_GRID_SIZE}>
            {cells.map((cell, position) => (
              // Each cell sits in its own grid box, so the target can carry its tour marker. The box's
              // column may shrink (minmax(0, 1fr)), or a one-line title from md would widen the cell
              <div
                key={position}
                className="grid min-w-0 grid-cols-1"
                data-tour={position === DEMO_TARGET_POSITION ? DEMO_TARGETS.cell : undefined}
              >
                {cell.kind === "joker"
                  ? <JokerCell />
                  : (
                    <DemoResolutionCell
                      title={t(`cells.${cell.resolutionKey}`)}
                      state={cell.state}
                      onClick={position === DEMO_TARGET_POSITION ? onOpenTarget : undefined} />
                  )}
              </div>
            ))}
          </CardGrid>
        </CardContent>
      </Card>
      <DemoCellDetail title={targetTitle} open={detailOpen} onMarkComplete={onMarkComplete} />
    </SandboxLayer>
  );
};
