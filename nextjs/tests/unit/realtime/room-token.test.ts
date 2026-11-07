/**
 * Unit tests for the signed token that lets a client join a WebSocket room.
 * Spec Reference: 11-real-time-card-updates.md - Joining a Room
 */

import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoomToken } from '@/lib/ws-token';

const SECRET = 'test-secret';
const NOW = new Date('2026-01-01T10:00:00.000Z');

/**
 * Split a token and decode its payload.
 * @param token The token
 * @returns The encoded payload, the signature and the decoded payload
 */
const parseToken = (token: string) => {
  const [payload, signature] = token.split('.');
  return { payload, signature, body: JSON.parse(Buffer.from(payload, 'base64url').toString()) };
};

describe('room token', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carries the room and expires after 5 minutes (11-real-time-card-updates.md – Joining a Room)', () => {
    // Act
    const token = createRoomToken({ type: 'card', id: 'game-1' }, SECRET);

    // Assert
    expect(parseToken(token).body).toEqual({ type: 'card', id: 'game-1', exp: NOW.getTime() + 5 * 60 * 1000 });
  });

  it('is signed with HMAC-SHA256 of the payload and the shared secret (11-real-time-card-updates.md – Joining a Room)', () => {
    // Act
    const { payload, signature } = parseToken(createRoomToken({ type: 'user', id: 'user-1' }, SECRET));

    // Assert
    expect(signature).toBe(createHmac('sha256', SECRET).update(payload).digest('base64url'));
  });
});
