/**
 * DB tests for the leaderboard progress table: its columns.
 * Spec Reference: 23-progress-chart.md - Data Model
 */

import { describe, expect, it } from 'vitest';
import { getColumns } from '../../support/db/schema';

describe('leaderboard – structure', () => {
  describe('structure', () => {
    it('has the expected leaderboard_progress columns (23-progress-chart.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('leaderboard_progress');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'bigint(20)', nullable: false, generated: false },
        { name: 'game_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'recorded_at', type: 'datetime', nullable: false, generated: false },
        { name: 'completed_tasks', type: 'int(11)', nullable: false, generated: false },
      ]);
    });
  });
});
