import { CellSourceType } from './types';

/** Minimal cell shape needed to derive the source label. */
export interface CellSourceInfo {
  sourceType: CellSourceType;
  sourceUserId: string | null;
}

/**
 * Builds the label describing where a cell's resolution came from.
 *
 * @param cell - The cell (source type and optional source user id).
 * @param usernames - Map of user id to display name for team members.
 * @returns "Team Goal" for team cells, the provider's name ("Team member" if unknown)
 *          for member-provided cells, "Suggested" for prepared cells, and "Personal" otherwise.
 */
export function getSourceLabel(cell: CellSourceInfo, usernames: Record<string, string>): string {
  if (cell.sourceType === CellSourceType.TEAM) return 'Team Goal';
  if (cell.sourceType === CellSourceType.MEMBER_PROVIDED) {
    return (cell.sourceUserId ? usernames[cell.sourceUserId] : undefined) ?? 'Team member';
  }
  if (cell.sourceType === CellSourceType.PREPARED) return 'Suggested';
  return 'Personal';
}
