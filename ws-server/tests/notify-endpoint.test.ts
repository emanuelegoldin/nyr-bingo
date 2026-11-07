/**
 * Tests of the internal notify endpoint the Next.js server calls.
 * Spec Reference: 11-real-time-card-updates.md - WebSocket Server
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { notify, startServer, type RunningServer } from './support';

describe('notify endpoint', () => {
  let running: RunningServer;

  beforeEach(async () => {
    running = await startServer();
  });

  afterEach(async () => {
    await running.server.close();
  });

  describe('operations', () => {
    it('accepts a list of rooms with 204 (11-real-time-card-updates.md – WebSocket Server)', async () => {
      // Act
      const status = await notify(running.port, [{ type: 'card', id: 'team-1' }, { type: 'user', id: 'user-1' }]);

      // Assert
      expect(status).toBe(204);
    });
  });

  describe('rejects', () => {
    it('a wrong shared secret, with 401 (11-real-time-card-updates.md – WebSocket Server)', async () => {
      // Act
      const status = await notify(running.port, [{ type: 'card', id: 'team-1' }], { secret: 'wrong' });

      // Assert
      expect(status).toBe(401);
    });

    it('a request without the shared secret, with 401 (11-real-time-card-updates.md – WebSocket Server)', async () => {
      // Act
      const status = await notify(running.port, [{ type: 'card', id: 'team-1' }], { secret: null });

      // Assert
      expect(status).toBe(401);
    });

    it('any other path, with 404 (11-real-time-card-updates.md – WebSocket Server)', async () => {
      // Act
      const status = await notify(running.port, [], { path: '/notify' });

      // Assert
      expect(status).toBe(404);
    });

    it.each([
      ['not JSON', 'nope'],
      ['an object instead of a list', { type: 'card', id: 'team-1' }],
      ['an unknown room type', [{ type: 'team', id: 'team-1' }]],
      ['a room without an id', [{ type: 'card' }]],
    ])('a body that is %s, with 400 (11-real-time-card-updates.md – WebSocket Server)', async (_case, body) => {
      // Act
      const status = await notify(running.port, body);

      // Assert
      expect(status).toBe(400);
    });
  });
});
