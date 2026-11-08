"use client";

/**
 * The owner's proof-thread tour: the thread seen by the card owner, with no action asked.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { GuideStep } from "../engine/intro-adapter";
import { tourSelector } from "../engine/tour-selector";
import { useGuidedTour } from "../engine/use-guided-tour";
import { DEMO_THREAD_RESOLUTION, DemoThread, THREAD_TARGETS, useDemoThreadSample } from "../sandbox/demo-thread";
import { DemoVote } from "../sandbox/demo-vote";
import { SandboxLayer } from "../sandbox/sandbox-layer";
import type { GuideTourProps } from "../types";

/** The steps, in order, with the element each one highlights; the overview has none. */
const STEPS = [
  { id: "overview", target: undefined },
  { id: "header", target: THREAD_TARGETS.header },
  { id: "files", target: THREAD_TARGETS.files },
  { id: "messages", target: THREAD_TARGETS.messages },
] as const;

/**
 * Runs the owner's thread tour on a sample thread under way.
 *
 * @param props - The callback run when the tour ends.
 * @returns The demo layer with the thread.
 */
export const OwnerThreadTour = ({ onEnd }: GuideTourProps) => {
  const t = useTranslations("Guide");
  const { files, messages } = useDemoThreadSample(t("sandbox.you"));
  const steps = useMemo<GuideStep[]>(
    () => STEPS.map(({ id, target }) => ({
      text: t(`proofThreadOwner.steps.${id}`),
      target: target ? tourSelector(target) : undefined,
    })),
    [t]
  );
  useGuidedTour({ steps, onEnd });

  return (
    <SandboxLayer label={t("proofThreadOwner.title")} notice={t("sandbox.notice")} className="max-w-lg">
      <DemoThread
        resolutionTitle={t(`sandbox.cells.${DEMO_THREAD_RESOLUTION}`)}
        isOwner
        files={files}
        messages={messages}
        vote={<DemoVote accept={1} deny={0} myVote={null} canVote={false} />} />
    </SandboxLayer>
  );
};
