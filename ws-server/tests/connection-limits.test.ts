/**
 * Tests of the limits on WebSocket connections: same-origin pages only, and a message rate limit.
 * Spec Reference: 11-real-time-card-updates.md - WebSocket Server
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { connect, startServer, type RunningServer } from './support';

/**
 * Wait for a socket to close.
 * @param socket The socket
 * @returns The close code
 */
const closeCode = (socket: WebSocket): Promise<number> => new Promise((resolve) => socket.on('close', (code) => resolve(code)));

describe('connection limits', () => {
  let running: RunningServer;

  beforeEach(async () => {
    running = await startServer();
  });

  afterEach(async () => {
    await running.server.close();
  });

  describe('operations', () => {
    it('accepts a page of the same site (11-real-time-card-updates.md – WebSocket Server)', async () => {
      // Act
      const client = await connect(running.port, 'http://localhost');

      // Assert
      expect(client.socket.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe('rejects', () => {
    it('a page of another site (11-real-time-card-updates.md – WebSocket Server)', async () => {
      // Act
      const connection = connect(running.port, 'http://evil.example');

      // Assert
      await expect(connection).rejects.toThrow();
    });

    it('a client sending more than 30 messages in 10 seconds, closed with 1008 (11-real-time-card-updates.md – WebSocket Server)', async () => {
      // Arrange
      const client = await connect(running.port);
      const closed = closeCode(client.socket);

      // Act
      for (let index = 0; index < 31; index += 1) {
        client.socket.send(JSON.stringify({ type: 'noop' }));
      }

      // Assert
      expect(await closed).toBe(1008);
    });

    it('a message larger than 4 KB, closing the socket (11-real-time-card-updates.md – WebSocket Server)', async () => {
      // Arrange
      const client = await connect(running.port);
      const closed = closeCode(client.socket);

      // Act
      client.socket.send(JSON.stringify({ type: 'noop', padding: 'x'.repeat(5 * 1024) }));

      // Assert: 1009 is "message too big"
      expect(await closed).toBe(1009);
    });
  });
});
