import { CellSourceType } from './types';

/** Minimal cell shape needed to derive the source label. */
export interface CellSourceInfo {
  sourceType: CellSourceType;
  sourceUserId: string | null;
}

/** Label of a member-provided resolution whose author is no longer a player of the game. */
export const FORMER_TEAMMATES_LABEL = 'Former Teammates';

/**
 * Finds the name of the player who provided a member-provided resolution.
 * Spec: 16-games.md - Leaving a Game
 *
 * @param sourceUserId - The author, if known.
 * @param usernames - Map of user id to display name for the game's players.
 * @returns The author's name, or "Former Teammates" when they are not a player.
 */
export function getProviderName(sourceUserId: string | null, usernames: Record<string, string>): string {
  return (sourceUserId ? usernames[sourceUserId] : undefined) ?? FORMER_TEAMMATES_LABEL;
}

/**
 * Builds the label describing where a cell's resolution came from.
 *
 * @param cell - The cell (source type and optional source user id).
 * @param usernames - Map of user id to display name for the game's players.
 * @returns "Team Goal" for team cells, the provider's name ("Former Teammates" when they are
 *          no longer a player) for member-provided cells, "Suggested" for prepared cells, and
 *          "Personal" otherwise.
 */
export function getSourceLabel(cell: CellSourceInfo, usernames: Record<string, string>): string {
  if (cell.sourceType === CellSourceType.TEAM) return 'Team Goal';
  if (cell.sourceType === CellSourceType.MEMBER_PROVIDED) {
    return getProviderName(cell.sourceUserId, usernames);
  }
  if (cell.sourceType === CellSourceType.PREPARED) return 'Suggested';
  return 'Personal';
}
