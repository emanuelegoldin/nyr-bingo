/**
 * Assemble the progress data of a live or archived game for the Progress tab.
 * Spec Reference: 23-progress-chart.md - Definitions
 */

import type { LeaderboardEntry, ProgressPoint } from "@/lib/shared/types";
import type { ProgressData } from "./types";

/** Inputs shared by the game page and the archived game page. */
export interface ProgressSource {
  leaderboard: LeaderboardEntry[];
  points: ProgressPoint[];
  /** When bingo started, or null when it was not recorded. */
  startedAt: string | null;
  /** When the game ended, or null for a running game (the chart then ends now). */
  endedAt: string | null;
}

/**
 * Build the data the progress views read.
 * @param source The leaderboard, points and dates of the game
 * @param now The current time, used as the end of a running game's chart
 * @returns The progress data, or null when there is no point to show
 */
export function buildProgressData(source: ProgressSource, now: Date): ProgressData | null {
  const players = source.leaderboard.map((entry) => ({
    userId: entry.userId,
    name: entry.displayName ?? entry.username,
  }));
  const playerIds = new Set(players.map((player) => player.userId));
  const points = source.points.filter((point) => playerIds.has(point.userId));

  if (players.length === 0 || points.length === 0) {
    return null;
  }

  // The start falls back to the earliest point when the start time was not recorded
  const start = source.startedAt ?? points[0].recordedAt;
  const end = source.endedAt ?? now.toISOString();

  return { players, points, start, end };
}
