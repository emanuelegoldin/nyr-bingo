/**
 * DB tests for the archive tables: their columns.
 * Spec Reference: 18-game-archive.md - Data Model
 */

import { describe, expect, it } from 'vitest';
import { getColumns } from '../../support/db/schema';

describe('archive – structure', () => {
  describe('structure', () => {
    it('has the expected archived_games and archived_threads columns (18-game-archive.md – Data Model)', async () => {
      // Act
      const games = await getColumns('archived_games');
      const threads = await getColumns('archived_threads');

      // Assert
      expect(games).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'team_name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'ended_at', type: 'datetime', nullable: false, generated: false },
        { name: 'grid_size', type: 'tinyint(4)', nullable: false, generated: false },
        { name: 'started_at', type: 'datetime', nullable: true, generated: false },
      ]);
      expect(threads).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'archived_game_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'position', type: 'int(11)', nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: false, generated: false },
        { name: 'closed_at', type: 'datetime', nullable: true, generated: false },
        { name: 'outcome', type: "enum('accomplished','pending')", nullable: true, generated: false },
        { name: 'accept_votes', type: 'int(11)', nullable: false, generated: false },
        { name: 'deny_votes', type: 'int(11)', nullable: false, generated: false },
      ]);
    });
  });
});
