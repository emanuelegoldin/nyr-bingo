/**
 * DB tests for marking cells completed or failed.
 * Spec Reference: 06-bingo-gameplay.md - Cell States, Mark Resolution as Completed, Mark Resolution as Failed
 */

import { describe, expect, it } from 'vitest';
import { updateCellState } from '@/lib/db/bingo-cell-repository';
import { CellState, GameStatus, ResolutionType } from '@/lib/shared/types';
import { createPlayingCard } from '../../support/db/fixtures';
import { readCell } from './helpers';

describe('gameplay – cell states', () => {
  describe('operations', () => {
    it('marks a pending base cell completed (06-bingo-gameplay.md – Mark Resolution as Completed)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.COMPLETED);

      // Assert
      expect(result).toMatchObject({ success: true, cell: { id: cellId, state: CellState.COMPLETED } });
      expect((await readCell(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('marks a failed base cell completed (06-bingo-gameplay.md – Mark Resolution as Completed)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ state: CellState.FAILED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.COMPLETED);

      // Assert
      expect(result.success).toBe(true);
      expect((await readCell(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('marks a pending cell of any type failed (06-bingo-gameplay.md – Mark Resolution as Failed)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }, { type: ResolutionType.ITERATIVE }]);
      const [compoundCellId, iterativeCellId] = card.cellIds;

      // Act
      const compoundResult = await updateCellState(compoundCellId, CellState.FAILED);
      const iterativeResult = await updateCellState(iterativeCellId, CellState.FAILED);

      // Assert
      expect(compoundResult.success).toBe(true);
      expect(iterativeResult.success).toBe(true);
      expect((await readCell(compoundCellId)).state).toBe(CellState.FAILED);
      expect((await readCell(iterativeCellId)).state).toBe(CellState.FAILED);
    });
  });

  describe('rejects', () => {
    it('completing an empty cell (06-bingo-gameplay.md – Non-Checkable Cells)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ source: 'empty' }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.COMPLETED);

      // Assert
      expect(result).toEqual({ success: false, error: 'Empty cells cannot be marked as completed' });
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });

    it('failing an empty cell (06-bingo-gameplay.md – Non-Checkable Cells)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ source: 'empty' }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.FAILED);

      // Assert
      expect(result).toEqual({ success: false, error: 'Empty cells cannot be marked as failed' });
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });

    it('setting a review state directly (06-bingo-gameplay.md – Cell States)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.ACCOMPLISHED);

      // Assert
      expect(result).toEqual({ success: false, error: 'Only pending, completed and failed can be set directly' });
      expect((await readCell(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('changing a cell of an ended game (16-games.md – Ending a Game)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}], GameStatus.ENDED);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.COMPLETED);

      // Assert
      expect(result).toEqual({ success: false, error: 'This game has ended' });
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });
  });
});
