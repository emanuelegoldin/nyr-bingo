/**
 * Clickable tag naming the game a dashboard card belongs to; it opens the game page.
 * Spec Reference: 14-dashboard-and-navigation.md - Dashboard
 */

import { Badge } from "@/components/ui/badge";
import { ChevronRight, Swords } from "lucide-react";
import Link from "next/link";

interface GameTagProps {
  gameId: string;
  gameName: string;
  /** Accessible name and tooltip of the link, translated by the caller. */
  label: string;
}

/**
 * Renders the game name as a tag that links to the game page.
 *
 * @param props - The game's id and name, and the link's accessible label.
 * @returns The tag link.
 */
export function GameTag({ gameId, gameName, label }: GameTagProps) {
  return (
    <Link
      href={`/games/${gameId}`}
      aria-label={label}
      title={label}
      className="inline-flex max-w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Badge
        variant="secondary"
        className="max-w-full gap-1.5 border-primary/30 px-3 py-1 text-sm hover:border-primary hover:bg-secondary/60"
      >
        <Swords className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{gameName}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      </Badge>
    </Link>
  );
}
