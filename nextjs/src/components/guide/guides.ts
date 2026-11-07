/**
 * The guides listed on the Guides page, in display order.
 * Spec Reference: 26-guided-tour.md - Guides Page
 */

import { BingoTour } from "./bingo-card/bingo-tour";
import { LeaderboardTour } from "./leaderboard/leaderboard-tour";
import { ProgressTour } from "./progress/progress-tour";
import { OwnerThreadTour } from "./proof-thread-owner/owner-thread-tour";
import { VoterThreadTour } from "./proof-thread-voter/voter-thread-tour";
import { RequestProofTour } from "./request-proof/request-proof-tour";
import type { GuideDefinition } from "./types";

/** Every available guide. To add one, put its tour in its own folder and list it here. */
export const GUIDES: readonly GuideDefinition[] = [
  { id: "bingoCard", Tour: BingoTour },
  { id: "leaderboard", Tour: LeaderboardTour },
  { id: "progress", Tour: ProgressTour },
  { id: "requestProof", Tour: RequestProofTour },
  { id: "proofThreadOwner", Tour: OwnerThreadTour },
  { id: "proofThreadVoter", Tour: VoterThreadTour },
];
