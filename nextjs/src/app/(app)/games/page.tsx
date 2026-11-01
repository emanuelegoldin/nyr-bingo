"use client";

/**
 * Games Page - the caller's running games across their teams
 * Spec Reference: 16-games.md - Game Page
 */

import { PageSpinner } from "@/components/page-spinner";
import { GameList, type GameListItem } from "@/components/team/game-list";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function GamesPage() {
  usePageTitle("Games");

  const { toast } = useToast();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadGames = async () => {
      const result = await apiFetch<{ games?: GameListItem[] }>("/api/games");
      if (result.ok) {
        setGames(result.data.games || []);
      } else if (result.status === 0) {
        // No usable response (network failure or non-JSON body)
        toast({
          title: "Error",
          description: "Failed to load games",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    };

    loadGames();
  }, [toast]);

  if (isLoading) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">My Games</h1>

      {games.length > 0 ? (
        <GameList games={games} showTeamName />
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-semibold font-headline">No Games Yet</h3>
          <p className="text-muted-foreground mt-2 mb-4">
            A team leader creates games from the team page.
          </p>
          <Button asChild>
            <Link href="/teams">Go to Teams</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
