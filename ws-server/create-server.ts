/**
 * Builds the WebSocket server: rooms joined with signed tokens, and the internal notify endpoint.
 * The notify endpoint tells a room's viewers to refetch. A factory, so tests can start one on any port.
 * Spec Reference: 11-real-time-card-updates.md - WebSocket Server, Joining a Room, WebSocket Messages
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { WebSocketServer, WebSocket } from 'ws';
import { JoinRoomMessage } from './messages/join-room';
import { RoomNotification } from './messages/notification';

const MAX_NOTIFY_BODY_BYTES = 64 * 1024;
const MAX_CLIENT_MESSAGE_BYTES = 4 * 1024;
const MAX_ROOMS_PER_SOCKET = 256;
const MAX_MESSAGES_PER_WINDOW = 30;
const RATE_WINDOW_MS = 10 * 1000;
const CLOSE_POLICY_VIOLATION = 1008;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** Settings of one server. */
export interface WsServerOptions {
  /** The secret shared with the Next.js server, for the notify endpoint and room tokens */
  secret: string;
  /** How often unanswered sockets are dropped and the others pinged (default 30 s) */
  heartbeatMs?: number;
}

/** A created server, not yet listening. */
export interface WsServer {
  httpServer: Server;
  wss: WebSocketServer;
  /**
   * Start listening.
   * @param port The port; 0 picks a free one
   * @returns The port it listens on
   */
  listen: (port: number) => Promise<number>;
  /** Stop the heartbeat, drop every socket and stop listening. */
  close: () => Promise<void>;
}

/**
 * Build a WebSocket server with its rooms and internal notify endpoint.
 * @param options The shared secret and heartbeat interval
 * @returns The server, ready to listen
 */
export function createWsServer({ secret, heartbeatMs = DEFAULT_HEARTBEAT_INTERVAL_MS }: WsServerOptions): WsServer {
  const rooms = new Map<string, Set<WebSocket>>();
  const socketRooms = new WeakMap<WebSocket, Set<string>>();
  const socketRates = new WeakMap<WebSocket, { windowStart: number; count: number }>();
  const liveSockets = new WeakSet<WebSocket>();

  /**
   * Compare a request header with the shared secret in constant time.
   * @param header - The value of the x-ws-secret header
   * @returns True if it matches
   */
  function isSharedSecret(header: string | string[] | undefined): boolean {
    if (typeof header !== 'string') return false;
    const digest = (value: string) => createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(header), digest(secret));
  }

  /**
   * Check a join token signed by the Next.js server.
   * @param token - The token, as `<base64url payload>.<base64url signature>`
   * @returns The room it grants, or null if it is invalid or expired
   */
  function verifyRoomToken(token: unknown): RoomNotification | null {
    if (typeof token !== 'string') return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expected = createHmac('sha256', secret).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

    const { type, id, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Date.now() < exp ? { type, id } : null;
  }

  /**
   * Count a message against the socket's rate window.
   * @param ws - The socket that sent the message
   * @returns True if the socket has sent too many messages
   */
  function isOverRateLimit(ws: WebSocket): boolean {
    const now = Date.now();
    const rate = socketRates.get(ws);
    if (!rate || now - rate.windowStart > RATE_WINDOW_MS) {
      socketRates.set(ws, { windowStart: now, count: 1 });
      return false;
    }
    rate.count += 1;
    return rate.count > MAX_MESSAGES_PER_WINDOW;
  }

  /**
   * Add a socket to a room, up to the per-socket room limit.
   * @param roomId - The room key (see roomKey)
   * @param ws - The socket joining
   */
  function joinRoom(roomId: string, ws: WebSocket) {
    if ((socketRooms.get(ws)?.size ?? 0) >= MAX_ROOMS_PER_SOCKET) return;

    let room = rooms.get(roomId);
    if (!room) {
      room = new Set<WebSocket>();
      rooms.set(roomId, room);
    }
    room.add(ws);

    let joinedRooms = socketRooms.get(ws);
    if (!joinedRooms) {
      joinedRooms = new Set<string>();
      socketRooms.set(ws, joinedRooms);
    }
    joinedRooms.add(roomId);
  }

  /**
   * Broadcast a message to all sockets in a room.
   * @param roomId  - The room key (see roomKey)
   * @param payload - The JSON-serialisable object to send to each client
   */
  function broadcastToRoom(roomId: string, payload: Record<string, unknown>) {
    const room = rooms.get(roomId);
    if (!room) return;

    const data = JSON.stringify(payload);
    for (const client of room) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Tell the viewers of a room to refetch.
   * @param room - The room that changed
   */
  function deliverNotification(room: RoomNotification) {
    const { type, id } = room;
    if (type === 'card') broadcastToRoom(roomKey(room), { type: 'refresh-card' });
    if (type === 'thread') broadcastToRoom(roomKey(room), { type: 'refresh-thread', threadId: id });
    if (type === 'user') broadcastToRoom(roomKey(room), { type: 'refresh-notifications' });
  }

  /**
   * Serve the internal notify endpoint. Nginx only proxies /ws, so this is reachable
   * from the Next.js server but not from the internet.
   * @param request - The incoming HTTP request
   * @param response - The response to write
   */
  function handleHttpRequest(request: IncomingMessage, response: ServerResponse) {
    if (request.method !== 'POST' || request.url !== '/internal/notify') {
      response.writeHead(404).end();
      return;
    }
    if (!isSharedSecret(request.headers['x-ws-secret'])) {
      response.writeHead(401).end();
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_NOTIFY_BODY_BYTES) {
        response.writeHead(413).end();
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      const notifications = parseNotifications(Buffer.concat(chunks).toString());
      if (!notifications) {
        response.writeHead(400).end();
        return;
      }
      notifications.forEach(deliverNotification);
      response.writeHead(204).end();
    });
  }

  const httpServer = createServer(handleHttpRequest);
  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: MAX_CLIENT_MESSAGE_BYTES,
    verifyClient: ({ origin, req }: { origin?: string; req: IncomingMessage }) => isSameOrigin(origin, req.headers.host),
  });

  wss.on('connection', function connection(ws) {
    console.log('New client connected');
    ws.on('error', console.error);
    liveSockets.add(ws);
    ws.on('pong', () => liveSockets.add(ws));

    ws.on('close', () => {
      const joinedRooms = socketRooms.get(ws);
      if (!joinedRooms) return;
      for (const roomId of joinedRooms) {
        const room = rooms.get(roomId);
        if (!room) continue;
        room.delete(ws);
        if (room.size === 0) rooms.delete(roomId);
      }
      socketRooms.delete(ws);
    });

    ws.on('message', function message(data) {
      if (isOverRateLimit(ws)) {
        ws.close(CLOSE_POLICY_VIOLATION);
        return;
      }

      let message: unknown;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (!message || typeof message !== 'object') return;
      const msgType = (message as { type?: unknown }).type;
      if (typeof msgType !== 'string') return;

      if (msgType === 'join-room') {
        const room = verifyRoomToken((message as JoinRoomMessage).token);
        if (room) joinRoom(roomKey(room), ws);
      }
    });
  });

  // Drop sockets that stopped answering, so their browsers reconnect
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!liveSockets.has(ws)) {
        ws.terminate();
        continue;
      }
      liveSockets.delete(ws);
      ws.ping();
    }
  }, heartbeatMs);

  const listen = (port: number): Promise<number> =>
    new Promise((resolve) => {
      httpServer.listen(port, () => resolve((httpServer.address() as AddressInfo).port));
    });

  const close = (): Promise<void> =>
    new Promise((resolve) => {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close(() => httpServer.close(() => resolve()));
    });

  return { httpServer, wss, listen, close };
}

/**
 * Parse and validate the body of a notify request.
 * @param body - The raw JSON body
 * @returns The notifications, or null if the body is invalid
 */
function parseNotifications(body: string): RoomNotification[] | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!Array.isArray(parsed)) return null;
    const isValid = parsed.every((item: Partial<RoomNotification> | null) =>
      typeof item?.id === 'string'
      && (item.type === 'card' || item.type === 'thread' || item.type === 'user')
    );
    return isValid ? parsed as RoomNotification[] : null;
  } catch {
    return null;
  }
}

/**
 * Build the key of a room. The prefix keeps the kinds of room apart.
 * @param room - The room
 * @returns The key used in the rooms map
 */
function roomKey({ type, id }: RoomNotification): string {
  return `${type}:${id}`;
}

/**
 * Reject pages of other sites. A request without an Origin is not from a browser page,
 * and still needs a signed token to join anything.
 * @param origin - The Origin header
 * @param host - The Host header
 * @returns True if the connection is allowed
 */
function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    // Hostnames only: Nginx forwards a Host without the port
    return new URL(origin).hostname === host?.split(':')[0];
  } catch {
    return false;
  }
}
