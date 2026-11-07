"use client";

/**
 * The demo card the guided tour runs on, shown above the page; it calls no API.
 * Spec Reference: 26-guided-tour.md - Demo Card
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { DemoGrid } from "../sandbox/demo-grid";
import { SandboxLayer } from "../sandbox/sandbox-layer";
import { DemoCellDetail } from "./demo-cell-detail";
import { createDemoCells, DEMO_TARGET_POSITION, DEMO_TARGETS } from "./demo-data";

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
  const t = useTranslations("Guide");
  const cells = createDemoCells(targetCompleted);
  const target = cells[DEMO_TARGET_POSITION];
  const targetTitle = target.kind === "resolution" ? t(`sandbox.cells.${target.resolutionKey}`) : "";

  return (
    // As wide as a real card on larger screens, so the cell titles are not cut
    <SandboxLayer label={t("bingoCard.demo.title")} notice={t("sandbox.notice")} className="max-w-2xl">
      <Card data-tour={DEMO_TARGETS.card}>
        <CardHeader>
          <CardTitle className="font-headline text-xl">{t("bingoCard.demo.title")}</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <DemoGrid
            cells={cells}
            targetPosition={DEMO_TARGET_POSITION}
            targetMarker={DEMO_TARGETS.cell}
            onClickTarget={onOpenTarget} />
        </CardContent>
      </Card>
      <DemoCellDetail title={targetTitle} open={detailOpen} onMarkComplete={onMarkComplete} />
    </SandboxLayer>
  );
};
