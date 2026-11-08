/**
 * DB tests for permissions in a running game: who has a role there, and what each role allows.
 * Spec Reference: 21-authorization.md - Scopes and Roles, Status Rules
 */

import { describe, expect, it } from 'vitest';
import { authorize } from '@/lib/authz/policy';
import { createRolesSetup, loadGame, loadUser } from './helpers';

describe('authz – game scope', () => {
  describe('operations', () => {
    it('gives a player who is a Team Admin the leader role (21-authorization.md – Scopes and Roles)', async () => {
      // Arrange
      const { admin, game } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(admin), 'game.end', { scope: 'game', game: await loadGame(game) });

      // Assert
      expect(decision).toEqual({ allowed: true, role: 'leader' });
    });

    it('gives any other player the player role (21-authorization.md – Scopes and Roles)', async () => {
      // Arrange
      const { member, game } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(member), 'thread.vote', { scope: 'game', game: await loadGame(game) });

      // Assert
      expect(decision).toEqual({ allowed: true, role: 'player' });
    });
  });

  describe('rejects', () => {
    it('a player using an admin permission (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { member, game } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(member), 'game.end', { scope: 'game', game: await loadGame(game) });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });

    it('a Team Admin who does not play the game (21-authorization.md – Scopes and Roles)', async () => {
      // Arrange
      const { benchAdmin, game } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(benchAdmin), 'game.view', { scope: 'game', game: await loadGame(game) });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });

    it('a user outside the team (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { outsider, game } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(outsider), 'game.view', { scope: 'game', game: await loadGame(game) });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });

    it('a missing game, with 404 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { admin } = await createRolesSetup();

      // Act
      const decision = await authorize(await loadUser(admin), 'game.view', { scope: 'game', game: null });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 404 });
    });
  });
});
