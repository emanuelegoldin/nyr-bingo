"use client";

import { useToast } from "@/hooks/use-toast";
import { ReviewVote } from "@/lib/db/types";
import { VoteType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";
import { Button } from "../ui/button";

/**
 * VoteBar — extracted voting UI for review threads.
 *
 * Responsibilities:
 * 1. Two vote buttons (Accept / Deny) with colour feedback:
 *    - Accept → green on hover, press, **and** when already selected.
 *    - Deny   → red   on hover, press, **and** when already selected.
 * 2. A horizontal results bar:
 *    - Left portion green  (accept %) / right portion red (deny %).
 *    - Grey when no votes have been cast.
 * 3. Handles its own API call (`POST /api/threads/[threadId]/vote`).
 * 4. Allows the user to change their vote while the thread is open.
 *
 * The component is purely a voter control — it is **not** rendered for the
 * completing user (the parent hides it via `isOwner`).
 */

interface VoteBarProps {
  /** The review thread id used in the vote API call. */
  threadId: string;
  /** Current snapshot of all votes for this thread. */
  votes: ReviewVote[];
  /** The authenticated user's id — used to highlight their existing vote. */
  currentUserId: string | null;
  /** Whether the thread is still open (votes can only be submitted/changed while open). */
  threadOpen: boolean;
  /** Whether the user is allowed to vote (false hides the buttons, e.g. for the owner). */
  canVote?: boolean;
  /** Callback fired after a vote has been successfully persisted. */
  onVoteSubmitted?: () => void;
}

export function VoteBar({
  threadId,
  votes,
  currentUserId,
  threadOpen,
  canVote = true,
  onVoteSubmitted,
}: VoteBarProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive current user's vote from the votes array.
  const currentUserVote: VoteType | null =
    (currentUserId
      ? votes.find((v) => v.voterUserId === currentUserId)?.vote ?? null
      : null) as VoteType | null;

  const acceptCount = votes.filter((v) => v.vote === VoteType.ACCEPT).length;
  const denyCount = votes.filter((v) => v.vote === VoteType.DENY).length;
  const totalVotes = acceptCount + denyCount;

  const handleVote = useCallback(
    async (vote: VoteType) => {
      if (!threadId || isSubmitting || !threadOpen) return;

      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/threads/${threadId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({
            title: "Error",
            description: data?.error || "Failed to submit vote",
            variant: "destructive",
          });
          return;
        }
        onVoteSubmitted?.();
      } finally {
        setIsSubmitting(false);
      }
    },
    [threadId, isSubmitting, threadOpen, toast, onVoteSubmitted],
  );

  // ── Vote buttons ────────────────────────────────────────────────
  const acceptSelected = currentUserVote === VoteType.ACCEPT;
  const denySelected = currentUserVote === VoteType.DENY;

  // ── Results bar widths ──────────────────────────────────────────
  const acceptPct = totalVotes > 0 ? (acceptCount / totalVotes) * 100 : 0;
  const denyPct = totalVotes > 0 ? (denyCount / totalVotes) * 100 : 0;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{canVote ? "Vote" : "Votes"}</p>

      {/* Buttons — only shown when the user is allowed to vote */}
      {canVote && <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isSubmitting || !threadOpen}
          onClick={() => handleVote(VoteType.ACCEPT)}
          className={cn(
            // Green on hover / active / selected
            "transition-colors",
            acceptSelected
              ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
              : "hover:bg-green-100 hover:text-green-800 active:bg-green-200",
          )}
        >
          Accept
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={isSubmitting || !threadOpen}
          onClick={() => handleVote(VoteType.DENY)}
          className={cn(
            // Red on hover / active / selected
            "transition-colors",
            denySelected
              ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
              : "hover:bg-red-100 hover:text-red-800 active:bg-red-200",
          )}
        >
          Deny
        </Button>
      </div>}

      {/* Results bar */}
      <div
        className="h-5 w-full rounded-full overflow-hidden"
        role="progressbar"
        aria-label={
          totalVotes === 0
            ? "No votes yet"
            : `${acceptCount} accept, ${denyCount} deny`
        }
        aria-valuenow={acceptPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {totalVotes === 0 ? (
          <div className="h-full w-full bg-gray-300 flex items-center justify-center">
            <span className="text-[10px] text-gray-500 select-none">
              No votes yet
            </span>
          </div>
        ) : (
          <div className="flex h-full w-full">
            <div
              className="bg-green-500 flex items-center justify-center transition-all duration-300"
              style={{ width: `${acceptPct}%`, minWidth: acceptCount > 0 ? "1.5rem" : 0 }}
            >
              <span className="text-[10px] text-white font-medium select-none">
                {Math.round(acceptPct)}%
              </span>
            </div>
            <div
              className="bg-red-500 flex items-center justify-center transition-all duration-300"
              style={{ width: `${denyPct}%`, minWidth: denyCount > 0 ? "1.5rem" : 0 }}
            >
              <span className="text-[10px] text-white font-medium select-none">
                {Math.round(denyPct)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
