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
import { createPortal } from "react-dom";
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
 * Full-screen layer with the demo card, and the details of its target cell drawn over the card
 * like the real cell dialog. It is a plain element rather than a modal dialog, whose focus trap
 * would block the tour's tooltip.
 *
 * @param props - The demo state derived from the current tour step.
 * @returns The layer, rendered into the document body.
 */
export const DemoCard = ({ detailOpen, targetCompleted, onOpenTarget, onMarkComplete }: DemoCardProps) => {
  const t = useTranslations("Guide");
  const cells = createDemoCells(targetCompleted);
  const target = cells[DEMO_TARGET_POSITION];
  const targetTitle = target.kind === "resolution" ? t(`cells.${target.resolutionKey}`) : "";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("demo.title")}
      className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-sm"
    >
      {/* As wide as a real card on larger screens, so the cell titles are not cut */}
      <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <p className="text-center text-sm text-muted-foreground">{t("demo.notice")}</p>
        <Card data-tour={DEMO_TARGETS.card}>
          <CardHeader>
            <CardTitle className="font-headline text-xl">{t("demo.title")}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <CardGrid gridSize={DEMO_GRID_SIZE}>
              {cells.map((cell, position) => (
                // Each cell sits in its own grid box, so the target can carry its tour marker
                <div
                  key={position}
                  className="grid"
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
      </div>
    </div>,
    document.body
  );
};
