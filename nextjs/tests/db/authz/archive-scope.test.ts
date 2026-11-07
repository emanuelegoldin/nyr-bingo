/**
 * DB tests for permissions on an archived game.
 * Spec Reference: 21-authorization.md - Scopes and Roles, Permission Table
 */

import { describe, expect, it } from 'vitest';
import { authorize } from '@/lib/authz/policy';
import { archiveGame } from '@/lib/db/archived-game-repository';
import { createUser } from '../../support/db/fixtures';
import { createEndedGame, loadGame } from '../archive/helpers';
import { loadUser } from './helpers';

/**
 * Archive an ended game of an admin and a member.
 * @returns The players and the archived game id
 */
const createArchivedGame = async () => {
  const setup = await createEndedGame();
  await archiveGame(await loadGame(setup.game));
  return { admin: setup.admin, member: setup.member, archivedGameId: setup.game.id };
};

describe('authz – archive scope', () => {
  describe('operations', () => {
    it('lets a player of the archived game view it (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { member, archivedGameId } = await createArchivedGame();

      // Act
      const decision = await authorize(await loadUser(member), 'archive.view', { scope: 'archive', archivedGameId });

      // Assert
      expect(decision).toEqual({ allowed: true, role: 'player' });
    });

    it('lets its admin delete it (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { admin, archivedGameId } = await createArchivedGame();

      // Act
      const decision = await authorize(await loadUser(admin), 'archive.delete', { scope: 'archive', archivedGameId });

      // Assert
      expect(decision).toEqual({ allowed: true, role: 'leader' });
    });
  });

  describe('rejects', () => {
    it('a player deleting it (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { member, archivedGameId } = await createArchivedGame();

      // Act
      const decision = await authorize(await loadUser(member), 'archive.delete', { scope: 'archive', archivedGameId });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });

    it('a user who did not take part viewing it (21-authorization.md – Scopes and Roles)', async () => {
      // Arrange
      const { archivedGameId } = await createArchivedGame();
      const outsider = await createUser();

      // Act
      const decision = await authorize(await loadUser(outsider), 'archive.view', { scope: 'archive', archivedGameId });

      // Assert
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    });
  });
});
