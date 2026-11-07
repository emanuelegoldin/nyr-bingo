/**
 * Route tests for the fields a personal resolution must have.
 * Spec Reference: 03-personal-resolutions.md - Constraints, Create and Update, Read, Permissions
 */

import { describe, expect, it } from 'vitest';
import { GET as getCompound } from '@/app/api/resolutions/compound/route';
import { POST as save } from '@/app/api/resolutions/save/route';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute, query } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

/**
 * Log in a new user.
 * @returns The user id
 */
const signInNewUser = async (): Promise<string> => {
  const user = await createUser();
  await signInAs(user);
  return user.id;
};

describe('resolutions – validation', () => {
  describe('operations', () => {
    it('trims the title and cuts it to 255 characters (03-personal-resolutions.md – Constraints)', async () => {
      // Arrange
      const userId = await signInNewUser();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { type: 'base', title: `  ${'a'.repeat(300)}  ` } });

      // Assert
      expect(result.status).toBe(201);
      const rows = await query<{ length: number }[]>('SELECT CHAR_LENGTH(title) AS length FROM resolutions WHERE owner_user_id = ?', [userId]);
      expect(rows).toEqual([{ length: 255 }]);
    });

    it('lets an unverified user create a personal resolution (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const userId = await signInNewUser();
      await execute('UPDATE users SET email_verified_at = NULL WHERE id = ?', [userId]);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { type: 'base', title: 'Read more' } });

      // Assert
      expect(result.status).toBe(201);
    });
  });

  describe('rejects', () => {
    it.each(['', '   '])('a title of "%s", with 400 (03-personal-resolutions.md – Constraints)', async (title) => {
      // Arrange
      const userId = await signInNewUser();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { type: 'base', title } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'owner_user_id = ?', [userId])).toBe(0);
    });

    it.each([
      ['no subtasks', []],
      ['a subtask without a title', [{ title: ' ', description: '' }]],
    ])('a compound resolution with %s, with 400 (03-personal-resolutions.md – Constraints)', async (_case, subtasks) => {
      // Arrange
      const userId = await signInNewUser();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { type: 'compound', title: 'Trip', subtasks } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'owner_user_id = ?', [userId])).toBe(0);
    });

    it.each([1, 0, '3'])('an iterative resolution with %s repetitions, with 400 (03-personal-resolutions.md – Constraints)', async (numberOfRepetition) => {
      // Arrange
      const userId = await signInNewUser();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { type: 'iterative', title: 'Swim', numberOfRepetition } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'owner_user_id = ?', [userId])).toBe(0);
    });

    it('updating another user\'s resolution, leaving it unchanged (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const owner = await createUser();
      await execute("INSERT INTO resolutions (id, owner_user_id, scope, resolution_type, title) VALUES ('res-1', ?, 'personal', 'base', 'Mine')", [owner.id]);
      await signInNewUser();

      // Act
      const result = await callRoute(save, { method: 'POST', body: { id: 'res-1', type: 'base', title: 'Taken over' } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('resolutions', "id = 'res-1' AND title = 'Mine'", [])).toBe(1);
    });

    it('reading another user\'s resolution by id, with 404 (03-personal-resolutions.md – Read)', async () => {
      // Arrange
      const owner = await createUser();
      await execute(
        "INSERT INTO resolutions (id, owner_user_id, scope, resolution_type, title, subtasks) VALUES ('res-1', ?, 'personal', 'compound', 'Trip', ?)",
        [owner.id, JSON.stringify([{ title: 'Pack', description: '' }])]
      );
      await signInNewUser();

      // Act
      const result = await callRoute(getCompound, { search: 'id=res-1' });

      // Assert
      expect(result.status).toBe(404);
    });
  });
});
