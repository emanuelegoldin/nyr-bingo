/**
 * Colour and dash of each player's series in the progress views.
 * Spec Reference: 23-progress-chart.md - Colours and Legend
 *
 * The colours are the `--progress-series-N` tokens of globals.css, validated for light and dark.
 */

/** Number of colours in the categorical palette. */
export const SERIES_COLOR_COUNT = 8;

/** How one player's series is drawn. */
export interface SeriesStyle {
  /** CSS colour value of the series. */
  color: string;
  /** True from the ninth player on, whose colours repeat. */
  dashed: boolean;
}

/**
 * Get the style of a player's series from their leaderboard position.
 * @param index The player's 0-based position in leaderboard order
 * @returns The colour and dash of the series
 */
export function seriesStyle(index: number): SeriesStyle {
  return {
    color: `var(--progress-series-${(index % SERIES_COLOR_COUNT) + 1})`,
    dashed: index >= SERIES_COLOR_COUNT,
  };
}
