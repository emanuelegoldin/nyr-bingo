"use client";

/**
 * Progress view: a step line per player of their completed count, by day or month, with a
 * legend that highlights players.
 * Spec Reference: 23-progress-chart.md - Chart, Colours and Legend
 */

import { Button } from "@/components/ui/button";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bucketProgress, type ProgressGranularity } from "./bucket-progress";
import { ProgressLegend } from "./progress-legend";
import { ProgressTooltip } from "./progress-tooltip";
import { seriesStyle } from "./series-style";
import type { ProgressViewProps } from "./types";

const GRANULARITIES: ProgressGranularity[] = ["day", "month"];

/**
 * Render the line chart, its Day / Month toggle and its legend.
 * @param props The game's progress data
 * @returns The chart view
 */
export function ProgressLineChart({ data }: ProgressViewProps) {
  const t = useTranslations("Games.progress");
  const format = useFormatter();
  const [granularity, setGranularity] = useState<ProgressGranularity>("day");
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(() => bucketProgress(data, granularity), [data, granularity]);
  const anyHighlighted = highlighted.size > 0;

  /** Format the start of a day or month for the axis and the tooltip. */
  const formatBucket = (time: number): string =>
    format.dateTime(new Date(time), granularity === "day"
      ? { month: "short", day: "numeric" }
      : { month: "short", year: "numeric" });

  /** Add or remove a player from the highlighted ones. */
  const toggleHighlight = (userId: string) => {
    setHighlighted((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1" role="group" aria-label={t("granularity")}>
        {GRANULARITIES.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={granularity === option ? "secondary" : "ghost"}
            aria-pressed={granularity === option}
            onClick={() => setGranularity(option)}
          >
            {t(option)}
          </Button>
        ))}
      </div>

      <div className="h-72 w-full" role="img" aria-label={t("chartLabel")}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              tickFormatter={formatBucket}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, "auto"]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
              content={({ active, label }) => (
                <ProgressTooltip
                  active={active}
                  row={rows.find((row) => row.time === label)}
                  players={data.players}
                  formatBucket={formatBucket}
                />
              )}
            />
            {data.players.map((player, index) => {
              const style = seriesStyle(index);
              const isOn = highlighted.has(player.userId);
              return (
                <Line
                  key={player.userId}
                  type="stepAfter"
                  name={player.name}
                  dataKey={(row: (typeof rows)[number]) => row.values[player.userId] ?? 0}
                  stroke={style.color}
                  strokeWidth={isOn ? 3 : 2}
                  strokeOpacity={anyHighlighted && !isOn ? 0.2 : 1}
                  strokeDasharray={style.dashed ? "6 4" : undefined}
                  dot={false}
                  activeDot={anyHighlighted && !isOn ? false : { r: 4 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ProgressLegend players={data.players} highlighted={highlighted} onToggle={toggleHighlight} />
    </div>
  );
}
