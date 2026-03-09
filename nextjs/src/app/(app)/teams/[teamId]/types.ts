/**
 * Shared types for team detail page and its tab components.
 * Spec Reference: 04-bingo-teams.md, 06-bingo-gameplay.md
 */

import { CellSourceType, CellState, ProofStatus, ResolutionType } from "@/lib/shared/types";
import type { Subtask } from "@/lib/shared/types";

/** Team member shape as returned by the team detail API. */
export interface TeamMember {
  membership: {
    id: string;
    teamId: string;
    userId: string;
    role: "leader" | "member";
    joinedAt: string;
  };
  user: {
    id: string;
    userId: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
}

/** Team shape as returned by the team detail API. */
export interface Team {
  id: string;
  name: string;
  leaderUserId: string;
  teamResolutionText: string | null;
  status: "forming" | "started";
  members: TeamMember[];
}

/** Bingo cell shape as returned by the cards API. */
export interface BingoCellData {
  id: string;
  cardId: string;
  position: number;
  resolutionId: string | null;
  resolutionType: ResolutionType;
  resolutionText: string;
  resolutionTitle: string;
  isJoker: boolean;
  isEmpty: boolean;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  state: CellState;
  reviewThreadId?: string | null;
  proof: {
    id: string;
    status: ProofStatus;
  } | null;
}

/** Bingo card shape as returned by the cards API. */
export interface BingoCardData {
  id: string;
  teamId: string;
  userId: string;
  gridSize: number;
  cells: BingoCellData[];
}

/** Team-provided resolution shape (from unified Resolution entity). */
export interface TeamProvidedResolution {
  id: string;
  ownerUserId: string;
  teamId: string | null;
  toUserId: string | null;
  title: string;
  description: string | null;
  resolutionType: ResolutionType;
  subtasks: Subtask[] | null;
  numberOfRepetition: number | null;
  completedTimes: number;
}
