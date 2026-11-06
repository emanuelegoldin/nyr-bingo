/**
 * Leaderboard Podium — positions 1–3 as cards in a triangle (1 on top, 2 and 3 below).
 * Spec Reference: 12-team-tabs.md - Leaderboard Tab
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { LeaderboardEntry } from "@/lib/shared/types";
import { rankBorderClass, rankColorClass } from "./leaderboard-rank";
import { TrophyIcon } from "./trophy-icon";

interface PodiumCardProps {
  entry: LeaderboardEntry;
  rank: number;
  formatDate: (iso: string) => string;
}

/**
 * One podium card: rank, clickable avatar, name, completed count and first bingo.
 * @param entry - The player's leaderboard row.
 * @param rank - The player's position (1–3).
 * @param formatDate - Formats the first-bingo datetime in the active locale.
 * @returns The card element.
 */
const PodiumCard = ({ entry, rank, formatDate }: PodiumCardProps) => {
  const t = useTranslations("Games.leaderboard");
  const name = entry.displayName || entry.username;
  const isFirst = rank === 1;

  return (
    <Card className={cn("border-2 h-full", rankBorderClass(rank))}>
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        {isFirst && <TrophyIcon className={cn("h-10 w-10", rankColorClass(1))} />}
        <span className={cn("text-xl font-bold", rankColorClass(rank))}>{rank}</span>
        <Link href={`/profile/${entry.userId}`}>
          <Avatar
            className={cn(
              "cursor-pointer hover:opacity-80 transition-opacity",
              isFirst ? "h-16 w-16" : "h-12 w-12"
            )}
          >
            <AvatarFallback>{name?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
        </Link>
        <span className="font-medium break-all">{name}</span>
        <dl className="w-full text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t("completed")}</dt>
            <dd className="font-medium">{entry.completedTasks}</dd>
          </div>
          <div className="flex flex-col items-center mt-1">
            <dt className="text-muted-foreground">{t("firstBingo")}</dt>
            <dd>{entry.firstBingoAt ? formatDate(entry.firstBingoAt) : "—"}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
};

interface LeaderboardPodiumProps {
  /** The first (up to) three leaderboard entries, already sorted. */
  entries: LeaderboardEntry[];
  formatDate: (iso: string) => string;
}

/**
 * Render positions 1–3: first centred on top, second and third side by side below.
 * @param entries - The top entries in rank order (at most three are shown).
 * @param formatDate - Formats the first-bingo datetime in the active locale.
 * @returns The podium element, or null when there are no entries.
 */
export const LeaderboardPodium = ({ entries, formatDate }: LeaderboardPodiumProps) => {
  const [first, second, third] = entries;
  if (!first) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-xs">
        <PodiumCard entry={first} rank={1} formatDate={formatDate} />
      </div>
      {second && (
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <PodiumCard entry={second} rank={2} formatDate={formatDate} />
          {third && <PodiumCard entry={third} rank={3} formatDate={formatDate} />}
        </div>
      )}
    </div>
  );
};
