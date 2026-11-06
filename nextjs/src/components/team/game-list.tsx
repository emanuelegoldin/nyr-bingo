/**
 * Grid of running games; each card links to its game page.
 * Spec Reference: 16-games.md - Game Page
 */

import { GameStatusBadge } from "@/components/team/game-status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GameStatus } from "@/lib/shared/types";
import { Swords } from "lucide-react";
import Link from "next/link";

/** The game fields this list needs. */
export interface GameListItem {
  id: string;
  name: string;
  teamName: string;
  status: GameStatus;
}

interface GameListProps {
  games: GameListItem[];
  /** Whether each entry names its team; off where the team is already clear. */
  showTeamName?: boolean;
}

/**
 * Shows one card per game. The whole card is a link to the game page.
 *
 * @param props - The games, and whether to show their team's name.
 * @returns The grid of games.
 */
export function GameList({ games, showTeamName = false }: GameListProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {games.map((game) => (
        <Link
          key={game.id}
          href={`/games/${game.id}`}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="h-full transition-colors hover:border-primary hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                {game.name}
              </CardTitle>
              {showTeamName && <CardDescription>{game.teamName}</CardDescription>}
              <div className="mt-2">
                <GameStatusBadge status={game.status} />
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
