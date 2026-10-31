import { createHash, timingSafeEqual } from 'crypto';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ThreadRefreshMessage } from './messages/thread-message';
import { JoinThreadMessage } from './messages/join-thread';
import { JoinCardRoomMessage, CardRefreshMessage } from './messages/card-message';
import { RoomNotification } from './messages/notification';
import { JoinResolutionRoomMessage, ResolutionRefreshMessage } from './messages/resolution-message';
console.log('Starting WebSocket server on port', process.env.WS_PORT);
const WS_PORT: number = parseInt(process.env.WS_PORT || '8888', 10);
const WS_SHARED_SECRET = process.env.WS_SHARED_SECRET;
if (!WS_SHARED_SECRET) {
  console.error('WS_SHARED_SECRET is required');
  process.exit(1);
}
const MAX_NOTIFY_BODY_BYTES = 64 * 1024;

const httpServer = createServer(handleHttpRequest);
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(WS_PORT);

const rooms = new Map<string, Set<WebSocket>>();
const socketRooms = new WeakMap<WebSocket, Set<string>>();

wss.on('connection', function connection(ws) {
  console.log('New client connected');
  ws.on('error', console.error);

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
    let message: unknown;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (!message || typeof message !== 'object') return;
    const msgType = (message as { type?: unknown }).type;
    if (typeof msgType !== 'string') return;

    if (msgType === 'join-thread') {
      const { threadId } = (message as JoinThreadMessage).body ?? {};
      if (!threadId || typeof threadId !== 'string') return;
      joinRoom(threadId, ws);
      return;
    }

    if (msgType === 'thread-refresh') {
      const { threadId } = (message as ThreadRefreshMessage).body ?? {};
      if (!threadId || typeof threadId !== 'string') return;

      // joinRoom(threadId, ws);
      broadcastToRoom(threadId, { type: 'refresh-thread' }, ws);
    }

    // ── Card-level rooms (keyed by teamId) ────────────────────────
    if (msgType === 'join-card-room') {
      const { teamId } = (message as JoinCardRoomMessage).body ?? {};
      if (!teamId || typeof teamId !== 'string') return;
      joinRoom(`card:${teamId}`, ws);
      return;
    }

    if (msgType === 'card-refresh') {
      const { teamId } = (message as CardRefreshMessage).body ?? {};
      if (!teamId || typeof teamId !== 'string') return;
      broadcastToRoom(`card:${teamId}`, { type: 'refresh-card' }, ws);
    }

    // ── Resolution-level rooms (keyed by resolutionId) ────────────
    if (msgType === 'join-resolution-room') {
      const { resolutionId } = (message as JoinResolutionRoomMessage).body ?? {};
      if (!resolutionId || typeof resolutionId !== 'string') return;
      joinRoom(`resolution:${resolutionId}`, ws);
      return;
    }

    if (msgType === 'resolution-refresh') {
      const { resolutionId } = (message as ResolutionRefreshMessage).body ?? {};
      if (!resolutionId || typeof resolutionId !== 'string') return;
      broadcastToRoom(
        `resolution:${resolutionId}`,
        { type: 'refresh-resolution', resolutionId },
        ws
      );
    }
  });
});

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
      && (item.type === 'card' || item.type === 'thread' || item.type === 'resolution')
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
function deliverNotification({ type, id }: RoomNotification) {
  if (type === 'card') broadcastToRoom(`card:${id}`, { type: 'refresh-card' });
  if (type === 'thread') broadcastToRoom(id, { type: 'refresh-thread' });
  if (type === 'resolution') broadcastToRoom(`resolution:${id}`, { type: 'refresh-resolution', resolutionId: id });
}

function joinRoom(roomId: string, ws: WebSocket) {
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
 * Broadcast a message to all sockets in a room, optionally excluding one.
 * @param roomId  - The room identifier (e.g. `card:<teamId>`, `resolution:<id>`)
 * @param payload - The JSON-serialisable object to send to each client
 * @param exceptSocket - Optional socket to exclude (the sender)
 */
function broadcastToRoom(
  roomId: string,
  payload: Record<string, unknown>,
  exceptSocket: WebSocket | null = null
) {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN && client !== exceptSocket) {
      client.send(data);
    }
  }
}