/**
 * Shared types for the game page and its tab components.
 * Spec Reference: 16-games.md, 06-bingo-gameplay.md
 */

import type { TeamMember } from "@/components/team/types";
import type { GameStatus, Subtask } from "@/lib/shared/types";
import { ResolutionType } from "@/lib/shared/types";

/** Game shape as returned by the game API. */
export interface Game {
  id: string;
  teamId: string;
  teamName: string;
  leaderUserId: string;
  name: string;
  teamResolutionText: string | null;
  status: GameStatus;
  /** Last playable day as YYYY-MM-DD, or null when the game only ends manually. */
  deadline: string | null;
  members: TeamMember[];
}

/** Team-provided resolution shape (from unified Resolution entity). */
export interface TeamProvidedResolution {
  id: string;
  ownerUserId: string;
  teamId: string | null;
  gameId: string | null;
  toUserId: string | null;
  title: string;
  description: string | null;
  resolutionType: ResolutionType;
  subtasks: Subtask[] | null;
  numberOfRepetition: number | null;
  completedTimes: number;
}
