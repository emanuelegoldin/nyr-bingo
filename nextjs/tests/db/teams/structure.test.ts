/**
 * DB tests for the team tables: their columns.
 * Spec Reference: 04-bingo-teams.md - Team Creation, Admins, Invitations / Joining
 */

import { describe, expect, it } from 'vitest';
import { getColumns } from '../../support/db/schema';

describe('teams – structure', () => {
  describe('structure', () => {
    it('has the expected teams columns (04-bingo-teams.md – Team Creation)', async () => {
      // Act
      const columns = await getColumns('teams');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });

    it('has the expected team_memberships columns (04-bingo-teams.md – Admins)', async () => {
      // Act
      const columns = await getColumns('team_memberships');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'role', type: "enum('leader','member')", nullable: true, generated: false },
        { name: 'joined_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });

    it('has the expected team_invitations columns (04-bingo-teams.md – Invitations / Joining)', async () => {
      // Act
      const columns = await getColumns('team_invitations');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'invite_code', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'invited_email', type: 'varchar(255)', nullable: true, generated: false },
        { name: 'invited_user_id', type: 'varchar(36)', nullable: true, generated: false },
        {
          name: 'status',
          type: "enum('pending','accepted','declined','expired')",
          nullable: true,
          generated: false,
        },
        { name: 'expires_at', type: 'datetime', nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });
});
