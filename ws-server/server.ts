import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { JoinRoomMessage } from './messages/join-room';
import { RoomNotification } from './messages/notification';
console.log('Starting WebSocket server on port', process.env.WS_PORT);
const WS_PORT: number = parseInt(process.env.WS_PORT || '8888', 10);
const WS_SHARED_SECRET = process.env.WS_SHARED_SECRET;
if (!WS_SHARED_SECRET) {
  console.error('WS_SHARED_SECRET is required');
  process.exit(1);
}
const MAX_NOTIFY_BODY_BYTES = 64 * 1024;
const MAX_CLIENT_MESSAGE_BYTES = 4 * 1024;
const MAX_ROOMS_PER_SOCKET = 256;
const MAX_MESSAGES_PER_WINDOW = 30;
const RATE_WINDOW_MS = 10 * 1000;
const CLOSE_POLICY_VIOLATION = 1008;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

const httpServer = createServer(handleHttpRequest);
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_CLIENT_MESSAGE_BYTES,
  verifyClient: ({ origin, req }: { origin?: string; req: IncomingMessage }) => isSameOrigin(origin, req.headers.host),
});
httpServer.listen(WS_PORT);

const rooms = new Map<string, Set<WebSocket>>();
const socketRooms = new WeakMap<WebSocket, Set<string>>();
const socketRates = new WeakMap<WebSocket, { windowStart: number; count: number }>();
const liveSockets = new WeakSet<WebSocket>();

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
setInterval(() => {
  for (const ws of wss.clients) {
    if (!liveSockets.has(ws)) {
      ws.terminate();
      continue;
    }
    liveSockets.delete(ws);
    ws.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

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

/**
 * Compare a request header with the shared secret in constant time.
 * @param header - The value of the x-ws-secret header
 * @returns True if it matches
 */
function isSharedSecret(header: string | string[] | undefined): boolean {
  if (typeof header !== 'string') return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header), digest(WS_SHARED_SECRET as string));
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
      && (item.type === 'card' || item.type === 'thread' || item.type === 'resolution' || item.type === 'user')
    );
    return isValid ? parsed as RoomNotification[] : null;
  } catch {
    return null;
  }
}

/**
 * Tell the viewers of a room to refetch.
 * @param notification - The room that changed
 */
function deliverNotification(room: RoomNotification) {
  const { type, id } = room;
  if (type === 'card') broadcastToRoom(roomKey(room), { type: 'refresh-card' });
  if (type === 'thread') broadcastToRoom(roomKey(room), { type: 'refresh-thread', threadId: id });
  if (type === 'resolution') broadcastToRoom(roomKey(room), { type: 'refresh-resolution', resolutionId: id });
  if (type === 'user') broadcastToRoom(roomKey(room), { type: 'refresh-notifications' });
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
 * Check a join token signed by the Next.js server.
 * @param token - The token, as `<base64url payload>.<base64url signature>`
 * @returns The room it grants, or null if it is invalid or expired
 */
function verifyRoomToken(token: unknown): RoomNotification | null {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = createHmac('sha256', WS_SHARED_SECRET as string).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  const { type, id, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return Date.now() < exp ? { type, id } : null;
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