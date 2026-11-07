/**
 * DB tests for undoing a completed or failed cell.
 * Spec Reference: 06-bingo-gameplay.md - Undo Completion
 */

import { describe, expect, it } from 'vitest';
import { undoCompletion, updateCellState } from '@/lib/db/bingo-cell-repository';
import { CellState, ResolutionType } from '@/lib/shared/types';
import { createPlayingCard } from '../../support/db/fixtures';
import { readCell } from './helpers';

describe('gameplay – undo', () => {
  describe('operations', () => {
    it('undoes a completed base cell back to pending (06-bingo-gameplay.md – Undo Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await undoCompletion(cellId);

      // Assert
      expect(result.success).toBe(true);
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });

    it('undoes a failed cell back to pending (06-bingo-gameplay.md – Undo Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.ITERATIVE, state: CellState.FAILED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await undoCompletion(cellId);

      // Assert
      expect(result.success).toBe(true);
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });
  });

  describe('rejects', () => {
    it('failing a completed cell before undoing it (06-bingo-gameplay.md – Mark Resolution as Failed)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.FAILED);

      // Assert
      expect(result.success).toBe(false);
      expect((await readCell(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('undoing a pending cell (06-bingo-gameplay.md – Undo Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const result = await undoCompletion(cellId);

      // Assert
      expect(result).toEqual({ success: false, error: 'Cell is not completed' });
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });
  });
});
