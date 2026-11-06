/**
 * The progress views the Progress tab offers, in order. Add a view here to make it available.
 * Spec Reference: 23-progress-chart.md - Progress Tab
 */

import { ProgressLineChart } from "./progress-line-chart";
import type { ProgressView } from "./types";

export const PROGRESS_VIEWS: ProgressView[] = [
  { id: "completed-over-time", labelKey: "completedOverTime", Component: ProgressLineChart },
];
