/**
 * Route tests for logging in with email and password.
 * Spec Reference: 01-authentication.md - Login
 */

import { describe, expect, it } from 'vitest';
import { POST as login } from '@/app/api/auth/login/route';
import { createUser } from '@/lib/db/user-repository';
import { callRoute } from '../../support/api/call-route';
import { cookieJar } from '../../support/api/cookie-jar';

const PASSWORD = 'password123';

/**
 * Register an unverified user with a real password hash.
 * @returns The user's email
 */
const registerUser = async (): Promise<string> => {
  const user = await createUser('alice', 'alice@test.local', PASSWORD);
  return user.email;
};

describe('auth – login', () => {
  describe('operations', () => {
    it('logs in an unverified user (01-authentication.md – Login)', async () => {
      // Arrange
      const email = await registerUser();

      // Act
      const result = await callRoute(login, { method: 'POST', body: { email, password: PASSWORD } });

      // Assert
      expect(result.status).toBe(200);
      expect(cookieJar.has('session_token')).toBe(true);
    });

    it('sets an httpOnly, sameSite=lax session cookie (01-authentication.md – Login)', async () => {
      // Arrange
      const email = await registerUser();

      // Act
      await callRoute(login, { method: 'POST', body: { email, password: PASSWORD } });

      // Assert
      expect(cookieJar.get('session_token')).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    });
  });

  describe('rejects', () => {
    it('a wrong password, with 401 and no session (01-authentication.md – Login)', async () => {
      // Arrange
      const email = await registerUser();

      // Act
      const result = await callRoute(login, { method: 'POST', body: { email, password: 'wrong-password' } });

      // Assert
      expect(result.status).toBe(401);
      expect(cookieJar.has('session_token')).toBe(false);
    });

    it('the username instead of the email, with 401 (01-authentication.md – Login)', async () => {
      // Arrange
      await registerUser();

      // Act
      const result = await callRoute(login, { method: 'POST', body: { email: 'alice', password: PASSWORD } });

      // Assert
      expect(result.status).toBe(401);
    });
  });
});
