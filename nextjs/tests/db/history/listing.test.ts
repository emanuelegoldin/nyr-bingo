/**
 * DB tests for reading a cell's history: order and page size.
 * Spec Reference: 13-resolution-history-and-progress.md - API Endpoints
 */

import { describe, expect, it } from 'vitest';
import { getCellHistoryEntries } from '@/lib/db/cell-history-repository';
import { createPlayingCard, type UserFixture } from '../../support/db/fixtures';
import { execute } from '../../support/db/test-connection';

/**
 * Insert manual notes on a cell, the first one the newest, one minute apart.
 * @param cellId The cell
 * @param author The card owner
 * @param count How many notes
 */
const insertNotes = async (cellId: string, author: UserFixture, count: number): Promise<void> => {
  for (let minutesAgo = 0; minutesAgo < count; minutesAgo += 1) {
    await execute(
      `INSERT INTO cell_history_entries (id, cell_id, author_user_id, entry_type, content, created_at)
       VALUES (UUID(), ?, ?, 'manual_note', ?, NOW() - INTERVAL ? MINUTE)`,
      [cellId, author.id, `note ${minutesAgo}`, minutesAgo]
    );
  }
};

describe('history – listing', () => {
  it('returns the entries newest first (13-resolution-history-and-progress.md – API Endpoints)', async () => {
    // Arrange
    const { owner, card } = await createPlayingCard([{}]);
    await insertNotes(card.cellIds[0], owner, 3);

    // Act
    const entries = await getCellHistoryEntries(card.cellIds[0]);

    // Assert
    expect(entries.map((entry) => entry.content)).toEqual(['note 0', 'note 1', 'note 2']);
  });

  it('returns 50 entries by default (13-resolution-history-and-progress.md – API Endpoints)', async () => {
    // Arrange
    const { owner, card } = await createPlayingCard([{}]);
    await insertNotes(card.cellIds[0], owner, 51);

    // Act
    const entries = await getCellHistoryEntries(card.cellIds[0]);

    // Assert
    expect(entries).toHaveLength(50);
  });

  it('caps the page at 100 entries (13-resolution-history-and-progress.md – API Endpoints)', async () => {
    // Arrange
    const { owner, card } = await createPlayingCard([{}]);
    await insertNotes(card.cellIds[0], owner, 101);

    // Act
    const entries = await getCellHistoryEntries(card.cellIds[0], 500);

    // Assert
    expect(entries).toHaveLength(100);
  });

  it('skips the first entries by the offset (13-resolution-history-and-progress.md – API Endpoints)', async () => {
    // Arrange
    const { owner, card } = await createPlayingCard([{}]);
    await insertNotes(card.cellIds[0], owner, 3);

    // Act
    const entries = await getCellHistoryEntries(card.cellIds[0], 50, 2);

    // Assert
    expect(entries.map((entry) => entry.content)).toEqual(['note 2']);
  });
});
