/**
 * DB tests for a cell losing its reactions when it stops being stamped.
 * Spec Reference: 24-cell-reactions.md - Losing Reactions, Clearing
 */

import { describe, expect, it } from 'vitest';
import { undoCompletion, updateCellState } from '@/lib/db/bingo-cell-repository';
import { requestProof } from '@/lib/db/review-thread-repository';
import { CellState } from '@/lib/shared/types';
import { createReaction } from '../../support/db/fixtures';
import { createReactionSetup, readReactions } from './helpers';

describe('reactions – clear', () => {
  describe('operations', () => {
    it('clears every reaction when the owner undoes the cell (24-cell-reactions.md – Losing Reactions)', async () => {
      // Arrange
      const { cellId, teammates } = await createReactionSetup();
      await createReaction(cellId, teammates[0]);
      await createReaction(cellId, teammates[1]);

      // Act
      await undoCompletion(cellId);

      // Assert
      expect(await readReactions(cellId)).toEqual([]);
    });

    it('clears every reaction when a proof request puts the cell under review (24-cell-reactions.md – Losing Reactions)', async () => {
      // Arrange
      const { cellId, teammates } = await createReactionSetup();
      await createReaction(cellId, teammates[0]);

      // Act
      await requestProof(cellId, teammates[1].id);

      // Assert
      expect(await readReactions(cellId)).toEqual([]);
    });
  });

  describe('rejects', () => {
    it('clearing the reactions of a cell that stays stamped (24-cell-reactions.md – Clearing)', async () => {
      // Arrange
      const { cellId, teammates } = await createReactionSetup();
      await createReaction(cellId, teammates[0]);

      // Act: a refused change leaves the cell completed
      await updateCellState(cellId, CellState.FAILED);

      // Assert
      expect(await readReactions(cellId)).toHaveLength(1);
    });
  });
});
