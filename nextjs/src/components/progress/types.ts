/**
 * Shared contract of the Progress tab: the data every progress view reads, and the shape of a view.
 * Spec Reference: 23-progress-chart.md - Progress Tab
 *
 * A new progress view is one component that takes `ProgressViewProps`, plus one entry in
 * `PROGRESS_VIEWS` (views.ts). Pages and loaders do not change.
 */

import type { ComponentType } from "react";
import type { Messages } from "@/i18n/messages";
import type { ProgressPoint } from "@/lib/shared/types";

/** A player shown in the progress views, in leaderboard order. */
export interface ProgressPlayer {
  userId: string;
  /** Display name if public, otherwise username (spec 12). */
  name: string;
}

/** Everything a progress view needs, the same for a live and an archived game. */
export interface ProgressData {
  /** Players in leaderboard order, which also fixes their colours. */
  players: ProgressPlayer[];
  /** Stored progress points, oldest first. */
  points: ProgressPoint[];
  /** Start of the chart, as an ISO datetime. */
  start: string;
  /** End of the chart, as an ISO datetime: now for a running game, the end date for an archived one. */
  end: string;
}

/** Props every progress view receives. */
export interface ProgressViewProps {
  data: ProgressData;
}

/** Keys of the view labels under `Games.progress.views`. */
export type ProgressViewLabelKey = keyof Messages["Games"]["progress"]["views"];

/** One progress view the Progress tab can show. */
export interface ProgressView {
  /** Stable identifier, used as the key of the view picker. */
  id: string;
  /** Key of the view's label under `Games.progress.views`. */
  labelKey: ProgressViewLabelKey;
  Component: ComponentType<ProgressViewProps>;
}
