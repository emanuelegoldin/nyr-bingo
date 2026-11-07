/**
 * Route tests for requesting a new verification email.
 * Spec Reference: 02-user-profile-and-privacy.md - Verification Status
 */

import { describe, expect, it } from 'vitest';
import { POST as resend } from '@/app/api/auth/resend-verification/route';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

/**
 * Log in a user whose email is not verified, with the given number of tokens from the last hour.
 * @param tokens Tokens already sent
 * @returns The user id
 */
const signInUnverified = async (tokens: number): Promise<string> => {
  const user = await createUser();
  await execute('UPDATE users SET email_verified_at = NULL WHERE id = ?', [user.id]);
  for (let index = 0; index < tokens; index += 1) {
    await execute(
      'INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES (UUID(), ?, UUID(), NOW() + INTERVAL 1 DAY)',
      [user.id]
    );
  }
  await signInAs(user);
  return user.id;
};

describe('auth – resend verification', () => {
  describe('operations', () => {
    it('sends a new token to an unverified user (02-user-profile-and-privacy.md – Verification Status)', async () => {
      // Arrange
      const userId = await signInUnverified(1);

      // Act
      const result = await callRoute(resend, { method: 'POST' });

      // Assert
      expect(result.status).toBe(200);
      expect(await countRows('email_verification_tokens', 'user_id = ?', [userId])).toBe(2);
    });
  });

  describe('rejects', () => {
    it('a user who is already verified, with 400 (02-user-profile-and-privacy.md – Verification Status)', async () => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(resend, { method: 'POST' });

      // Assert
      expect(result.status).toBe(400);
    });

    it('a fourth token within an hour, with 429 (02-user-profile-and-privacy.md – Verification Status)', async () => {
      // Arrange
      const userId = await signInUnverified(3);

      // Act
      const result = await callRoute(resend, { method: 'POST' });

      // Assert
      expect(result.status).toBe(429);
      expect(await countRows('email_verification_tokens', 'user_id = ?', [userId])).toBe(3);
    });
  });
});
