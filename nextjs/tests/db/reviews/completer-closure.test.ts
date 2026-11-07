/**
 * DB tests for the completing user closing a review thread.
 * Spec Reference: 07-proof-and-approval.md - Closure by the Completing User
 */

import { describe, expect, it } from 'vitest';
import { closeThread } from '@/lib/db/review-thread-repository';
import { CellState } from '@/lib/shared/types';
import { createThread } from '../../support/db/fixtures';
import { createReviewSetup, readThread } from './helpers';

describe('reviews – completer closure', () => {
  describe('operations', () => {
    it('returns the cell to pending when the completing user closes the thread (07-proof-and-approval.md – Closure by the Completing User)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);

      // Act
      const result = await closeThread(threadId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await readThread(threadId)).toEqual({
        status: 'closed',
        outcome: 'pending',
        closed: 1,
        cell_state: CellState.PENDING,
      });
    });
  });
});
