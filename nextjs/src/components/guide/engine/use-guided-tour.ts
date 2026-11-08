"use client";

/**
 * Hook that runs any tour with the tour library and reports its current step.
 * Spec Reference: 26-guided-tour.md - Module Boundary
 */

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { GuideStep, GuideTourHandle } from "./intro-adapter";

interface UseGuidedTourOptions {
  /** The steps, in order. Keep the array stable (for example with `useMemo`): a new one restarts the tour. */
  steps: GuideStep[];
  /** Called when the tour ends: finished, skipped or closed. */
  onEnd: () => void;
}

/** The running tour, as seen by the component that shows it. */
export interface GuidedTour {
  /** Index of the step shown now. */
  stepIndex: number;
  /** Moves to the next step, for example when the user has done what an action step asks. */
  next: () => void;
}

/**
 * Starts a tour when the calling component mounts and stops it when it unmounts. The tour
 * library is loaded only then. Every target element must be rendered on mount.
 *
 * @param options - The steps and the callback run when the tour ends.
 * @returns The current step index and a way to move to the next step.
 */
export const useGuidedTour = ({ steps, onEnd }: UseGuidedTourOptions): GuidedTour => {
  const t = useTranslations("Guide");
  const [stepIndex, setStepIndex] = useState(0);
  const handleRef = useRef<GuideTourHandle | null>(null);
  // The running tour calls the latest callback without being restarted when it changes
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    let cancelled = false;

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
      handleRef.current = started;
    });

    return () => {
      cancelled = true;
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, [steps, t]);

  return { stepIndex, next: () => handleRef.current?.next() };
};
