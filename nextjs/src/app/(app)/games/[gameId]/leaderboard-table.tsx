/**
 * Leaderboard Table — positions 4 and below, under the podium.
 * Spec Reference: 12-team-tabs.md - Leaderboard Tab
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { LeaderboardEntry } from "@/lib/shared/types";
import { rankColorClass } from "./leaderboard-rank";

interface LeaderboardTableProps {
  /** Entries in rank order, starting at `startRank`. */
  entries: LeaderboardEntry[];
  /** Position number of the first row. */
  startRank: number;
  formatDate: (iso: string) => string;
}

/**
 * Render ranked rows with #, Player, Completed and First Bingo columns.
 * @param entries - The rows to show, in rank order.
 * @param startRank - The position number of the first row.
 * @param formatDate - Formats the first-bingo datetime in the active locale.
 * @returns The scrollable table element.
 */
export const LeaderboardTable = ({ entries, startRank, formatDate }: LeaderboardTableProps) => {
  const t = useTranslations("Games.leaderboard");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 w-12">#</th>
            <th className="pb-2 pr-4">{t("player")}</th>
            <th className="pb-2 pr-4 text-center">{t("completed")}</th>
            <th className="pb-2">{t("firstBingo")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const rank = startRank + index;
            return (
              <tr key={entry.userId} className="border-b last:border-0">
                {/* Rank */}
                <td className={`py-3 pr-4 font-bold ${rankColorClass(rank)}`}>
                  {rank}
                </td>

                {/* Player: avatar + name */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${entry.userId}`}>
                      <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarFallback className="text-xs">
                          {(entry.displayName || entry.username)?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <span className="font-medium">
                      {entry.displayName || entry.username}
                    </span>
                  </div>
                </td>

                {/* Completed tasks count */}
                <td className="py-3 pr-4 text-center font-medium">
                  {entry.completedTasks}
                </td>

                {/* First bingo datetime */}
                <td className="py-3 text-muted-foreground">
                  {entry.firstBingoAt ? formatDate(entry.firstBingoAt) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
