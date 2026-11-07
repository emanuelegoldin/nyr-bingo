/**
 * DB tests for editing the content of a cell.
 * Spec Reference: 09-bingo-card-editing.md - Persisting a Cell Edit
 */

import { describe, expect, it } from 'vitest';
import { updateCellContent } from '@/lib/db/bingo-cell-repository';
import { CellSourceType, CellState } from '@/lib/shared/types';
import { createPersonalResolution, createPlayingCard } from '../../support/db/fixtures';
import { readCell } from '../gameplay/helpers';

describe('cards – editing', () => {
  describe('operations', () => {
    it('replaces a cell with a personal resolution and resets its state (09-bingo-card-editing.md – Persisting a Cell Edit)', async () => {
      // Arrange
      const { owner, card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;
      const resolutionId = await createPersonalResolution(owner, 'Read twelve books');

      // Act
      const result = await updateCellContent(cellId, { resolutionId, sourceType: CellSourceType.PERSONAL });

      // Assert
      expect(result.success).toBe(true);
      expect(await readCell(cellId)).toEqual({
        state: CellState.PENDING,
        source_type: CellSourceType.PERSONAL,
        resolution_id: resolutionId,
        title: 'Read twelve books',
        is_empty: 0,
      });
    });

    it('empties a cell and clears its snapshot (09-bingo-card-editing.md – Persisting a Cell Edit)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellContent(cellId, { resolutionId: null, sourceType: CellSourceType.EMPTY });

      // Assert
      expect(result.success).toBe(true);
      expect(await readCell(cellId)).toEqual({
        state: CellState.PENDING,
        source_type: CellSourceType.EMPTY,
        resolution_id: null,
        title: null,
        is_empty: 1,
      });
    });
  });
});
