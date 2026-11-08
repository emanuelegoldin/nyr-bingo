/**
 * Route tests for the fields a personal resolution must have.
 * Spec Reference: 03-personal-resolutions.md - Constraints, Create and Update, Permissions
 */

import { describe, expect, it } from 'vitest';
import { POST as save } from '@/app/api/resolutions/save/route';
import { GameStatus } from '@/lib/shared/types';
import { createGame, createTeam, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute, query } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

/**
 * Log in a new user who plays a game in its preparation phase.
 * @returns The user id and the game id
 */
const signInNewPlayer = async (): Promise<{ userId: string; gameId: string }> => {
  const user = await createUser();
  const game = await createGame(await createTeam(user), [user], GameStatus.FORMING);
  await signInAs(user);
  return { userId: user.id, gameId: game.id };
};

describe('resolutions – validation', () => {
  describe('operations', () => {
    it('trims the title and cuts it to 255 characters (03-personal-resolutions.md – Constraints)', async () => {
      // Arrange
      const { userId, gameId } = await signInNewPlayer();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { gameId, type: 'base', title: `  ${'a'.repeat(300)}  ` } });

      // Assert
      expect(result.status).toBe(201);
      const rows = await query<{ length: number }[]>('SELECT CHAR_LENGTH(title) AS length FROM resolutions WHERE owner_user_id = ?', [userId]);
      expect(rows).toEqual([{ length: 255 }]);
    });
  });

  describe('rejects', () => {
    it.each(['', '   '])('a title of "%s", with 400 (03-personal-resolutions.md – Constraints)', async (title) => {
      // Arrange
      const { userId, gameId } = await signInNewPlayer();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { gameId, type: 'base', title } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'owner_user_id = ?', [userId])).toBe(0);
    });

    it.each([
      ['no subtasks', []],
      ['a subtask without a title', [{ title: ' ', description: '' }]],
    ])('a compound resolution with %s, with 400 (03-personal-resolutions.md – Constraints)', async (_case, subtasks) => {
      // Arrange
      const { userId, gameId } = await signInNewPlayer();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { gameId, type: 'compound', title: 'Trip', subtasks } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'owner_user_id = ?', [userId])).toBe(0);
    });

    it.each([1, 0, '3'])('an iterative resolution with %s repetitions, with 400 (03-personal-resolutions.md – Constraints)', async (numberOfRepetition) => {
      // Arrange
      const { userId, gameId } = await signInNewPlayer();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { gameId, type: 'iterative', title: 'Swim', numberOfRepetition } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'owner_user_id = ?', [userId])).toBe(0);
    });

    it('updating another user\'s resolution, leaving it unchanged (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const owner = await createUser();
      await execute("INSERT INTO resolutions (id, owner_user_id, scope, resolution_type, title) VALUES ('res-1', ?, 'personal', 'base', 'Mine')", [owner.id]);
      await signInNewPlayer();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { id: 'res-1', type: 'base', title: 'Taken over' } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('resolutions', "id = 'res-1' AND title = 'Mine'", [])).toBe(1);
    });
  });
});
