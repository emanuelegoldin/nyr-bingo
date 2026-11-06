"use client";

/**
 * Read-only view of an archived thread: its result, messages and file links.
 * Spec Reference: 07-proof-and-approval.md - Archived Threads
 */

import { formatArchiveDate } from "@/components/archive/format-archive-date";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ArchivedThread } from "@/lib/shared/types";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ThreadOutcomeBadge } from "./thread-outcome-badge";

interface ArchivedThreadDialogProps {
  thread: ArchivedThread;
  onClose: () => void;
  /** Actions shown at the bottom, such as the admin's delete button. */
  actions?: ReactNode;
}

/**
 * Show an archived thread. Nothing in it can be changed.
 *
 * @param props - The thread, the handler that closes the dialog and optional actions.
 * @returns The dialog.
 */
export function ArchivedThreadDialog({ thread, onClose, actions }: ArchivedThreadDialogProps) {
  const t = useTranslations("Threads.archived");
  const tm = useTranslations("Threads.messages");
  const tf = useTranslations("Threads.files");
  const locale = useLocale();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words">{thread.cellTitle}</DialogTitle>
          <DialogDescription>
            {thread.closedAt
              ? t("ownerClosed", { owner: thread.cardOwnerName, date: formatArchiveDate(thread.closedAt, locale) })
              : thread.cardOwnerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ThreadOutcomeBadge thread={thread} />

          <div className="space-y-2">
            <p className="text-sm font-medium">{tm("title")}</p>
            {thread.messages.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto rounded-md border p-2">
                {thread.messages.map((message) => (
                  <div key={message.id} className="text-sm">
                    <p className="text-xs text-muted-foreground">
                      {message.authorName} · {formatArchiveDate(message.createdAt, locale)}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{tm("empty")}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{tf("title")}</p>
            {thread.files.length > 0 ? (
              <ul className="space-y-1">
                {thread.files.map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.filePath}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm underline truncate"
                    >
                      {file.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{tf("empty")}</p>
            )}
          </div>
        </div>

        {actions && <DialogFooter>{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
