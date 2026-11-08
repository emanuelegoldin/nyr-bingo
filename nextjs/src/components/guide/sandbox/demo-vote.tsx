"use client";

/**
 * Vote section of a demo review thread, drawn like the real one; it calls no API.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import { Button } from "@/components/ui/button";
import { VoteType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface DemoVoteProps {
  /** Votes cast by others. */
  accept: number;
  deny: number;
  /** The viewer's vote, counted in the results. */
  myVote: VoteType | null;
  /** Shows the Accept and Deny buttons; set for a teammate, not the card owner. */
  canVote: boolean;
  /** Set while the tour waits for the user to vote. */
  onVote?: (vote: VoteType) => void;
}

/**
 * Accept / Deny buttons and the results bar, like the review thread's vote bar.
 *
 * @param props - The other votes, the viewer's vote and whether they can vote.
 * @returns The vote section.
 */
export const DemoVote = ({ accept, deny, myVote, canVote, onVote }: DemoVoteProps) => {
  const t = useTranslations("Threads.vote");
  const acceptCount = accept + (myVote === VoteType.ACCEPT ? 1 : 0);
  const denyCount = deny + (myVote === VoteType.DENY ? 1 : 0);
  const acceptPct = (acceptCount / Math.max(acceptCount + denyCount, 1)) * 100;

  /** One vote button, coloured when selected. */
  const voteButton = (vote: VoteType, label: string, selectedClass: string) => (
    <Button
      variant="outline"
      size="sm"
      disabled={!onVote}
      className={cn("disabled:opacity-100", myVote === vote && selectedClass)}
      onClick={() => onVote?.(vote)}
    >
      {label}
    </Button>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{canVote ? t("vote") : t("votes")}</p>
      {canVote && (
        <div className="flex gap-2">
          {voteButton(VoteType.ACCEPT, t("accept"), "bg-success text-success-foreground border-success")}
          {voteButton(VoteType.DENY, t("deny"), "bg-destructive text-destructive-foreground border-destructive")}
        </div>
      )}
      {acceptCount + denyCount === 0 ? (
        <div className="flex h-5 w-full items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
          {t("noVotes")}
        </div>
      ) : (
        <div
          className="flex h-5 w-full overflow-hidden rounded-full bg-destructive text-[10px] font-medium"
          role="img"
          aria-label={t("summary", { acceptCount, denyCount })}
        >
          <div className="flex items-center justify-center bg-success text-success-foreground transition-all duration-300" style={{ width: `${acceptPct}%` }}>
            {acceptCount > 0 && `${Math.round(acceptPct)}%`}
          </div>
          <div className="flex flex-1 items-center justify-center text-destructive-foreground">
            {denyCount > 0 && `${Math.round(100 - acceptPct)}%`}
          </div>
        </div>
      )}
    </div>
  );
};
