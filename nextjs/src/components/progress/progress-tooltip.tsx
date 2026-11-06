/**
 * Tooltip of the progress chart: the day or month and each player's value, highest first.
 * Spec Reference: 23-progress-chart.md - Chart
 */

import type { ProgressRow } from "./bucket-progress";
import { seriesStyle } from "./series-style";
import type { ProgressPlayer } from "./types";

interface ProgressTooltipProps {
  active?: boolean;
  /** The hovered day or month, if any. */
  row: ProgressRow | undefined;
  players: ProgressPlayer[];
  formatBucket: (time: number) => string;
}

/**
 * Render the tooltip box for the hovered day or month.
 * @param props Whether it shows, the hovered row, the players and the date formatter
 * @returns The tooltip, or null when nothing is hovered
 */
export function ProgressTooltip({ active, row, players, formatBucket }: ProgressTooltipProps) {
  if (!active || !row) {
    return null;
  }

  const lines = players
    .map((player, index) => ({ player, style: seriesStyle(index), value: row.values[player.userId] ?? 0 }))
    .sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name));

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{formatBucket(row.time)}</p>
      <ul className="space-y-0.5">
        {lines.map(({ player, style, value }) => (
          <li key={player.userId} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: style.color }}
            />
            <span className="truncate max-w-[10rem]">{player.name}</span>
            <span className="ml-auto pl-3 tabular-nums">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
