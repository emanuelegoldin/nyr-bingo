"use client";

/**
 * Threads tab: the archived threads of a running or an archived game, opened read-only.
 * Shared by the game page and the archived game page.
 * Spec Reference: 07-proof-and-approval.md - Archived Threads, 12-team-tabs.md - Threads Tab
 */

import { formatArchiveDate } from "@/components/archive/format-archive-date";
import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import type { ArchivedThread } from "@/lib/shared/types";
import { MessageSquare, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArchivedThreadDialog } from "./archived-thread-dialog";
import { ThreadOutcomeBadge } from "./thread-outcome-badge";

interface ArchivedThreadsTabProps {
  threads: ArchivedThread[];
  /** The API route that deletes a thread, given to admins only. */
  getDeleteUrl?: (threadId: string) => string;
}

/**
 * List archived threads, most recently closed first, and open one in a read-only dialog.
 * Admins can delete the open thread; the page is then refreshed from the server.
 *
 * @param props - The threads and, for admins, the delete route.
 * @returns The tab content.
 */
export function ArchivedThreadsTab({ threads, getDeleteUrl }: ArchivedThreadsTabProps) {
  const t = useTranslations("Threads.archived");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const toastApiError = useApiErrorToast();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;

  /** Delete the selected thread, close the dialog and reload the page's data. */
  const handleDelete = async () => {
    if (!selectedThread || !getDeleteUrl) return;
    setIsDeleting(true);
    const result = await apiFetch<unknown>(getDeleteUrl(selectedThread.id), { method: "DELETE" });
    setIsDeleting(false);

    if (!result.ok) {
      toastApiError(result, t("deleteFailed"));
      return;
    }

    setSelectedThreadId(null);
    router.refresh();
  };

  if (threads.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <>
      <ul className="divide-y rounded-md border">
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSelectedThreadId(thread.id)}
            >
              <MessageSquare className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium break-words">{thread.cellTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {thread.closedAt
                    ? t("ownerClosed", { owner: thread.cardOwnerName, date: formatArchiveDate(thread.closedAt, locale) })
                    : thread.cardOwnerName}
                </p>
                <ThreadOutcomeBadge thread={thread} />
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selectedThread && (
        <ArchivedThreadDialog
          thread={selectedThread}
          onClose={() => setSelectedThreadId(null)}
          actions={getDeleteUrl && (
            <ConfirmActionDialog
              triggerLabel={tc("delete")}
              triggerIcon={Trash2}
              triggerVariant="destructive"
              title={t("deleteTitle")}
              description={t("deleteDescription")}
              confirmLabel={tc("delete")}
              onConfirm={handleDelete}
              isPending={isDeleting}
            />
          )}
        />
      )}
    </>
  );
}
