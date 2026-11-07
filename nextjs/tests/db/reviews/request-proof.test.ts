/**
 * DB tests for requesting proof on a completed cell.
 * Spec Reference: 07-proof-and-approval.md - Review Trigger
 */

import { describe, expect, it } from 'vitest';
import { requestProof } from '@/lib/db/review-thread-repository';
import { CellState, GameStatus } from '@/lib/shared/types';
import { countRows } from '../../support/db/rows';
import { createReviewSetup, readThread } from './helpers';

describe('reviews – request proof', () => {
  describe('operations', () => {
    it('opens a thread and puts a completed cell under review (07-proof-and-approval.md – Review Trigger)', async () => {
      // Arrange
      const { voterA, cellId } = await createReviewSetup(CellState.COMPLETED);

      // Act
      const result = await requestProof(cellId, voterA.id);

      // Assert
      expect(result.success).toBe(true);
      expect(await readThread(result.thread!.id)).toEqual({
        status: 'open',
        outcome: null,
        closed: 0,
        cell_state: CellState.PENDING_REVIEW,
      });
    });
  });

  describe('rejects', () => {
    it('requesting proof on your own cell (07-proof-and-approval.md – Review Trigger)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.COMPLETED);

      // Act
      const result = await requestProof(cellId, owner.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Cannot request proof for your own resolution' });
      expect(await countRows('review_threads', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('requesting proof on a cell that is not completed (07-proof-and-approval.md – Review Trigger)', async () => {
      // Arrange
      const { voterA, cellId } = await createReviewSetup(CellState.PENDING);

      // Act
      const result = await requestProof(cellId, voterA.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Cell must be completed before requesting proof' });
      expect(await countRows('review_threads', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('requesting proof in an ended game (16-games.md – Ending a Game)', async () => {
      // Arrange
      const { voterA, cellId } = await createReviewSetup(CellState.COMPLETED, GameStatus.ENDED);

      // Act
      const result = await requestProof(cellId, voterA.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'This game has ended' });
      expect(await countRows('review_threads', 'cell_id = ?', [cellId])).toBe(0);
    });
  });
});
