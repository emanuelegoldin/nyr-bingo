/**
 * Resource rules: actions that depend on who owns a record rather than on a role.
 * Spec Reference: 21-authorization.md - Resource Rules (Ownership)
 */

import type { Resolution, ReviewThread } from '@/lib/db/types';

export { getResolutionHistoryAccess } from '@/lib/db/resolution-history-repository';

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
 * Whether a player may vote on a thread: anyone but the completing user.
 * @param thread The review thread
 * @param userId The player
 * @returns True if the player may vote
 */
export function canVoteOnThread(thread: Pick<ReviewThread, 'completedByUserId'>, userId: string): boolean {
  return !isThreadCompleter(thread, userId);
}
