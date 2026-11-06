/**
 * Legend under the progress chart: each player's colour and name, clickable to highlight them.
 * Spec Reference: 23-progress-chart.md - Colours and Legend
 */

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { seriesStyle } from "./series-style";
import type { ProgressPlayer } from "./types";

interface ProgressLegendProps {
  players: ProgressPlayer[];
  /** User ids of the highlighted players. */
  highlighted: ReadonlySet<string>;
  /** Called with a player's id when their name is clicked. */
  onToggle: (userId: string) => void;
}

/**
 * Render the legend as a wrapping row of toggle buttons.
 * @param props The players, the highlighted ones and the toggle handler
 * @returns The legend
 */
export function ProgressLegend({ players, highlighted, onToggle }: ProgressLegendProps) {
  const t = useTranslations("Games.progress");
  const anyHighlighted = highlighted.size > 0;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">{t("legendHint")}</p>
      <ul className="flex flex-wrap gap-2">
        {players.map((player, index) => {
          const style = seriesStyle(index);
          const isOn = highlighted.has(player.userId);
          return (
            <li key={player.userId}>
              <button
                type="button"
                aria-pressed={isOn}
                onClick={() => onToggle(player.userId)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-opacity",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isOn ? "border-foreground font-medium" : "border-border",
                  anyHighlighted && !isOn && "opacity-50"
                )}
              >
                <svg width="16" height="8" aria-hidden="true" className="shrink-0">
                  <line
                    x1="1"
                    y1="4"
                    x2="15"
                    y2="4"
                    stroke={style.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={style.dashed ? "3 3" : undefined}
                  />
                </svg>
                <span className="truncate max-w-[12rem]">{player.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
