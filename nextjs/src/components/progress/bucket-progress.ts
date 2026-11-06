/**
 * Turn progress points into one row per calendar day or month, in the viewer's time zone.
 * Spec Reference: 23-progress-chart.md - Chart
 */

import type { ProgressData } from "./types";

/** Step of the chart's time axis. */
export type ProgressGranularity = "day" | "month";

/** One day or month of the chart: its start time and each player's value, keyed by user id. */
export interface ProgressRow {
  /** Local start of the day or month, in milliseconds since the epoch. */
  time: number;
  values: Record<string, number>;
}

/**
 * Get the local start of the day or month that contains a time.
 * @param time A time in milliseconds
 * @param granularity Day or month
 * @returns The local start of its day or month, in milliseconds
 */
function bucketStart(time: number, granularity: ProgressGranularity): number {
  const date = new Date(time);
  return granularity === "day"
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    : new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

/**
 * Get the local start of the next day or month.
 * @param start The local start of a day or month, in milliseconds
 * @param granularity Day or month
 * @returns The local start of the following one, in milliseconds
 */
function nextBucket(start: number, granularity: ProgressGranularity): number {
  const date = new Date(start);
  return granularity === "day"
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
    : new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
}

/**
 * Bucket the progress points of a game. Each row holds each player's count at the end of the
 * day or month, or at the end of the chart for the last one. A day or month without a point
 * carries the value from before it, and a player has 0 before their first point.
 * @param data The game's progress data, with points oldest first
 * @param granularity Day or month
 * @returns One row per day or month from the start to the end of the chart
 */
export function bucketProgress(data: ProgressData, granularity: ProgressGranularity): ProgressRow[] {
  const startTime = new Date(data.start).getTime();
  const endTime = Math.max(new Date(data.end).getTime(), startTime);
  const points = data.points
    .map((point) => ({ ...point, time: new Date(point.recordedAt).getTime() }))
    .sort((a, b) => a.time - b.time);

  const current: Record<string, number> = Object.fromEntries(
    data.players.map((player) => [player.userId, 0])
  );
  const rows: ProgressRow[] = [];
  let nextPoint = 0;

  for (let bucket = bucketStart(startTime, granularity); bucket <= endTime; bucket = nextBucket(bucket, granularity)) {
    // Points before the end of this bucket (or of the chart) set the value it shows
    const cutoff = Math.min(nextBucket(bucket, granularity), endTime + 1);
    while (nextPoint < points.length && points[nextPoint].time < cutoff) {
      current[points[nextPoint].userId] = points[nextPoint].completedTasks;
      nextPoint += 1;
    }
    rows.push({ time: bucket, values: { ...current } });
  }

  return rows;
}
