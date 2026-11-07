/**
 * Route tests for the session check every authenticated route runs first.
 * Spec Reference: 21-authorization.md - Status Rules; 01-authentication.md - Login
 */

import { describe, expect, it } from 'vitest';
import { GET as listTeams } from '@/app/api/teams/route';
import { createUser } from '../../support/db/fixtures';
import { execute } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { cookieJar } from '../../support/api/cookie-jar';
import { signInAs } from '../../support/api/session';

describe('auth – with auth', () => {
  describe('operations', () => {
    it('accepts a request with a valid session (01-authentication.md – Login)', async () => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(listTeams);

      // Assert
      expect(result.status).toBe(200);
    });
  });

  describe('rejects', () => {
    it('a request without a session, with 401 (21-authorization.md – Status Rules)', async () => {
      // Act
      const result = await callRoute(listTeams);

      // Assert
      expect(result.status).toBe(401);
    });

    it('a request whose session has expired, with 401 (01-authentication.md – Login)', async () => {
      // Arrange
      await signInAs(await createUser());
      await execute('UPDATE sessions SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE token = ?', [cookieJar.get('session_token')?.value]);

      // Act
      const result = await callRoute(listTeams);

      // Assert
      expect(result.status).toBe(401);
    });
  });
});
