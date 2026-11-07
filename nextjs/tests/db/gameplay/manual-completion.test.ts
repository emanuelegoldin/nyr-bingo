/**
 * DB tests for completing compound and iterative cells by hand.
 * Spec Reference: 06-bingo-gameplay.md - Automatic Completion
 */

import { describe, expect, it } from 'vitest';
import { updateCellState } from '@/lib/db/bingo-cell-repository';
import { CellState, ResolutionType } from '@/lib/shared/types';
import { createPlayingCard } from '../../support/db/fixtures';
import { readCell } from './helpers';

describe('gameplay – manual completion', () => {
  describe('rejects', () => {
    it.each([ResolutionType.COMPOUND, ResolutionType.ITERATIVE])(
      'completing a %s cell manually (06-bingo-gameplay.md – Automatic Completion)',
      async (type) => {
        // Arrange
        const { card } = await createPlayingCard([{ type }]);
        const [cellId] = card.cellIds;

        // Act
        const result = await updateCellState(cellId, CellState.COMPLETED);

        // Assert
        expect(result).toEqual({ success: false, error: 'Compound and iterative cells complete automatically' });
        expect((await readCell(cellId)).state).toBe(CellState.PENDING);
      }
    );
  });
});
