/**
 * DB tests for promoting team members to Team Admin.
 * Spec Reference: 04-bingo-teams.md - Admins
 */

import { describe, expect, it } from 'vitest';
import { promoteToLeader } from '@/lib/db/team-repository';
import { TeamRole } from '@/lib/shared/types';
import { addMember, createTeam as seedTeam, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { readRole } from './helpers';

describe('teams – admins', () => {
  describe('operations', () => {
    it('promotes a member so the team has two admins (04-bingo-teams.md – Admins)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);

      // Act
      const result = await promoteToLeader(team.id, member.id);

      // Assert
      expect(result.success).toBe(true);
      expect(await readRole(team.id, member.id)).toBe(TeamRole.LEADER);
      expect(await countRows('team_memberships', "team_id = ? AND role = 'leader'", [team.id])).toBe(2);
    });
  });

  describe('rejects', () => {
    it('promoting a member who is already a Team Admin (04-bingo-teams.md – Admins)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);

      // Act
      const result = await promoteToLeader(team.id, leader.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'User is already a Team Admin' });
    });

    it('promoting a user who is not a member (04-bingo-teams.md – Admins)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const outsider = await createUser();

      // Act
      const result = await promoteToLeader(team.id, outsider.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'User is not a member of this team' });
      expect(await readRole(team.id, outsider.id)).toBeUndefined();
    });
  });
});
