/**
 * Tests of joining rooms with signed tokens and of what each room is told on a change.
 * Spec Reference: 11-real-time-card-updates.md - Room Model, Joining a Room, WebSocket Messages
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connect, joinAndConfirm, notify, signToken, startServer, type RunningServer } from './support';

describe('rooms', () => {
  let running: RunningServer;

  beforeEach(async () => {
    running = await startServer();
  });

  afterEach(async () => {
    await running.server.close();
  });

  describe('operations', () => {
    it('tells a card room to refresh the cards (11-real-time-card-updates.md – WebSocket Messages)', async () => {
      // Arrange
      const client = await connect(running.port);

      // Act
      const message = await joinAndConfirm(client, running.port, { type: 'card', id: 'team-1' });

      // Assert
      expect(message).toEqual({ type: 'refresh-card' });
    });

    it('tells a thread room which thread to refresh (11-real-time-card-updates.md – WebSocket Messages)', async () => {
      // Arrange
      const client = await connect(running.port);

      // Act
      const message = await joinAndConfirm(client, running.port, { type: 'thread', id: 'thread-1' });

      // Assert
      expect(message).toEqual({ type: 'refresh-thread', threadId: 'thread-1' });
    });

    it('tells a user room to refresh the notifications (11-real-time-card-updates.md – WebSocket Messages)', async () => {
      // Arrange
      const client = await connect(running.port);

      // Act
      const message = await joinAndConfirm(client, running.port, { type: 'user', id: 'user-1' });

      // Assert
      expect(message).toEqual({ type: 'refresh-notifications' });
    });

    it('signals only the sockets in the changed room (11-real-time-card-updates.md – Room Model)', async () => {
      // Arrange
      const [inRoom, elsewhere] = [await connect(running.port), await connect(running.port)];
      await joinAndConfirm(inRoom, running.port, { type: 'card', id: 'team-1' });
      await joinAndConfirm(elsewhere, running.port, { type: 'card', id: 'team-2' });

      // Act
      await notify(running.port, [{ type: 'card', id: 'team-1' }, { type: 'thread', id: 'thread-x' }]);

      // Assert
      expect(await inRoom.nextMessage()).toEqual({ type: 'refresh-card' });
      expect(await elsewhere.nextMessage(100)).toBeNull();
    });
  });

  describe('rejects', () => {
    it.each([
      ['signed with another secret', signToken({ type: 'card', id: 'team-1' }, { secret: 'other-secret' })],
      ['expired', signToken({ type: 'card', id: 'team-1' }, { expiresInMs: -1000 })],
      ['malformed', 'not-a-token'],
    ])('a join token that is %s (11-real-time-card-updates.md – Joining a Room)', async (_case, token) => {
      // Arrange
      const client = await connect(running.port);
      client.join(token);
      await joinAndConfirm(client, running.port, { type: 'user', id: 'control' });

      // Act: the refused room is signalled before the control room
      await notify(running.port, [{ type: 'card', id: 'team-1' }, { type: 'user', id: 'control' }]);

      // Assert
      expect(await client.nextMessage()).toEqual({ type: 'refresh-notifications' });
    });
  });
});
