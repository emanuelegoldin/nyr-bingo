/**
 * DB tests for deleting a team.
 * Spec Reference: 04-bingo-teams.md - Team Deletion
 */

import { describe, expect, it } from 'vitest';
import { deleteTeam } from '@/lib/db/team-repository';
import {
  createCard,
  createGame as seedGame,
  createInvitation,
  createTeam as seedTeam,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';

describe('teams – deletion', () => {
  describe('operations', () => {
    it('deletes a team with its memberships, invitations and games, leaving other teams intact (04-bingo-teams.md – Team Deletion)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      await createInvitation(team);
      const game = await seedGame(team, [leader]);
      await createCard(game, leader, [{}]);
      const otherTeam = await seedTeam(leader);

      // Act
      await deleteTeam(team.id);

      // Assert
      expect(await countRows('teams', 'id = ?', [team.id])).toBe(0);
      expect(await countRows('team_memberships', 'team_id = ?', [team.id])).toBe(0);
      expect(await countRows('team_invitations', 'team_id = ?', [team.id])).toBe(0);
      expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('teams', 'id = ?', [otherTeam.id])).toBe(1);
    });
  });
});
