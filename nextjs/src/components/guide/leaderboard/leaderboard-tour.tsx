"use client";

/**
 * The leaderboard tour: where the leaderboard is and what its columns mean, on sample players.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import { LeaderboardPodium } from "@/app/(app)/games/[gameId]/leaderboard-podium";
import { LeaderboardTable } from "@/app/(app)/games/[gameId]/leaderboard-table";
import { Card, CardContent } from "@/components/ui/card";
import type { LeaderboardEntry } from "@/lib/shared/types";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { GuideStep } from "../engine/intro-adapter";
import { tourSelector } from "../engine/tour-selector";
import { useGuidedTour } from "../engine/use-guided-tour";
import { DemoGameTabs } from "../sandbox/demo-game-tabs";
import { SandboxLayer } from "../sandbox/sandbox-layer";
import type { GuideTourProps } from "../types";

const TARGETS = { tab: "demo-leaderboard-tab", podium: "demo-podium", table: "demo-leaderboard-table" } as const;

/** The steps, in order, with the element each one highlights. */
const STEPS = [
  { id: "tab", target: tourSelector(TARGETS.tab) },
  { id: "podium", target: tourSelector(TARGETS.podium) },
  { id: "completed", target: `${tourSelector(TARGETS.table)} th:nth-child(3)` },
  { id: "firstBingo", target: `${tourSelector(TARGETS.table)} th:nth-child(4)` },
] as const;

/** Builds a sample player. */
const player = (name: string, completedTasks: number, firstBingoAt: string | null): LeaderboardEntry => ({
  userId: `demo-${name}`,
  username: name,
  displayName: null,
  firstBingoAt,
  completedTasks,
});

/** Sample leaderboard: three on the podium and two in the table, already ranked. */
const ENTRIES: LeaderboardEntry[] = [
  player("chiara", 5, "2026-03-02T18:30:00Z"),
  player("ben", 6, "2026-03-20T09:15:00Z"),
  player("anna", 4, null),
  player("dario", 3, null),
  player("elena", 1, null),
];

/**
 * Runs the leaderboard tour on a sample leaderboard. No step asks for an action.
 *
 * @param props - The callback run when the tour ends.
 * @returns The demo layer with the game tabs and the leaderboard.
 */
export const LeaderboardTour = ({ onEnd }: GuideTourProps) => {
  const t = useTranslations("Guide");
  const format = useFormatter();
  const steps = useMemo<GuideStep[]>(
    () => STEPS.map(({ id, target }) => ({ text: t(`leaderboard.steps.${id}`), target })),
    [t]
  );
  useGuidedTour({ steps, onEnd });

  /** Formats the first-bingo datetime like the real leaderboard. */
  const formatDate = (iso: string): string =>
    format.dateTime(new Date(iso), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <SandboxLayer label={t("leaderboard.title")} notice={t("sandbox.notice")} className="max-w-2xl">
      <DemoGameTabs active="leaderboard" marker={TARGETS.tab} />
      <Card>
        <CardContent className="flex flex-col gap-6 p-4 sm:p-6">
          <div data-tour={TARGETS.podium}>
            <LeaderboardPodium entries={ENTRIES.slice(0, 3)} formatDate={formatDate} />
          </div>
          <div data-tour={TARGETS.table}>
            <LeaderboardTable entries={ENTRIES.slice(3)} startRank={4} formatDate={formatDate} />
          </div>
        </CardContent>
      </Card>
    </SandboxLayer>
  );
};
