"use client";

/**
 * Archived Game Page content: header, then tabs with read-only cards, leaderboard and threads.
 * Spec Reference: 18-game-archive.md - Archived Game Page
 */

import { LeaderboardTab } from "@/app/(app)/games/[gameId]/leaderboard-tab";
import { ArchivedCardView } from "@/components/archive/archived-card";
import { formatArchiveDate } from "@/components/archive/format-archive-date";
import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { ArchivedThreadsTab } from "@/components/threads/archived-threads-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/AppContext";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import type { ArchivedGameDetail } from "@/lib/shared/types";
import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ArchivedGamePageClientProps {
  archivedGame: ArchivedGameDetail;
  /** Whether the viewer is the leader who ran the game. */
  canDelete: boolean;
  /** Whether the viewer may delete the game's archived threads. */
  canDeleteThreads: boolean;
}

export default function ArchivedGamePageClient({ archivedGame, canDelete, canDeleteThreads }: ArchivedGamePageClientProps) {
  const t = useTranslations("Archive");
  const tc = useTranslations("Common");
  const tt = useTranslations("Games.detail.tabs");
  const locale = useLocale();
  const toastApiError = useApiErrorToast();
  usePageTitle(t("pageTitle"));

  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  /** Delete the archived game and return to the archive. */
  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiFetch<unknown>(`/api/archived-games/${archivedGame.id}`, { method: "DELETE" });
    setIsDeleting(false);

    if (!result.ok) {
      toastApiError(result, t("gamePage.deleteFailed"));
      return;
    }

    router.push("/archive");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight font-headline">{archivedGame.name}</h1>
          <p className="text-muted-foreground mt-1">
            {t("endedBy", { teamName: archivedGame.teamName, date: formatArchiveDate(archivedGame.endedAt, locale) })}
          </p>
        </div>
        {canDelete && (
          <div className="shrink-0">
            <ConfirmActionDialog
              triggerLabel={tc("delete")}
              triggerIcon={Trash2}
              triggerVariant="destructive"
              title={t("gamePage.deleteTitle")}
              description={t("gamePage.deleteDescription")}
              confirmLabel={tc("delete")}
              onConfirm={handleDelete}
              isPending={isDeleting}
            />
          </div>
        )}
      </div>

      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards">{tt("cards")}</TabsTrigger>
          <TabsTrigger value="leaderboard">{tt("leaderboard")}</TabsTrigger>
          <TabsTrigger value="threads">{tt("threads")}</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-6 space-y-8">
          {archivedGame.cards.map((card) => (
            <ArchivedCardView key={card.userId} card={card} gridSize={archivedGame.gridSize} />
          ))}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <LeaderboardTab initialEntries={archivedGame.leaderboard} />
        </TabsContent>

        <TabsContent value="threads" className="mt-6">
          <ArchivedThreadsTab
            threads={archivedGame.threads}
            getDeleteUrl={canDeleteThreads
              ? (threadId) => `/api/archived-games/${archivedGame.id}/threads/${threadId}`
              : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
