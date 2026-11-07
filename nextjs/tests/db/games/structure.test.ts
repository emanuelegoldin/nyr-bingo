/**
 * DB tests for the game tables: their columns.
 * Spec Reference: 16-games.md - Data Model
 */

import { describe, expect, it } from 'vitest';
import { getColumns } from '../../support/db/schema';

describe('games – structure', () => {
  describe('structure', () => {
    it('has the expected games columns (16-games.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('games');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'status', type: "enum('forming','started','ended')", nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
        { name: 'ended_at', type: 'datetime', nullable: true, generated: false },
        { name: 'deadline', type: 'date', nullable: true, generated: false },
        { name: 'grid_size', type: 'tinyint(4)', nullable: false, generated: false },
        { name: 'started_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });

    it('has the expected game_players columns (16-games.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('game_players');

      // Assert
      expect(columns).toEqual([
        { name: 'game_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'joined_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });
});
