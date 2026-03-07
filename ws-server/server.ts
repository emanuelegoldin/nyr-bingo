import { WebSocketServer, WebSocket } from 'ws';
import { ThreadRefreshMessage } from './messages/thread-message';
import { JoinThreadMessage } from './messages/join-thread';
import { JoinCardRoomMessage, CardRefreshMessage } from './messages/card-message';
import { JoinResolutionRoomMessage, ResolutionRefreshMessage } from './messages/resolution-message';
console.log('Starting WebSocket server on port', process.env.WS_PORT);
const WS_PORT: number = parseInt(process.env.WS_PORT || '8888', 10);
const wss = new WebSocketServer({ port: WS_PORT });

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