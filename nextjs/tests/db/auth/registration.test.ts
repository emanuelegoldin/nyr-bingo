/**
 * DB tests for creating a user at registration.
 * Spec Reference: 01-authentication.md - Registration
 */

import { describe, expect, it } from 'vitest';
import { checkUserExists, createUser } from '@/lib/db/user-repository';
import { createUser as seedUser } from '../../support/db/fixtures';
import { query } from '../../support/db/test-connection';

describe('auth – registration', () => {
  describe('operations', () => {
    it('creates the user unverified (01-authentication.md – Registration)', async () => {
      // Act
      const user = await createUser('alice', 'alice@test.local', 'password123');

      // Assert
      const rows = await query<{ email_verified_at: Date | null }[]>('SELECT email_verified_at FROM users WHERE id = ?', [user.id]);
      expect(rows).toEqual([{ email_verified_at: null }]);
    });

    it('creates a default profile whose display name is the username (01-authentication.md – Registration)', async () => {
      // Act
      const user = await createUser('alice', 'alice@test.local', 'password123');

      // Assert
      const rows = await query<{ display_name: string }[]>('SELECT display_name FROM user_profiles WHERE user_id = ?', [user.id]);
      expect(rows).toEqual([{ display_name: 'alice' }]);
    });
  });

  describe('rejects', () => {
    it('a username or email that is already taken (01-authentication.md – Registration)', async () => {
      // Arrange
      const existing = await seedUser();

      // Act
      const result = await checkUserExists(existing.username, existing.email);

      // Assert
      expect(result).toEqual({ usernameExists: true, emailExists: true });
    });
  });
});
