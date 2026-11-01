"use client";

/**
 * Archive Page - the finished games the caller took part in
 * Spec Reference: 18-game-archive.md - Archive Page
 */

import { formatArchiveDate } from "@/components/archive/format-archive-date";
import { PageSpinner } from "@/components/page-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import type { ArchivedGameSummary } from "@/lib/shared/types";
import { Archive } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ArchivePage() {
  usePageTitle("Archive");

  const { toast } = useToast();
  const [archivedGames, setArchivedGames] = useState<ArchivedGameSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadArchivedGames = async () => {
      const result = await apiFetch<{ archivedGames?: ArchivedGameSummary[] }>("/api/archived-games");
      if (result.ok) {
        setArchivedGames(result.data.archivedGames || []);
      } else if (result.status === 0) {
        // No usable response (network failure or non-JSON body)
        toast({
          title: "Error",
          description: "Failed to load archived games",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    };

    loadArchivedGames();
  }, [toast]);

  if (isLoading) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">Archived Games</h1>

      {archivedGames.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {archivedGames.map((archivedGame) => (
            <Card key={archivedGame.id} className="flex flex-col">
              <CardHeader className="flex-grow">
                <CardTitle className="font-headline flex items-center gap-2">
                  <Archive className="h-5 w-5 text-primary" />
                  {archivedGame.name}
                </CardTitle>
                <CardDescription>
                  {archivedGame.teamName} · Ended {formatArchiveDate(archivedGame.endedAt)}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/archive/${archivedGame.id}`}>View Game</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-semibold font-headline">No Archived Games</h3>
          <p className="text-muted-foreground mt-2">
            Games you take part in appear here once they end.
          </p>
        </div>
      )}
    </div>
  );
}
