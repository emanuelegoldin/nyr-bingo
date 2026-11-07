/**
 * DB tests for closing a review thread once every voter voted.
 * Spec Reference: 07-proof-and-approval.md - Outcome
 */

import { describe, expect, it } from 'vitest';
import { submitVote } from '@/lib/db/review-thread-repository';
import { CellState, VoteType } from '@/lib/shared/types';
import { createThread, createVote } from '../../support/db/fixtures';
import { createReviewSetup, readThread } from './helpers';

describe('reviews – vote outcome', () => {
  describe('operations', () => {
    it('closes as accomplished once every voter voted and half accept (07-proof-and-approval.md – Outcome)', async () => {
      // Arrange
      const { owner, voterA, voterB, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);
      await createVote(threadId, voterA, VoteType.DENY);

      // Act
      const result = await submitVote(threadId, voterB.id, VoteType.ACCEPT);

      // Assert
      expect(result).toMatchObject({ success: true, threadClosed: true });
      expect(await readThread(threadId)).toEqual({
        status: 'closed',
        outcome: 'accomplished',
        closed: 1,
        cell_state: CellState.ACCOMPLISHED,
      });
    });

    it('closes as pending when fewer than half accept (07-proof-and-approval.md – Outcome)', async () => {
      // Arrange
      const { owner, voterA, voterB, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);
      await createVote(threadId, voterA, VoteType.DENY);

      // Act
      await submitVote(threadId, voterB.id, VoteType.DENY);

      // Assert
      expect(await readThread(threadId)).toMatchObject({ status: 'closed', outcome: 'pending', cell_state: CellState.PENDING });
    });
  });
});
