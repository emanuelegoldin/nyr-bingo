/**
 * Helpers shared by the thread route tests: an open review thread in a game of three players.
 * Spec Reference: 07-proof-and-approval.md - Review Trigger
 */

import { CellState } from '@/lib/shared/types';
import { createThread, createUser, type UserFixture } from '../../support/db/fixtures';
import { createReviewSetup, type ReviewSetup } from '../../db/reviews/helpers';

/** An open thread on the owner's cell, a voter, and a user outside the game. */
export interface OpenThreadSetup extends ReviewSetup {
  threadId: string;
  outsider: UserFixture;
}

/**
 * Build a game of three players whose owner's cell is under review in an open thread.
 * @returns The players, the thread and an outsider
 */
export const createOpenThread = async (): Promise<OpenThreadSetup> => {
  const setup = await createReviewSetup(CellState.PENDING_REVIEW);
  const threadId = await createThread(setup.cellId, setup.owner);
  return { ...setup, threadId, outsider: await createUser() };
};

export const MISSING_THREAD_ID = '00000000-0000-4000-8000-00000000dead';
