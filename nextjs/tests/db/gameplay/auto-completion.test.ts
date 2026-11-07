/**
 * DB tests for the progress of compound and iterative cells and their automatic completion.
 * Spec Reference: 06-bingo-gameplay.md - Automatic Completion
 */

import { describe, expect, it } from 'vitest';
import { autoTransitionCellState } from '@/lib/db/bingo-cell-repository';
import { adjustCellIterativeProgress, toggleCellSubtask } from '@/lib/db/cell-progress-repository';
import { CellState, GameStatus, ResolutionType } from '@/lib/shared/types';
import { createPlayingCard } from '../../support/db/fixtures';
import { readState, readSubtaskFlags, readCounter } from './helpers';

describe('gameplay – auto completion', () => {
  describe('operations', () => {
    it('toggles one subtask of a compound cell (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }]);
      const [cellId] = card.cellIds;

      // Act
      const toggled = await toggleCellSubtask(cellId, 1);

      // Assert
      expect(toggled).toBe(true);
      expect(await readSubtaskFlags(cellId)).toEqual([0, 1]);
    });

    it('moves the counter of an iterative cell and never below zero (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.ITERATIVE }]);
      const [cellId] = card.cellIds;

      // Act
      await adjustCellIterativeProgress(cellId, 1);
      await adjustCellIterativeProgress(cellId, 1);
      const afterIncrements = await readCounter(cellId);
      await adjustCellIterativeProgress(cellId, -1);
      await adjustCellIterativeProgress(cellId, -1);
      await adjustCellIterativeProgress(cellId, -1);

      // Assert
      expect(afterIncrements).toBe(2);
      expect(await readCounter(cellId)).toBe(0);
    });

    it.each([CellState.PENDING, CellState.FAILED])(
      'completes a %s cell whose progress is complete (06-bingo-gameplay.md – Automatic Completion)',
      async (state) => {
        // Arrange
        const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND, state }]);
        const [cellId] = card.cellIds;

        // Act
        const changed = await autoTransitionCellState(cellId, true);

        // Assert
        expect(changed).toHaveLength(1);
        expect(await readState(cellId)).toBe(CellState.COMPLETED);
      }
    );

    it('reverts a completed cell whose progress is no longer complete (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.ITERATIVE, state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;

      // Act
      await autoTransitionCellState(cellId, false);

      // Assert
      expect(await readState(cellId)).toBe(CellState.PENDING);
    });
  });

  describe('rejects', () => {
    it('toggling a subtask the cell does not have (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }]);
      const [cellId] = card.cellIds;

      // Act
      const toggled = await toggleCellSubtask(cellId, 5);

      // Assert
      expect(toggled).toBe(false);
      expect(await readSubtaskFlags(cellId)).toEqual([0, 0]);
    });

    it('reverting a failed cell whose progress is incomplete (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND, state: CellState.FAILED }]);
      const [cellId] = card.cellIds;

      // Act
      const changed = await autoTransitionCellState(cellId, false);

      // Assert
      expect(changed).toEqual([]);
      expect(await readState(cellId)).toBe(CellState.FAILED);
    });

    it.each([CellState.PENDING_REVIEW, CellState.ACCOMPLISHED])(
      'changing a %s cell automatically (06-bingo-gameplay.md – Automatic Completion)',
      async (state) => {
        // Arrange
        const { card } = await createPlayingCard([{ type: ResolutionType.ITERATIVE, state }]);
        const [cellId] = card.cellIds;

        // Act
        const changed = await autoTransitionCellState(cellId, false);

        // Assert
        expect(changed).toEqual([]);
        expect(await readState(cellId)).toBe(state);
      }
    );

    it('completing a cell of an ended game automatically (16-games.md – Ending a Game)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }], GameStatus.ENDED);
      const [cellId] = card.cellIds;

      // Act
      const changed = await autoTransitionCellState(cellId, true);

      // Assert
      expect(changed).toEqual([]);
      expect(await readState(cellId)).toBe(CellState.PENDING);
    });
  });
});
