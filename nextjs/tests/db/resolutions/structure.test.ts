/**
 * DB tests for the resolutions table: its columns.
 * Spec Reference: 03-personal-resolutions.md - Resolution Model
 */

import { describe, expect, it } from 'vitest';
import { getColumns } from '../../support/db/schema';

describe('resolutions – structure', () => {
  describe('structure', () => {
    it('has the expected columns (03-personal-resolutions.md – Resolution Model)', async () => {
      // Act
      const columns = await getColumns('resolutions');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'owner_user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'title', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'description', type: 'text', nullable: true, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
        { name: 'resolution_type', type: "enum('base','compound','iterative')", nullable: false, generated: false },
        { name: 'scope', type: "enum('personal','team','member_provided')", nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'to_user_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'subtasks', type: 'longtext', nullable: true, generated: false },
        { name: 'number_of_repetition', type: 'int(11)', nullable: true, generated: false },
        { name: 'game_id', type: 'varchar(36)', nullable: true, generated: false },
      ]);
    });
  });
});
