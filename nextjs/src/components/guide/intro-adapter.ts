/**
 * Adapter around the Intro.js tour library: the only file that imports it.
 * Spec Reference: 26-guided-tour.md - Module Boundary
 *
 * Intro.js is AGPL-3.0 and needs a paid license for commercial use
 * (see docs/external_deps/nextjs-npm.md). To replace it, rewrite this file
 * behind the same `startTour` signature.
 */

import introJs from "intro.js";
import "intro.js/introjs.css";
import "./guide-theme.css";

/** One step of a tour. */
export interface GuideStep {
  /** Plain text shown in the tooltip. */
  text: string;
  /** Optional heading of the tooltip. */
  title?: string;
  /** Selector of the element to highlight; the tooltip is centred when omitted. */
  target?: string;
}

/** Translated labels of the tour's navigation buttons. */
export interface GuideLabels {
  next: string;
  back: string;
  done: string;
}

/** What `startTour` needs to run a tour. */
export interface StartTourOptions {
  steps: GuideStep[];
  labels: GuideLabels;
  /** Called with the index of each step as it is shown. */
  onStepChange: (stepIndex: number) => void;
  /** Called once when the tour ends: finished, skipped or closed. */
  onEnd: () => void;
}

/** A running tour. */
export interface GuideTourHandle {
  /** Ends the tour without calling `onEnd`. Safe to call more than once. */
  stop: () => void;
}

/**
 * Starts a tour. Every target element must already be in the page.
 *
 * @param options - The steps, labels and callbacks of the tour.
 * @returns A handle to stop the tour.
 */
export const startTour = async ({ steps, labels, onStepChange, onEnd }: StartTourOptions): Promise<GuideTourHandle> => {
  let active = true;
  const tour = introJs.tour().setOptions({
    steps: steps.map((step) => ({
      intro: step.text,
      title: step.title,
      element: step.target ? document.querySelector(step.target) : undefined,
    })),
    nextLabel: labels.next,
    prevLabel: labels.back,
    doneLabel: labels.done,
    tooltipClass: "guide-tooltip",
    tooltipRenderAsHtml: false,
    showBullets: false,
    showProgress: true,
    disableInteraction: true,
    exitOnEsc: true,
    exitOnOverlayClick: true,
  });

  tour.onChange(() => {
    onStepChange(tour.getCurrentStep() ?? 0);
  });
  tour.onExit(() => {
    if (!active) return;
    active = false;
    onEnd();
  });

  await tour.start();

  return {
    stop: () => {
      if (!active) return;
      active = false;
      void tour.exit(true);
    },
  };
};
