/**
 * DB tests for messages in a review thread.
 * Spec Reference: 07-proof-and-approval.md - Discussion
 */

import { describe, expect, it } from 'vitest';
import { addMessage } from '@/lib/db/review-thread-repository';
import { CellState } from '@/lib/shared/types';
import { createThread } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';
import { createReviewSetup } from './helpers';

describe('reviews – messages', () => {
  describe('operations', () => {
    it('stores a trimmed message (07-proof-and-approval.md – Discussion)', async () => {
      // Arrange
      const { owner, voterA, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);

      // Act
      const result = await addMessage(threadId, voterA.id, '  Show me a photo  ');

      // Assert
      expect(result.success).toBe(true);
      const rows = await query<{ content: string }[]>('SELECT content FROM review_messages WHERE thread_id = ?', [threadId]);
      expect(rows).toEqual([{ content: 'Show me a photo' }]);
    });
  });

  describe('rejects', () => {
    it('an empty message (07-proof-and-approval.md – Discussion)', async () => {
      // Arrange
      const { owner, voterA, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);

      // Act
      const result = await addMessage(threadId, voterA.id, '   ');

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await countRows('review_messages', 'thread_id = ?', [threadId])).toBe(0);
    });
  });
});
