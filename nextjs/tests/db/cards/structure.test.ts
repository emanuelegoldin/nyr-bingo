/**
 * DB tests for the card tables: their columns and derived values.
 * Spec Reference: 05-bingo-card-generation.md - Data Model Notes
 */

import { describe, expect, it } from 'vitest';
import { createPlayingCard } from '../../support/db/fixtures';
import { getColumns } from '../../support/db/schema';
import { readCell } from '../gameplay/helpers';

describe('cards – structure', () => {
  describe('structure', () => {
    it('has the expected columns (05-bingo-card-generation.md – Data Model Notes)', async () => {
      // Act
      const columns = await getColumns('bingo_cells');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'card_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'position', type: 'int(11)', nullable: false, generated: false },
        {
          name: 'source_type',
          type: "enum('team','member_provided','personal','empty','prepared')",
          nullable: false,
          generated: false,
        },
        { name: 'source_user_id', type: 'varchar(36)', nullable: true, generated: false },
        {
          name: 'state',
          type: "enum('pending','completed','pending_review','accomplished','failed')",
          nullable: true,
          generated: false,
        },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
        { name: 'resolution_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'resolution_type', type: "enum('base','compound','iterative')", nullable: false, generated: false },
        { name: 'title', type: 'varchar(255)', nullable: true, generated: false },
        { name: 'description', type: 'text', nullable: true, generated: false },
        { name: 'number_of_repetition', type: 'int(11)', nullable: true, generated: false },
        { name: 'completed_times', type: 'int(11)', nullable: false, generated: false },
        { name: 'is_empty', type: 'tinyint(1)', nullable: true, generated: true },
      ]);
    });

    it('derives is_empty from source_type (05-bingo-card-generation.md – Data Model Notes)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ source: 'empty' }, { source: 'personal' }]);
      const [emptyCellId, personalCellId] = card.cellIds;

      // Act
      const emptyCell = await readCell(emptyCellId);
      const personalCell = await readCell(personalCellId);

      // Assert
      expect(emptyCell.is_empty).toBe(1);
      expect(personalCell.is_empty).toBe(0);
    });

    it('has the expected bingo_cards columns (05-bingo-card-generation.md – Data Model Notes)', async () => {
      // Act
      const columns = await getColumns('bingo_cards');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'grid_size', type: 'int(11)', nullable: true, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'game_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'locked_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });
});
