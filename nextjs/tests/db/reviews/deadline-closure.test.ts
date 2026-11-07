/**
 * DB tests for closing review threads after their deadline.
 * Spec Reference: 07-proof-and-approval.md - Closure by Deadline
 */

import { describe, expect, it } from 'vitest';
import { closeExpiredThreads } from '@/lib/db/review-thread-repository';
import { CellState } from '@/lib/shared/types';
import { createThread } from '../../support/db/fixtures';
import { createReviewSetup, readThread } from './helpers';

describe('reviews – deadline closure', () => {
  describe('operations', () => {
    it('closes threads open for 2 days, a thread without votes as accomplished (07-proof-and-approval.md – Closure by Deadline)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner, { ageDays: 2 });

      // Act
      const closed = await closeExpiredThreads();

      // Assert
      expect(closed).toEqual([threadId]);
      expect(await readThread(threadId)).toMatchObject({ status: 'closed', outcome: 'accomplished', cell_state: CellState.ACCOMPLISHED });
    });
  });

  describe('rejects', () => {
    it('closing threads younger than 2 days by deadline (07-proof-and-approval.md – Closure by Deadline)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner, { ageDays: 1 });

      // Act
      const closed = await closeExpiredThreads();

      // Assert
      expect(closed).toEqual([]);
      expect(await readThread(threadId)).toMatchObject({ status: 'open', cell_state: CellState.PENDING_REVIEW });
    });
  });
});
