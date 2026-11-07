"use client";

/**
 * The bingo tour: shows the demo card and walks through it with the tour library.
 * Spec Reference: 26-guided-tour.md - Tour Steps
 */

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { GuideStep } from "../engine/intro-adapter";
import { tourSelector } from "../engine/tour-selector";
import { useGuidedTour } from "../engine/use-guided-tour";
import type { GuideTourProps } from "../types";
import { DemoCard } from "./demo-card";
import { DEMO_TARGETS } from "./demo-data";

/** The steps of the bingo tour, in order. */
const BINGO_TOUR_STEPS = ["overview", "card", "cell", "detail", "complete", "completed"] as const;
type BingoTourStepId = (typeof BINGO_TOUR_STEPS)[number];

/** Element highlighted by each step; the overview has none. */
const STEP_TARGETS: Record<BingoTourStepId, string | undefined> = {
  overview: undefined,
  card: DEMO_TARGETS.card,
  cell: DEMO_TARGETS.cell,
  detail: DEMO_TARGETS.detail,
  complete: DEMO_TARGETS.markComplete,
  completed: DEMO_TARGETS.cell,
};

/** Steps the user goes on from by clicking the highlighted element, not Next. */
const ACTION_STEPS: ReadonlySet<BingoTourStepId> = new Set(["cell", "complete"]);

/**
 * Runs the bingo tour on the demo card. On the action steps the user opens the cell and marks
 * it complete by clicking them. The demo state follows the current step, so going back undoes
 * it, and it is dropped with the component when the tour ends.
 *
 * @param props - The callback run when the tour ends.
 * @returns The demo card.
 */
export const BingoTour = ({ onEnd }: GuideTourProps) => {
  const t = useTranslations("Guide.bingoCard");

  const steps = useMemo<GuideStep[]>(
    () => BINGO_TOUR_STEPS.map((stepId) => {
      const target = STEP_TARGETS[stepId];
      return {
        text: t(`steps.${stepId}`),
        title: stepId === "overview" ? t("steps.overviewTitle") : undefined,
        target: target ? tourSelector(target) : undefined,
        action: ACTION_STEPS.has(stepId),
      };
    }),
    [t]
  );
  const { stepIndex, next } = useGuidedTour({ steps, onEnd });

  const stepId = BINGO_TOUR_STEPS[stepIndex] ?? "overview";

  return (
    <DemoCard
      detailOpen={stepId === "detail" || stepId === "complete"}
      targetCompleted={stepId === "completed"}
      onOpenTarget={stepId === "cell" ? next : undefined}
      onMarkComplete={stepId === "complete" ? next : undefined} />
  );
};
