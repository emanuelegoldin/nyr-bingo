/**
 * DB tests for permissions in a team and for those open to any logged-in user.
 * Spec Reference: 21-authorization.md - Scopes and Roles, Permission Table, Status Rules
 */

import { describe, expect, it } from 'vitest';
import { authorize } from '@/lib/authz/policy';
import { createUser } from '../../support/db/fixtures';
import { createRolesSetup, loadUnverifiedUser, loadUser } from './helpers';

describe('authz – team scope', () => {
  describe('operations', () => {
    it('lets a Team Admin invite (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { admin, team } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(admin), 'team.invite', { scope: 'team', teamId: team.id });

      // Assert
      expect(decision).toEqual({ allowed: true, role: 'leader' });
    });

    it('lets a member view the team (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { member, team } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(member), 'team.view', { scope: 'team', teamId: team.id });

      // Assert
      expect(decision).toEqual({ allowed: true, role: 'member' });
    });

    it('lets any verified user create a team (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const user = await createUser();

      // Act
      const decision = await authorize(await loadUser(user), 'team.create', { scope: 'none' });

      // Assert
      expect(decision).toEqual({ allowed: true, role: null });
    });
  });

  describe('rejects', () => {
    it('a member inviting (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { member, team } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(member), 'team.invite', { scope: 'team', teamId: team.id });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });

    it('a user outside the team viewing it (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { outsider, team } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(outsider), 'team.view', { scope: 'team', teamId: team.id });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });

    it.each(['team.create', 'team.join'] as const)('an unverified user using %s (21-authorization.md – Permission Table)', async (permission) => {
      // Arrange
      const user = await loadUnverifiedUser(await createUser());

      // Act
      const decision = await authorize(user, permission, { scope: 'none' });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });

    it('an unverified Team Admin creating a game (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { admin, team } = await createRolesSetup();
      const user = await loadUnverifiedUser(admin);

      // Act
      const decision = await authorize(user, 'game.create', { scope: 'team', teamId: team.id });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });
  });
});
