"use client";

/**
 * Progress tab of the game page and the archived game page.
 * Spec Reference: 23-progress-chart.md - Progress Tab
 *
 * Builds the progress data once and renders the views of PROGRESS_VIEWS. A view picker
 * appears only when there is more than one view.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { buildProgressData, type ProgressSource } from "./build-progress-data";
import { PROGRESS_VIEWS } from "./views";

interface ProgressTabProps extends ProgressSource {
  /** False while the game is forming: there is no progress to show yet. */
  started: boolean;
}

/**
 * Render the Progress tab.
 * @param props The game's leaderboard, progress points, dates and whether it has started
 * @returns The tab content
 */
export function ProgressTab({ started, leaderboard, points, startedAt, endedAt }: ProgressTabProps) {
  const t = useTranslations("Games.progress");
  const [selectedViewId, setSelectedViewId] = useState(PROGRESS_VIEWS[0].id);
  // Days and months follow the viewer's time zone, so the chart is only drawn in the browser
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, [leaderboard, points]);

  const data = useMemo(
    () => (now ? buildProgressData({ leaderboard, points, startedAt, endedAt }, now) : null),
    [leaderboard, points, startedAt, endedAt, now]
  );
  const view = PROGRESS_VIEWS.find((candidate) => candidate.id === selectedViewId) ?? PROGRESS_VIEWS[0];

  /** Pick the placeholder text, or null when the chart can be shown. */
  const placeholder = !started ? t("notStarted") : now && !data ? t("empty") : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {placeholder ? (
          <p className="text-muted-foreground text-center py-4">{placeholder}</p>
        ) : (
          <>
            {PROGRESS_VIEWS.length > 1 && (
              <div className="flex flex-wrap gap-1" role="group" aria-label={t("viewPicker")}>
                {PROGRESS_VIEWS.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={option.id === view.id ? "secondary" : "ghost"}
                    aria-pressed={option.id === view.id}
                    onClick={() => setSelectedViewId(option.id)}
                  >
                    {t(`views.${option.labelKey}`)}
                  </Button>
                ))}
              </div>
            )}
            {data && <view.Component data={data} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
