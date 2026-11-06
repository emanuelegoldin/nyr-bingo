"use client";

/**
 * The final result of an archived thread: the state its cell took, and the vote counts.
 * Spec Reference: 07-proof-and-approval.md - Archived Threads
 */

import { STATE_CONFIG } from "@/components/cell/cell-state-style";
import type { ArchivedThread } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ThreadOutcomeBadgeProps {
  thread: Pick<ArchivedThread, "outcome" | "acceptVotes" | "denyVotes">;
}

/**
 * Show a thread's outcome, styled as the cell state it led to, beside its vote counts.
 * Threads closed before the outcome was recorded show the vote counts only.
 *
 * @param props - The thread's outcome and vote counts.
 * @returns The badge and the vote summary.
 */
export function ThreadOutcomeBadge({ thread }: ThreadOutcomeBadgeProps) {
  const tl = useTranslations("Labels");
  const tv = useTranslations("Threads.vote");
  const stateConfig = thread.outcome ? STATE_CONFIG[thread.outcome] : null;

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {thread.outcome && stateConfig && (
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
          stateConfig.bg,
          stateConfig.text,
        )}>
          {stateConfig.icon}
          {tl(`cellState.${thread.outcome}`)}
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        {tv("summary", { acceptCount: thread.acceptVotes, denyCount: thread.denyVotes })}
      </span>
    </span>
  );
}
