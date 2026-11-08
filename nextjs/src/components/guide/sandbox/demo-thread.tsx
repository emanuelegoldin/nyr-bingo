"use client";

/**
 * A demo review thread, drawn like the real thread dialog; it calls no API.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import { ThreadFiles } from "@/components/dialogs/thread-files";
import { ThreadMessages } from "@/components/dialogs/thread-messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewFile, ReviewMessageAndAuthor } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** `data-tour` values of the thread's parts. */
export const THREAD_TARGETS = {
  panel: "demo-thread",
  header: "demo-thread-header",
  files: "demo-thread-files",
  vote: "demo-thread-vote",
  messages: "demo-thread-messages",
} as const;

/** Resolution the demo threads are about (key of `Guide.sandbox.cells`). */
export const DEMO_THREAD_RESOLUTION = "run";

/** The proof file of the demo threads. It links nowhere. */
const DEMO_FILE: ReviewFile = {
  id: "demo-file",
  threadId: "demo-thread",
  uploadedByUserId: "demo-owner",
  filePath: "#",
  fileSize: 0,
  fileName: "finish-line.jpg",
  mimeType: "image/jpeg",
  createdAt: new Date(0),
};

/**
 * Sample content of a thread under way: one proof file, a question and the owner's answer.
 *
 * @param ownerName - Name shown on the owner's message.
 * @returns The files and messages, with translated texts.
 */
export const useDemoThreadSample = (ownerName: string): { files: ReviewFile[]; messages: ReviewMessageAndAuthor[] } => {
  const t = useTranslations("Guide.sandbox.thread");
  return {
    files: [DEMO_FILE],
    messages: [
      { id: "demo-ask", authorUsername: "chiara", content: t("ask") },
      { id: "demo-reply", authorUsername: ownerName, content: t("reply") },
    ],
  };
};

/** Does nothing: the demo thread's controls change no data. */
const ignore = () => { };

interface DemoThreadProps {
  resolutionTitle: string;
  /** Whether the viewer owns the card: they see the file controls and Close Thread. */
  isOwner: boolean;
  files: ReviewFile[];
  messages: ReviewMessageAndAuthor[];
  /** The vote section. */
  vote: ReactNode;
  className?: string;
}

/**
 * The thread's header (resolution and status), files, votes and messages.
 *
 * @param props - The resolution, the viewer's role, the sample files and messages, and the vote section.
 * @returns The thread panel.
 */
export const DemoThread = ({ resolutionTitle, isOwner, files, messages, vote, className }: DemoThreadProps) => {
  const t = useTranslations("Threads");

  return (
    <Card data-tour={THREAD_TARGETS.panel} className={cn("shadow-lg", className)}>
      <CardHeader data-tour={THREAD_TARGETS.header} className="space-y-2 pb-3">
        <CardTitle className="font-headline text-lg">{t("dialog.title")}</CardTitle>
        <CardDescription>{t("dialog.description", { resolutionText: resolutionTitle })}</CardDescription>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t("dialog.status")}</p>
          <Badge variant="outline">{t("dialog.statusValue.open")}</Badge>
        </div>
        {isOwner && (
          <Button variant="destructive" size="sm" disabled className="w-fit disabled:opacity-100">
            {t("dialog.closeThread")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div data-tour={THREAD_TARGETS.files}>
          <ThreadFiles
            files={files}
            canManage={isOwner}
            isSubmitting={false}
            selectedFile={null}
            onSelectFile={ignore}
            onUpload={ignore}
            onDelete={ignore} />
        </div>
        <div data-tour={THREAD_TARGETS.vote}>{vote}</div>
        <div data-tour={THREAD_TARGETS.messages}>
          <ThreadMessages
            messages={messages}
            messageDraft=""
            onDraftChange={ignore}
            isSubmitting={false}
            threadOpen
            onSend={ignore} />
        </div>
      </CardContent>
    </Card>
  );
};
