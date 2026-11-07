/**
 * DB tests for email verification tokens: single use, 24-hour expiry and resend invalidation.
 * Spec Reference: 01-authentication.md - Email Verification; 02-user-profile-and-privacy.md - Verification Status
 */

import { describe, expect, it } from 'vitest';
import { countRecentVerificationTokens, createVerificationToken, verifyEmailToken } from '@/lib/db/user-repository';
import { createUser } from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';

/**
 * Insert an unverified user.
 * @returns The user id
 */
const createUnverifiedUser = async (): Promise<string> => {
  const user = await createUser();
  await execute('UPDATE users SET email_verified_at = NULL WHERE id = ?', [user.id]);
  return user.id;
};

/**
 * Read whether a user is verified.
 * @param userId The user
 * @returns True once email_verified_at is set
 */
const isVerified = async (userId: string): Promise<boolean> => {
  const rows = await query<{ verified: number }[]>('SELECT email_verified_at IS NOT NULL AS verified FROM users WHERE id = ?', [userId]);
  return rows[0].verified === 1;
};

describe('auth – email verification', () => {
  describe('operations', () => {
    it('verifies the user with a valid token (01-authentication.md – Email Verification)', async () => {
      // Arrange
      const userId = await createUnverifiedUser();
      const { token } = await createVerificationToken(userId);

      // Act
      const result = await verifyEmailToken(token);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await isVerified(userId)).toBe(true);
    });

    it('invalidates the earlier tokens when a new one is created (02-user-profile-and-privacy.md – Verification Status)', async () => {
      // Arrange
      const userId = await createUnverifiedUser();
      const first = await createVerificationToken(userId);
      await createVerificationToken(userId);

      // Act
      const result = await verifyEmailToken(first.token);

      // Assert
      expect(result.success).toBe(false);
      expect(await isVerified(userId)).toBe(false);
    });

    it('counts every token of the last hour towards the resend limit (02-user-profile-and-privacy.md – Verification Status)', async () => {
      // Arrange
      const userId = await createUnverifiedUser();
      await createVerificationToken(userId);
      await createVerificationToken(userId);
      await createVerificationToken(userId);

      // Act
      const count = await countRecentVerificationTokens(userId);

      // Assert
      expect(count).toBe(3);
    });
  });

  describe('rejects', () => {
    it('a token that was already used (01-authentication.md – Email Verification)', async () => {
      // Arrange
      const userId = await createUnverifiedUser();
      const { token } = await createVerificationToken(userId);
      await verifyEmailToken(token);

      // Act
      const result = await verifyEmailToken(token);

      // Assert
      expect(result.success).toBe(false);
    });

    it('a token older than 24 hours (01-authentication.md – Email Verification)', async () => {
      // Arrange
      const userId = await createUnverifiedUser();
      const { token } = await createVerificationToken(userId);
      await execute('UPDATE email_verification_tokens SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE token = ?', [token]);

      // Act
      const result = await verifyEmailToken(token);

      // Assert
      expect(result.success).toBe(false);
      expect(await isVerified(userId)).toBe(false);
    });
  });
});
