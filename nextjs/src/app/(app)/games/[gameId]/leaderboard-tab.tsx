/**
 * Leaderboard Tab — Game Page
 * Spec Reference: 12-team-tabs.md
 *
 * Shows team members ranked by the datetime they first scored a bingo
 * (complete row / column / diagonal): positions 1–3 on a podium of cards,
 * positions 4 and below in a table.
 *
 * Ranking rules (applied by the repository, not here):
 * - Users who scored a bingo appear first, ordered by earliest bingo time.
 * - Ties (same bingo time or both null) are broken by completed tasks (desc).
 * - Final tiebreaker is alphabetical by username.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatter, useTranslations } from "next-intl";
import type { LeaderboardEntry } from "@/lib/shared/types";
import { LeaderboardPodium } from "./leaderboard-podium";
import { LeaderboardTable } from "./leaderboard-table";

/** Number of positions shown on the podium. */
const PODIUM_SIZE = 3;

interface LeaderboardTabProps {
  initialEntries: LeaderboardEntry[];
}

export function LeaderboardTab({ initialEntries }: LeaderboardTabProps) {
  const t = useTranslations("Games.leaderboard");
  const format = useFormatter();
  const entries = initialEntries;

  /** Format an ISO date string in a human-friendly way, in the active locale. */
  const formatDate = (iso: string): string =>
    format.dateTime(new Date(iso), {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {t("empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <LeaderboardPodium
              entries={entries.slice(0, PODIUM_SIZE)}
              formatDate={formatDate}
            />
            {entries.length > PODIUM_SIZE && (
              <LeaderboardTable
                entries={entries.slice(PODIUM_SIZE)}
                startRank={PODIUM_SIZE + 1}
                formatDate={formatDate}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
