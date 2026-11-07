/**
 * Route tests for registration input checks.
 * Spec Reference: 01-authentication.md - Registration
 */

import { describe, expect, it } from 'vitest';
import { POST as register } from '@/app/api/auth/register/route';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';

const VALID = { username: 'alice', email: 'alice@test.local', password: 'password123' };

describe('auth – register', () => {
  describe('operations', () => {
    it('creates the account with 201 (01-authentication.md – Registration)', async () => {
      // Act
      const result = await callRoute(register, { method: 'POST', body: VALID });

      // Assert
      expect(result.status).toBe(201);
      expect(await countRows('users', 'username = ? AND email_verified_at IS NULL', ['alice'])).toBe(1);
    });
  });

  describe('rejects', () => {
    it.each(['username', 'email', 'password'])('a request without %s, with 400 (01-authentication.md – Registration)', async (field) => {
      // Arrange
      const body: Record<string, string> = { ...VALID };
      delete body[field];

      // Act
      const result = await callRoute(register, { method: 'POST', body });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('users', 'email = ?', [VALID.email])).toBe(0);
    });

    it('a password shorter than 8 characters, with 400 (01-authentication.md – Registration)', async () => {
      // Act
      const result = await callRoute(register, { method: 'POST', body: { ...VALID, password: '1234567' } });

      // Assert
      expect(result.status).toBe(400);
    });

    it('an email with an invalid format, with 400 (01-authentication.md – Registration)', async () => {
      // Act
      const result = await callRoute(register, { method: 'POST', body: { ...VALID, email: 'not-an-email' } });

      // Assert
      expect(result.status).toBe(400);
    });

    it('a username that is taken, with 409 (01-authentication.md – Registration)', async () => {
      // Arrange
      await createUser({ username: VALID.username });

      // Act
      const result = await callRoute(register, { method: 'POST', body: VALID });

      // Assert
      expect(result.status).toBe(409);
    });

    it('an email that is taken, with 409 (01-authentication.md – Registration)', async () => {
      // Arrange
      await createUser({ email: VALID.email });

      // Act
      const result = await callRoute(register, { method: 'POST', body: VALID });

      // Assert
      expect(result.status).toBe(409);
    });
  });
});
