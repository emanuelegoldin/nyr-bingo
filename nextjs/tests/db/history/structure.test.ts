/**
 * DB tests for the cell history table: its columns.
 * Spec Reference: 13-resolution-history-and-progress.md - Data Model
 */

import { describe, expect, it } from 'vitest';
import { getColumns } from '../../support/db/schema';

describe('history – structure', () => {
  describe('structure', () => {
    it('has the expected cell_history_entries columns (13-resolution-history-and-progress.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('cell_history_entries');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'cell_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'author_user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'entry_type', type: "enum('manual_note','system_event')", nullable: false, generated: false },
        { name: 'event_key', type: 'varchar(120)', nullable: true, generated: false },
        { name: 'content', type: 'text', nullable: false, generated: false },
        { name: 'metadata_json', type: 'longtext', nullable: true, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });
});
