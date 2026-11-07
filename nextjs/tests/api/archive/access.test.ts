/**
 * Route tests for who may see or delete an archived game and its threads.
 * Spec Reference: 18-game-archive.md - Permissions; 21-authorization.md - Permission Table, Status Rules
 */

import { describe, expect, it } from 'vitest';
import { DELETE as deleteArchivedThread } from '@/app/api/archived-games/[archivedGameId]/threads/[threadId]/route';
import { DELETE as deleteArchivedGame, GET as getArchivedGame } from '@/app/api/archived-games/[archivedGameId]/route';
import { archiveGame } from '@/lib/db/archived-game-repository';
import { createThread, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createEndedGame, loadGame } from '../../db/archive/helpers';

/**
 * Archive an ended game of an admin and a member, with one closed thread.
 * @returns The players, the archived game id and the thread id
 */
const createArchivedGame = async () => {
  const setup = await createEndedGame();
  const threadId = await createThread(setup.adminCellIds[0], setup.admin, { closedWithOutcome: 'accomplished' });
  await archiveGame(await loadGame(setup.game));
  return { admin: setup.admin, member: setup.member, archivedGameId: setup.game.id, threadId };
};

describe('archive – access', () => {
  describe('operations', () => {
    it('shows the archived game to one of its players (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { member, archivedGameId } = await createArchivedGame();
      await signInAs(member);

      // Act
      const result = await callRoute(getArchivedGame, { params: { archivedGameId } });

      // Assert
      expect(result.status).toBe(200);
    });

    it('lets its admin delete it (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { admin, archivedGameId } = await createArchivedGame();
      await signInAs(admin);

      // Act
      const result = await callRoute(deleteArchivedGame, { method: 'DELETE', params: { archivedGameId } });

      // Assert
      expect(result.status).toBe(200);
      expect(await countRows('archived_games', 'id = ?', [archivedGameId])).toBe(0);
    });
  });

  describe('rejects', () => {
    it('an archived game that does not exist, with 404 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(getArchivedGame, { params: { archivedGameId: '00000000-0000-4000-8000-00000000dead' } });

      // Assert
      expect(result.status).toBe(404);
    });

    it('a user who did not take part, with 403 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { archivedGameId } = await createArchivedGame();
      await signInAs(await createUser());

      // Act
      const result = await callRoute(getArchivedGame, { params: { archivedGameId } });

      // Assert
      expect(result.status).toBe(403);
    });

    it('a player deleting the archived game, with 403 (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { member, archivedGameId } = await createArchivedGame();
      await signInAs(member);

      // Act
      const result = await callRoute(deleteArchivedGame, { method: 'DELETE', params: { archivedGameId } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('archived_games', 'id = ?', [archivedGameId])).toBe(1);
    });

    it('a player deleting one of its threads, with 403 (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { member, archivedGameId, threadId } = await createArchivedGame();
      await signInAs(member);

      // Act
      const result = await callRoute(deleteArchivedThread, { method: 'DELETE', params: { archivedGameId, threadId } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('archived_threads', 'archived_game_id = ?', [archivedGameId])).toBe(1);
    });
  });
});
