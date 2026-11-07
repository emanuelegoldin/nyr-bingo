"use client";

/**
 * The teammate's proof-thread tour: voting, when the thread closes, and where closed threads go.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import type { VoteType } from "@/lib/shared/types";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { GuideStep } from "../engine/intro-adapter";
import { tourSelector } from "../engine/tour-selector";
import { useGuidedTour } from "../engine/use-guided-tour";
import { DemoGameTabs } from "../sandbox/demo-game-tabs";
import { DEMO_THREAD_RESOLUTION, DemoThread, THREAD_TARGETS, useDemoThreadSample } from "../sandbox/demo-thread";
import { DemoVote } from "../sandbox/demo-vote";
import { SandboxLayer } from "../sandbox/sandbox-layer";
import type { GuideTourProps } from "../types";

const THREADS_TAB = "demo-threads-tab";

/** The steps, in order, with the element each one highlights. The user votes to leave the first. */
const STEPS = [
  { id: "vote", target: THREAD_TARGETS.vote, action: true },
  { id: "change", target: THREAD_TARGETS.vote, action: false },
  { id: "closes", target: THREAD_TARGETS.header, action: false },
  { id: "archive", target: THREADS_TAB, action: false },
] as const;

/**
 * Runs the teammate's thread tour on a sample thread. The user's vote counts only after the
 * voting step, so going back to it removes the vote.
 *
 * @param props - The callback run when the tour ends.
 * @returns The demo layer with the thread and the game tabs.
 */
export const VoterThreadTour = ({ onEnd }: GuideTourProps) => {
  const t = useTranslations("Guide");
  const { files, messages } = useDemoThreadSample("ben");
  const [vote, setVote] = useState<VoteType | null>(null);
  const steps = useMemo<GuideStep[]>(
    () => STEPS.map(({ id, target, action }) => ({ text: t(`proofThreadVoter.steps.${id}`), target: tourSelector(target), action })),
    [t]
  );
  const { stepIndex, next } = useGuidedTour({ steps, onEnd });
  const isVoteStep = stepIndex === 0;

  /** Records the demo vote and moves on. */
  const handleVote = (chosen: VoteType) => {
    setVote(chosen);
    next();
  };

  return (
    <SandboxLayer label={t("proofThreadVoter.title")} notice={t("sandbox.notice")} className="max-w-lg">
      <DemoThread
        resolutionTitle={t(`sandbox.cells.${DEMO_THREAD_RESOLUTION}`)}
        isOwner={false}
        files={files}
        messages={messages}
        vote={(
          <DemoVote
            accept={1}
            deny={0}
            myVote={isVoteStep ? null : vote}
            canVote
            onVote={isVoteStep ? handleVote : undefined} />
        )} />
      <DemoGameTabs active="threads" marker={THREADS_TAB} />
    </SandboxLayer>
  );
};
