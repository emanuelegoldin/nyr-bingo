/**
 * Route tests for getting a token to join a WebSocket room.
 * Spec Reference: 11-real-time-card-updates.md - Joining a Room
 */

import { afterEach, describe, expect, it } from 'vitest';
import { GET as getToken } from '@/app/api/ws-token/route';
import { createTeam, createUser } from '../../support/db/fixtures';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

describe('realtime – ws token', () => {
  afterEach(() => {
    delete process.env.WS_SHARED_SECRET;
  });

  describe('operations', () => {
    it('gives a team member a token for the team\'s card room (11-real-time-card-updates.md – Joining a Room)', async () => {
      // Arrange
      process.env.WS_SHARED_SECRET = 'test-secret';
      const user = await createUser();
      const team = await createTeam(user);
      await signInAs(user);

      // Act
      const result = await callRoute<{ token: string }>(getToken, { search: `type=card&id=${team.id}` });

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.token).toMatch(/^[\w-]+\.[\w-]+$/);
    });
  });

  describe('rejects', () => {
    it('any room when live updates are not configured, with 503 (11-real-time-card-updates.md – Joining a Room)', async () => {
      // Arrange
      const user = await createUser();
      await signInAs(user);

      // Act
      const result = await callRoute(getToken, { search: `type=user&id=${user.id}` });

      // Assert
      expect(result.status).toBe(503);
    });

    it('another user\'s notification room, with 403 (11-real-time-card-updates.md – Joining a Room)', async () => {
      // Arrange
      process.env.WS_SHARED_SECRET = 'test-secret';
      const other = await createUser();
      await signInAs(await createUser());

      // Act
      const result = await callRoute(getToken, { search: `type=user&id=${other.id}` });

      // Assert
      expect(result.status).toBe(403);
    });

    it('the card room of a team the user is not in, with 403 (11-real-time-card-updates.md – Joining a Room)', async () => {
      // Arrange
      process.env.WS_SHARED_SECRET = 'test-secret';
      const team = await createTeam(await createUser());
      await signInAs(await createUser());

      // Act
      const result = await callRoute(getToken, { search: `type=card&id=${team.id}` });

      // Assert
      expect(result.status).toBe(403);
    });
  });
});
