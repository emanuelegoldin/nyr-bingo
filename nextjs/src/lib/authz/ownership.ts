/**
 * Resource rules: actions that depend on who owns a record rather than on a role.
 * Spec Reference: 21-authorization.md - Resource Rules (Ownership)
 */

import { isOnCardOfGamePlayedBy } from '@/lib/db/resolution-history-repository';
import { getResolutionById } from '@/lib/db/resolution-repository';
import { ResolutionScope } from '@/lib/shared/types';
import type { Resolution, ResolutionHistoryAccess, ReviewThread } from '@/lib/db/types';
import { getGameRole, getTeamRole } from './roles';

/**
 * Whether a user owns a resolution, and so may edit or delete it.
 * @param resolution The resolution
 * @param userId The user
 * @returns True if the user is its owner
 */
export function isResolutionOwner(resolution: Pick<Resolution, 'ownerUserId'>, userId: string): boolean {
  return resolution.ownerUserId === userId;
}

/**
 * Whether a user may change a resolution's progress.
 * Personal resolutions belong to their owner and member-provided ones to their recipient.
 * A team goal belongs to the leader who owns it.
 * @param resolution The resolution to change
 * @param userId The user making the change
 * @returns True if the change is allowed
 */
export function canModifyProgress(
  resolution: Pick<Resolution, 'scope' | 'ownerUserId' | 'toUserId'>,
  userId: string
): boolean {
  if (resolution.scope === 'member_provided') return resolution.toUserId === userId;
  return resolution.ownerUserId === userId;
}

/**
 * Whether a user owns a bingo card, and so may complete, undo or edit its cells.
 * @param cardUserId The owner of the card
 * @param userId The user
 * @returns True if the card is the user's
 */
export function isCardOwner(cardUserId: string, userId: string): boolean {
  return cardUserId === userId;
}

/**
 * Whether a user completed the cell under review, and so may close the thread and manage its proof.
 * @param thread The review thread
 * @param userId The user
 * @returns True if the user is the completing user
 */
export function isThreadCompleter(thread: Pick<ReviewThread, 'completedByUserId'>, userId: string): boolean {
  return thread.completedByUserId === userId;
}


/**
 * Whether a user may read a resolution's history.
 * Spec: 13-resolution-history-and-progress.md - History Visibility
 * @param resolution The resolution
 * @param userId The user
 * @returns True for its owner, the players of its game (team members without a game),
 *   and, for a personal resolution, players of a game whose cards hold it
 */
async function canViewResolutionHistory(resolution: Resolution, userId: string): Promise<boolean> {
  if (resolution.ownerUserId === userId) {
    return true;
  }

  if (
    resolution.scope === ResolutionScope.TEAM ||
    resolution.scope === ResolutionScope.MEMBER_PROVIDED ||
    resolution.scope === ResolutionScope.PREPARED
  ) {
    // Spec: 13 - a game's resolutions are visible to its players
    if (resolution.gameId) return (await getGameRole(resolution.gameId, userId)) !== null;
    if (!resolution.teamId) return false;
    return (await getTeamRole(resolution.teamId, userId)) !== null;
  }

  if (resolution.scope === ResolutionScope.PERSONAL) {
    return isOnCardOfGamePlayedBy(resolution.id, userId);
  }

  return false;
}

/**
 * Load a resolution with the user's read and write access to its history.
 * Spec: 13-resolution-history-and-progress.md - Manual Entry Creation, History Visibility
 * @param resolutionId The resolution
 * @param userId The user
 * @returns The resolution (null when it does not exist) and whether the user may view and write its history
 */
export async function getResolutionHistoryAccess(
  resolutionId: string,
  userId: string,
): Promise<ResolutionHistoryAccess> {
  const resolution = await getResolutionById(resolutionId);
  if (!resolution) {
    return {
      resolution: null,
      canView: false,
      canWrite: false,
    };
  }

  // TODO: for team goals, we need a way to tell from which card the resolution is coming from in order to verify if the
  // user is the owner of the card. If they are, then they can edit the resolution history.

  const canWrite =
    (resolution.scope === ResolutionScope.PERSONAL || resolution.scope === ResolutionScope.PREPARED)
      && resolution.ownerUserId === userId || // Owner of the resolution
    resolution.scope === ResolutionScope.MEMBER_PROVIDED && resolution.toUserId === userId;  // Target user of a member-provided resolution
  const canView = await canViewResolutionHistory(resolution, userId);

  return {
    resolution,
    canView,
    canWrite,
  };
}
