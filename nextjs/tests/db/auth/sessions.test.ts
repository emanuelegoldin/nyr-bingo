/**
 * DB tests for login sessions: their 7-day lifetime and logout.
 * Spec Reference: 01-authentication.md - Login, Logout
 */

import { describe, expect, it } from 'vitest';
import { createSession, deleteSession, findSessionByToken } from '@/lib/db/user-repository';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute, query } from '../../support/db/test-connection';

describe('auth – sessions', () => {
  describe('operations', () => {
    it('creates a session that expires after 7 days (01-authentication.md – Login)', async () => {
      // Arrange
      const user = await createUser();

      // Act
      const session = await createSession(user.id);

      // Assert: hours left on the DB clock; one hour of slack for a host and DB in different time zones
      const rows = await query<{ hours: number }[]>(
        'SELECT TIMESTAMPDIFF(HOUR, NOW(), expires_at) AS hours FROM sessions WHERE token = ?',
        [session.token]
      );
      expect(Math.abs(rows[0].hours - 7 * 24)).toBeLessThanOrEqual(1);
      expect((await findSessionByToken(session.token))?.userId).toBe(user.id);
    });

    it('deletes the session at logout (01-authentication.md – Logout)', async () => {
      // Arrange
      const user = await createUser();
      const session = await createSession(user.id);

      // Act
      await deleteSession(session.token);

      // Assert
      expect(await countRows('sessions', 'token = ?', [session.token])).toBe(0);
    });
  });

  describe('rejects', () => {
    it('a session past its expiry (01-authentication.md – Login)', async () => {
      // Arrange
      const user = await createUser();
      const session = await createSession(user.id);
      await execute('UPDATE sessions SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE token = ?', [session.token]);

      // Act
      const found = await findSessionByToken(session.token);

      // Assert
      expect(found).toBeNull();
    });
  });
});
