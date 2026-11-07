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
  /**
   * Whether the user continues by using the highlighted element instead of Next: the
   * element can be clicked, the Next button is hidden, and the page calls `next()`.
   */
  action?: boolean;
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
  /** Moves to the next step, for example when the user has done what an action step asks. */
  next: () => void;
  /** Ends the tour without calling `onEnd`. Safe to call more than once. */
  stop: () => void;
}

/** Class set on the root element while an action step is shown, so its clicks reach the page. */
const ACTION_STEP_CLASS = "guide-action-step";

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
      disableInteraction: !step.action,
      tooltipClass: step.action ? "guide-tooltip guide-tooltip-action" : "guide-tooltip",
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

  const setActionStep = (isActionStep: boolean) => {
    document.documentElement.classList.toggle(ACTION_STEP_CLASS, isActionStep);
  };

  tour.onChange(() => {
    const stepIndex = tour.getCurrentStep() ?? 0;
    setActionStep(steps[stepIndex]?.action === true);
    onStepChange(stepIndex);
  });
  tour.onExit(() => {
    setActionStep(false);
    if (!active) return;
    active = false;
    onEnd();
  });

  await tour.start();

  return {
    next: () => {
      if (active) void tour.nextStep();
    },
    stop: () => {
      setActionStep(false);
      if (!active) return;
      active = false;
      void tour.exit(true);
    },
  };
};
