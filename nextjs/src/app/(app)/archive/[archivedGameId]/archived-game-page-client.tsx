"use client";

/**
 * Archived Game Page content: header, final leaderboard and read-only cards.
 * Spec Reference: 18-game-archive.md - Archived Game Page
 */

import { LeaderboardTab } from "@/app/(app)/games/[gameId]/leaderboard-tab";
import { ArchivedCardView } from "@/components/archive/archived-card";
import { formatArchiveDate } from "@/components/archive/format-archive-date";
import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
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
}

export default function ArchivedGamePageClient({ archivedGame, canDelete }: ArchivedGamePageClientProps) {
  const t = useTranslations("Archive");
  const tc = useTranslations("Common");
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

      <LeaderboardTab initialEntries={archivedGame.leaderboard} />

      <div className="space-y-8">
        <h2 className="text-2xl font-bold font-headline">{t("gamePage.cards")}</h2>
        {archivedGame.cards.map((card) => (
          <ArchivedCardView key={card.userId} card={card} />
        ))}
      </div>
    </div>
  );
}
