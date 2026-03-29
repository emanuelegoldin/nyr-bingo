/**
 * Leaderboard Tab — Team Detail Page
 * Spec Reference: 12-team-tabs.md
 *
 * Displays a ranked table of team members ordered by the datetime they
 * first scored a bingo (complete row / column / diagonal).
 *
 * Ranking rules:
 * - Users who scored a bingo appear first, ordered by earliest bingo time.
 * - Ties (same bingo time or both null) are broken by completed tasks (desc).
 * - Final tiebreaker is alphabetical by username.
 * - Position numbers: 1 = gold, 2 = silver, 3 = bronze.
 * - The "First Bingo" column is blank until the user scores one.
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────

/** Matches the shape returned by GET /api/teams/[teamId]/leaderboard */
export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  firstBingoAt: string | null;
  completedTasks: number;
}

interface LeaderboardTabProps {
  initialEntries: LeaderboardEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────

/** Map a 1-indexed rank to a color class for the position badge. */
function rankColorClass(rank: number): string {
  switch (rank) {
    case 1:
      return "text-yellow-500 dark:text-yellow-400"; // gold
    case 2:
      return "text-gray-400 dark:text-gray-300"; // silver
    case 3:
      return "text-amber-700 dark:text-amber-500"; // bronze
    default:
      return "text-muted-foreground";
  }
}

/** Format an ISO date string in a human-friendly way. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Component ─────────────────────────────────────────────────────

export function LeaderboardTab({ initialEntries }: LeaderboardTabProps) {
  const entries = initialEntries;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No leaderboard data available yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 w-12">#</th>
                  <th className="pb-2 pr-4">Player</th>
                  <th className="pb-2 pr-4 text-center">Completed</th>
                  <th className="pb-2">First Bingo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const rank = index + 1;
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
        )}
      </CardContent>
    </Card>
  );
}
