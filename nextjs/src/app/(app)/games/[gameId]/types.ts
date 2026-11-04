/**
 * Shared types for the game page and its tab components.
 * Spec Reference: 16-games.md, 06-bingo-gameplay.md
 */

import type { TeamMember } from "@/components/team/types";
import type { Resolution } from "@/lib/db/types";
import type { GameStatus } from "@/lib/shared/types";

/** Game shape as returned by the game API. */
export interface Game {
  id: string;
  teamId: string;
  teamName: string;
  name: string;
  teamResolutionText: string | null;
  status: GameStatus;
  /** Last playable day as YYYY-MM-DD, or null when the game only ends manually. */
  deadline: string | null;
  members: TeamMember[];
}

/** Team-provided resolution shape (from unified Resolution entity). */
export type TeamProvidedResolution = Pick<
  Resolution,
  | "id"
  | "ownerUserId"
  | "teamId"
  | "gameId"
  | "toUserId"
  | "title"
  | "description"
  | "resolutionType"
  | "subtasks"
  | "numberOfRepetition"
  | "completedTimes"
>;
