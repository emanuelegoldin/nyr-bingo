/**
 * DB tests for the review tables: their columns.
 * Spec Reference: 07-proof-and-approval.md - Review Thread Model
 */

import { describe, expect, it } from 'vitest';
import { getColumns } from '../../support/db/schema';

describe('reviews – structure', () => {
  describe('structure', () => {
    it('has the expected review_threads columns (07-proof-and-approval.md – Review Thread Model)', async () => {
      // Act
      const columns = await getColumns('review_threads');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'cell_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'completed_by_user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'status', type: "enum('open','closed')", nullable: true, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'closed_at', type: 'datetime', nullable: true, generated: false },
        { name: 'outcome', type: "enum('accomplished','pending')", nullable: true, generated: false },
      ]);
    });

    it('has the expected review_votes columns (10-voting-mechanic.md – Persistence & Database Notes)', async () => {
      // Act
      const columns = await getColumns('review_votes');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'thread_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'voter_user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'vote', type: "enum('accept','deny')", nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });
});
