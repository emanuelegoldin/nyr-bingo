"use client";

/**
 * The bingo tour: shows the demo card and walks through it with the tour library.
 * Spec Reference: 26-guided-tour.md - Tour Steps
 */

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DemoCard } from "./demo-card";
import { DEMO_TARGETS, tourSelector } from "./demo-data";
import type { GuideStep, GuideTourHandle } from "./intro-adapter";

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

interface BingoTourProps {
  /** Called when the tour ends: finished, skipped or closed. */
  onEnd: () => void;
}

/**
 * Runs the bingo tour on the demo card. The demo state follows the current step, so going
 * back undoes it, and it is dropped with the component when the tour ends.
 *
 * @param props - The callback run when the tour ends.
 * @returns The demo card.
 */
export const BingoTour = ({ onEnd }: BingoTourProps) => {
  const t = useTranslations("Guide");
  const [stepIndex, setStepIndex] = useState(0);
  // The running tour calls the latest callback without being restarted when it changes
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    let cancelled = false;
    let handle: GuideTourHandle | null = null;

    const steps: GuideStep[] = BINGO_TOUR_STEPS.map((stepId) => {
      const target = STEP_TARGETS[stepId];
      return {
        text: t(`steps.${stepId}`),
        title: stepId === "overview" ? t("steps.overviewTitle") : undefined,
        target: target ? tourSelector(target) : undefined,
      };
    });

    // The library is loaded only when a tour starts
    void import("./intro-adapter").then(async ({ startTour }) => {
      if (cancelled) return;
      const started = await startTour({
        steps,
        labels: { next: t("nav.next"), back: t("nav.back"), done: t("nav.done") },
        onStepChange: setStepIndex,
        onEnd: () => onEndRef.current(),
      });
      if (cancelled) {
        started.stop();
        return;
      }
      handle = started;
    });

    return () => {
      cancelled = true;
      handle?.stop();
    };
  }, [t]);

  const stepId = BINGO_TOUR_STEPS[stepIndex] ?? "overview";

  return (
    <DemoCard
      detailOpen={stepId === "detail" || stepId === "complete"}
      targetCompleted={stepId === "completed"} />
  );
};
