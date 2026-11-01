"use client";

/**
 * Archived Game Page content: header, final leaderboard and read-only cards.
 * Spec Reference: 18-game-archive.md - Archived Game Page
 */

import { LeaderboardTab } from "@/app/(app)/games/[gameId]/leaderboard-tab";
import { ArchivedCardView } from "@/components/archive/archived-card";
import { DeleteArchivedGameDialog } from "@/components/archive/delete-archived-game-dialog";
import { formatArchiveDate } from "@/components/archive/format-archive-date";
import { usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import type { ArchivedGameDetail } from "@/lib/shared/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ArchivedGamePageClientProps {
  archivedGame: ArchivedGameDetail;
  /** Whether the viewer is the leader who ran the game. */
  canDelete: boolean;
}

export default function ArchivedGamePageClient({ archivedGame, canDelete }: ArchivedGamePageClientProps) {
  usePageTitle("Archive");

  const router = useRouter();
  const { toast } = useToast();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /** Delete the archived game and return to the archive. */
  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiFetch<unknown>(`/api/archived-games/${archivedGame.id}`, { method: "DELETE" });
    setIsDeleting(false);

    if (!result.ok) {
      toast({
        title: "Error",
        description: result.error || "Failed to delete the archived game",
        variant: "destructive",
      });
      return;
    }

    setIsDeleteOpen(false);
    router.push("/archive");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{archivedGame.name}</h1>
          <p className="text-muted-foreground mt-1">
            {archivedGame.teamName} · Ended {formatArchiveDate(archivedGame.endedAt)}
          </p>
        </div>
        {canDelete && (
          <div className="shrink-0">
            <DeleteArchivedGameDialog
              open={isDeleteOpen}
              onOpenChange={setIsDeleteOpen}
              onConfirm={handleDelete}
              isDeleting={isDeleting}
            />
          </div>
        )}
      </div>

      <LeaderboardTab initialEntries={archivedGame.leaderboard} />

      <div className="space-y-8">
        <h2 className="text-2xl font-bold font-headline">Bingo Cards</h2>
        {archivedGame.cards.map((card) => (
          <ArchivedCardView key={card.userId} card={card} />
        ))}
      </div>
    </div>
  );
}
