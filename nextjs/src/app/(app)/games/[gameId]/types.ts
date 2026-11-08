/**
 * Shared types for the game page and its tab components.
 * Spec Reference: 16-games.md, 06-bingo-gameplay.md
 */

import type { TeamMember } from "@/components/team/types";
import type { Resolution } from "@/lib/db/types";
import type { GameStatus, GridSize } from "@/lib/shared/types";

/** Game shape as returned by the game API. */
export interface Game {
  id: string;
  teamId: string;
  teamName: string;
  name: string;
  teamResolutionText: string | null;
  status: GameStatus;
  /** ISO datetime bingo started, or null while the game is forming. */
  startedAt: string | null;
  /** Last playable day as YYYY-MM-DD, or null when the game only ends manually. */
  deadline: string | null;
  /** End of the preparation phase, ISO 8601 in UTC; null for games started before it existed. */
  preparationDeadline: string | null;
  /** Side length of the game's cards. */
  gridSize: GridSize;
  members: TeamMember[];
  /** The players who are ready, during the preparation phase. */
  readyPlayerIds: string[];
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
>;
