/**
 * Test helpers for the WebSocket server: a server on a free port, signed tokens, clients and notify calls.
 * Spec Reference: 11-real-time-card-updates.md - Joining a Room, WebSocket Messages
 */

import { createHmac } from 'crypto';
import { WebSocket } from 'ws';
import { createWsServer, type WsServer } from '../create-server';
import type { RoomNotification } from '../messages/notification';

export const SECRET = 'test-secret';

/** A server listening on a free port. */
export interface RunningServer {
  server: WsServer;
  port: number;
}

/**
 * Start a server on a free port, with the heartbeat out of the way.
 * @returns The server and its port
 */
export const startServer = async (): Promise<RunningServer> => {
  const server = createWsServer({ secret: SECRET, heartbeatMs: 60 * 60 * 1000 });
  const port = await server.listen(0);
  return { server, port };
};

/**
 * Sign a room token the way the Next.js server does (base64url JSON payload + HMAC-SHA256).
 * @param room The room
 * @param options The secret (default the server's) and the lifetime left in ms (default 5 minutes)
 * @returns The token
 */
export const signToken = (room: RoomNotification, options: { secret?: string; expiresInMs?: number } = {}): string => {
  const payload = Buffer.from(JSON.stringify({ ...room, exp: Date.now() + (options.expiresInMs ?? 5 * 60 * 1000) })).toString('base64url');
  const signature = createHmac('sha256', options.secret ?? SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

/** A connected client that queues what it receives. */
export interface TestClient {
  socket: WebSocket;
  /** Wait for the next message, or null after the timeout */
  nextMessage: (timeoutMs?: number) => Promise<Record<string, unknown> | null>;
  /** Ask to join the room a token names */
  join: (token: string) => void;
}

/**
 * Connect a client to the server.
 * @param port The server's port
 * @param origin The Origin header to send, if any
 * @returns The open client
 */
export const connect = (port: number, origin?: string): Promise<TestClient> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${port}`, origin ? { origin } : {});
    const queue: Record<string, unknown>[] = [];
    const waiters: ((message: Record<string, unknown>) => void)[] = [];
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as Record<string, unknown>;
      const waiter = waiters.shift();
      if (waiter) waiter(message);
      else queue.push(message);
    });
    socket.on('open', () =>
      resolve({
        socket,
        join: (token) => socket.send(JSON.stringify({ type: 'join-room', token })),
        nextMessage: (timeoutMs = 200) =>
          new Promise((resolveMessage) => {
            const queued = queue.shift();
            if (queued) return resolveMessage(queued);
            const timer = setTimeout(() => {
              waiters.splice(waiters.indexOf(waiter), 1);
              resolveMessage(null);
            }, timeoutMs);
            const waiter = (message: Record<string, unknown>) => {
              clearTimeout(timer);
              resolveMessage(message);
            };
            waiters.push(waiter);
          }),
      })
    );
    socket.on('error', reject);
  });

/**
 * Call the internal notify endpoint.
 * @param port The server's port
 * @param body The request body (sent as JSON unless it is a string)
 * @param options The secret header (default the server's; null sends none) and the path
 * @returns The HTTP status
 */
export const notify = async (
  port: number,
  body: unknown,
  options: { secret?: string | null; path?: string } = {}
): Promise<number> => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const secret = options.secret === undefined ? SECRET : options.secret;
  if (secret !== null) headers['x-ws-secret'] = secret;
  const response = await fetch(`http://localhost:${port}${options.path ?? '/internal/notify'}`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return response.status;
};

/**
 * Join a room and wait until the server has processed the join: notify the room until the
 * client hears it. Messages on one socket are handled in order, so every earlier message of
 * this client has been handled too.
 * @param client The client
 * @param port The server's port
 * @param room The room to join
 * @returns The first message the room delivered
 */
export const joinAndConfirm = async (client: TestClient, port: number, room: RoomNotification): Promise<Record<string, unknown>> => {
  client.join(signToken(room));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await notify(port, [room]);
    const message = await client.nextMessage(50);
    if (message) return message;
  }
  throw new Error(`Never joined ${room.type}:${room.id}`);
};
