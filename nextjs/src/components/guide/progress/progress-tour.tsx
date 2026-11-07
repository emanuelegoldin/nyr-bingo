"use client";

/**
 * The progress tour: where the progress chart is, its Day / Month toggle and its legend, on sample players.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import { ProgressLineChart } from "@/components/progress/progress-line-chart";
import type { ProgressData } from "@/components/progress/types";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { type MouseEvent, useMemo } from "react";
import type { GuideStep } from "../engine/intro-adapter";
import { tourSelector } from "../engine/tour-selector";
import { useGuidedTour } from "../engine/use-guided-tour";
import { DemoGameTabs } from "../sandbox/demo-game-tabs";
import { SandboxLayer } from "../sandbox/sandbox-layer";
import type { GuideTourProps } from "../types";

const TARGETS = { tab: "demo-progress-tab", chart: "demo-progress" } as const;
const CHART = tourSelector(TARGETS.chart);

/**
 * The steps, in order. The chart's parts are found by their roles, since the chart is the real one.
 * On action steps the user goes on by clicking inside the highlighted element.
 */
const STEPS = [
  { id: "tab", target: tourSelector(TARGETS.tab) },
  { id: "chart", target: `${CHART} [role="img"]` },
  { id: "granularity", target: `${CHART} [role="group"]`, action: true },
  { id: "legend", target: `${CHART} ul`, action: true },
  { id: "highlighted", target: `${CHART} [role="img"]` },
] as const;

/** Builds the sample points of a player from [ISO date, completed count] pairs. */
const pointsOf = (userId: string, values: [string, number][]) =>
  values.map(([date, completedTasks]) => ({ userId, recordedAt: `${date}T12:00:00Z`, completedTasks }));

/** Sample progress of four players over five months. */
const DATA: ProgressData = {
  players: ["chiara", "ben", "anna", "dario"].map((name) => ({ userId: `demo-${name}`, name })),
  points: [
    ...pointsOf("demo-chiara", [["2026-01-10", 1], ["2026-02-03", 2], ["2026-02-20", 3], ["2026-03-02", 4], ["2026-04-18", 5]]),
    ...pointsOf("demo-ben", [["2026-01-25", 1], ["2026-02-14", 3], ["2026-03-20", 4], ["2026-04-02", 5], ["2026-05-11", 6]]),
    ...pointsOf("demo-anna", [["2026-02-08", 1], ["2026-03-15", 2], ["2026-04-25", 4]]),
    ...pointsOf("demo-dario", [["2026-01-18", 1], ["2026-03-28", 2], ["2026-05-05", 3]]),
  ].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
  start: "2026-01-01T00:00:00Z",
  end: "2026-05-31T23:00:00Z",
};

/**
 * Runs the progress tour on the real chart fed with sample data. The chart keeps its own toggle
 * and highlight state, which is dropped with it when the tour ends.
 *
 * @param props - The callback run when the tour ends.
 * @returns The demo layer with the game tabs and the chart.
 */
export const ProgressTour = ({ onEnd }: GuideTourProps) => {
  const t = useTranslations("Guide");
  const steps = useMemo<GuideStep[]>(
    () => STEPS.map((step) => ({ text: t(`progress.steps.${step.id}`), target: step.target, action: "action" in step })),
    [t]
  );
  const { stepIndex, next } = useGuidedTour({ steps, onEnd });

  /** Goes on when the user clicks inside the element an action step highlights. */
  const handleClick = (event: MouseEvent) => {
    const step = STEPS[stepIndex];
    if ("action" in step && event.target instanceof Element && event.target.closest(step.target)) next();
  };

  return (
    <SandboxLayer label={t("progress.title")} notice={t("sandbox.notice")} className="max-w-2xl">
      <DemoGameTabs active="progress" marker={TARGETS.tab} />
      <Card data-tour={TARGETS.chart} onClickCapture={handleClick}>
        <CardContent className="p-4 sm:p-6">
          <ProgressLineChart data={DATA} />
        </CardContent>
      </Card>
    </SandboxLayer>
  );
};
