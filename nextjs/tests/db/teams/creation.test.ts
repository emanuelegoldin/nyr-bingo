/**
 * DB tests for creating a team.
 * Spec Reference: 04-bingo-teams.md - Team Creation
 */

import { describe, expect, it } from 'vitest';
import { createTeam } from '@/lib/db/team-repository';
import { TeamRole } from '@/lib/shared/types';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { readRole } from './helpers';

describe('teams – creation', () => {
  describe('operations', () => {
    it('creates a team with its creator as Team Admin (04-bingo-teams.md – Team Creation)', async () => {
      // Arrange
      const creator = await createUser();

      // Act
      const team = await createTeam('Runners', creator.id);

      // Assert
      expect(team.name).toBe('Runners');
      expect(await readRole(team.id, creator.id)).toBe(TeamRole.LEADER);
      expect(await countRows('team_memberships', 'team_id = ?', [team.id])).toBe(1);
      expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
    });
  });
});
