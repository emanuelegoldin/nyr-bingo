"use client";

/**
 * The request-proof tour: ask proof for a teammate's completed cell, on demo cards.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { GuideStep } from "../engine/intro-adapter";
import { tourSelector } from "../engine/tour-selector";
import { useGuidedTour } from "../engine/use-guided-tour";
import { THREAD_TARGETS } from "../sandbox/demo-thread";
import { SandboxLayer } from "../sandbox/sandbox-layer";
import type { GuideTourProps } from "../types";
import { DemoProofCards, PROOF_TARGETS } from "./demo-proof-cards";

/** The steps, in order: the element each highlights, whether it waits for a click, and what the demo shows. */
const STEPS = [
  { id: "cards", target: PROOF_TARGETS.cards, action: false, stage: "cards" },
  { id: "cell", target: PROOF_TARGETS.cell, action: true, stage: "cards" },
  { id: "request", target: PROOF_TARGETS.request, action: true, stage: "request" },
  { id: "thread", target: THREAD_TARGETS.panel, action: false, stage: "thread" },
  { id: "review", target: PROOF_TARGETS.cell, action: false, stage: "review" },
] as const;

/**
 * Runs the request-proof tour. The user opens the teammate's completed cell and confirms the
 * request; the demo then shows the new thread and the cell's hourglass. The demo state follows
 * the current step, so going back undoes it.
 *
 * @param props - The callback run when the tour ends.
 * @returns The demo layer with both cards.
 */
export const RequestProofTour = ({ onEnd }: GuideTourProps) => {
  const t = useTranslations("Guide");
  const steps = useMemo<GuideStep[]>(
    () => STEPS.map(({ id, target, action }) => ({ text: t(`requestProof.steps.${id}`), target: tourSelector(target), action })),
    [t]
  );
  const { stepIndex, next } = useGuidedTour({ steps, onEnd });
  const step = STEPS[stepIndex] ?? STEPS[0];

  return (
    <SandboxLayer label={t("requestProof.title")} notice={t("sandbox.notice")} className="max-w-5xl">
      <DemoProofCards
        stage={step.stage}
        onOpenCell={step.id === "cell" ? next : undefined}
        onRequest={step.id === "request" ? next : undefined} />
    </SandboxLayer>
  );
};
