/**
 * DB tests for voting in a review thread.
 * Spec Reference: 07-proof-and-approval.md - Eligible Voters
 */

import { describe, expect, it } from 'vitest';
import { submitVote } from '@/lib/db/review-thread-repository';
import { CellState, VoteType } from '@/lib/shared/types';
import { createThread } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';
import { createReviewSetup } from './helpers';

describe('reviews – votes', () => {
  describe('operations', () => {
    it('keeps one vote per voter and lets them change it (07-proof-and-approval.md – Eligible Voters)', async () => {
      // Arrange
      const { owner, voterA, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);
      await submitVote(threadId, voterA.id, VoteType.ACCEPT);

      // Act
      const result = await submitVote(threadId, voterA.id, VoteType.DENY);

      // Assert
      expect(result).toMatchObject({ success: true, threadClosed: false });
      const votes = await query<{ vote: VoteType }[]>('SELECT vote FROM review_votes WHERE thread_id = ?', [threadId]);
      expect(votes).toEqual([{ vote: VoteType.DENY }]);
    });
  });

  describe('rejects', () => {
    it('the completing user voting on their own proof (07-proof-and-approval.md – Eligible Voters)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);

      // Act
      const result = await submitVote(threadId, owner.id, VoteType.ACCEPT);

      // Assert
      expect(result).toMatchObject({ success: false, status: 403 });
      expect(await countRows('review_votes', 'thread_id = ?', [threadId])).toBe(0);
    });

    it('voting on a closed thread (07-proof-and-approval.md – Eligible Voters)', async () => {
      // Arrange
      const { owner, voterA, cellId } = await createReviewSetup(CellState.ACCOMPLISHED);
      const threadId = await createThread(cellId, owner, { closedWithOutcome: 'accomplished' });

      // Act
      const result = await submitVote(threadId, voterA.id, VoteType.DENY);

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await countRows('review_votes', 'thread_id = ?', [threadId])).toBe(0);
    });
  });
});
