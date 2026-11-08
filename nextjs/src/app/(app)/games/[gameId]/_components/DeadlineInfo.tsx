"use client";

/**
 * The game header's deadline information: the preparation countdown and the last day, styled by how close they are.
 * Spec Reference: 16-games.md - Countdown, Game Page
 */

import { CalendarClock, Hourglass } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  getCountdownParts,
  getLastDayUrgency,
  getPreparationUrgency,
  type DeadlineUrgency,
} from "@/lib/shared/deadline";
import { GameStatus } from "@/lib/shared/types";

const TICK_MS = 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Text classes for each urgency: normal, then bold warning, then bold destructive. */
const URGENCY_CLASSES: Record<DeadlineUrgency, string> = {
  normal: "text-muted-foreground",
  warning: "font-semibold text-warning",
  critical: "font-semibold text-destructive",
};

interface DeadlineInfoProps {
  status: GameStatus;
  /** End of the preparation phase, ISO 8601 in UTC; null for games started before it existed. */
  preparationDeadline: string | null;
  /** Last playable day as YYYY-MM-DD, or null without one. */
  deadline: string | null;
}

/**
 * Today's date in the viewer's time zone.
 * @param now The current time
 * @returns YYYY-MM-DD
 */
const localIsoDate = (now: Date): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/**
 * The current time, updated every second while `ticking` is true. Null until mounted, so the server render and the
 * first client render agree.
 * @param ticking Whether to keep updating
 * @returns The current time, or null before mount
 */
const useNow = (ticking: boolean): Date | null => {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    if (!ticking) return;
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
};

/**
 * Show the countdown during preparation and the last day if the game has one.
 */
export function DeadlineInfo({ status, preparationDeadline, deadline }: DeadlineInfoProps) {
  const t = useTranslations("Games.detail");
  const format = useFormatter();
  const inPreparation = status === GameStatus.FORMING && preparationDeadline !== null;
  const now = useNow(inPreparation);

  if (!now) return null;

  const renderCountdown = (): ReactNode => {
    const parts = getCountdownParts(Date.parse(preparationDeadline as string), now.getTime());
    const urgency = getPreparationUrgency(parts.remainingMs);
    const values = { days: parts.days, hours: parts.hours, minutes: parts.minutes, seconds: parts.seconds };
    let time: string;
    if (parts.remainingMs === 0) {
      time = "";
    } else if (parts.days > 0) {
      time = t("deadline.days", values);
    } else if (parts.remainingMs > HOUR_MS) {
      time = t("deadline.hours", values);
    } else {
      time = t("deadline.lastHour", values);
    }

    return (
      <p className={cn("flex items-center gap-2 mt-2 text-sm", URGENCY_CLASSES[urgency])} role="timer">
        <Hourglass className="h-4 w-4" aria-hidden="true" />
        {parts.remainingMs === 0 ? t("deadline.starting") : t("deadline.startsIn", { time })}
      </p>
    );
  };

  const renderLastDay = (lastDay: string): ReactNode => {
    const [year, month, day] = lastDay.split("-").map(Number);
    const date = format.dateTime(new Date(year, month - 1, day), { dateStyle: "medium" });
    // The last day only turns urgent once the game is being played
    const urgency = status === GameStatus.STARTED ? getLastDayUrgency(lastDay, localIsoDate(now)) : "normal";

    return (
      <p className={cn("flex items-center gap-2 mt-2 text-sm", URGENCY_CLASSES[urgency])}>
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        {t("lastDay", { date })}
      </p>
    );
  };

  return (
    <>
      {inPreparation && renderCountdown()}
      {deadline && renderLastDay(deadline)}
    </>
  );
}
