/**
 * DB tests for manual notes in a cell history.
 * Spec Reference: 13-resolution-history-and-progress.md - Manual Entry Creation
 */

import { describe, expect, it } from 'vitest';
import { createManualCellHistoryEntry } from '@/lib/db/cell-history-repository';
import { createPlayingCard } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';

describe('history – notes', () => {
  describe('operations', () => {
    it('adds a trimmed manual note to a cell\'s history (13-resolution-history-and-progress.md – Manual Entry Creation)', async () => {
      // Arrange
      const { owner, card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const entry = await createManualCellHistoryEntry(cellId, owner.id, '  Ran 5 km  ');

      // Assert
      const rows = await query<{ entry_type: string; content: string }[]>(
        'SELECT entry_type, content FROM cell_history_entries WHERE id = ?',
        [entry.id]
      );
      expect(rows).toEqual([{ entry_type: 'manual_note', content: 'Ran 5 km' }]);
    });
  });

  describe('rejects', () => {
    it('an empty history note (13-resolution-history-and-progress.md – Manual Entry Creation)', async () => {
      // Arrange
      const { owner, card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const attempt = createManualCellHistoryEntry(cellId, owner.id, '   ');

      // Assert
      await expect(attempt).rejects.toThrow('History content must be non-empty');
      expect(await countRows('cell_history_entries', 'cell_id = ?', [cellId])).toBe(0);
    });
  });
});
