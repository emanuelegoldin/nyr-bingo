/**
 * Entry point of the WebSocket server: reads the environment and starts listening.
 * Spec Reference: 11-real-time-card-updates.md - WebSocket Server
 */

import { createWsServer } from './create-server';

console.log('Starting WebSocket server on port', process.env.WS_PORT);
const WS_PORT: number = parseInt(process.env.WS_PORT || '8888', 10);
const WS_SHARED_SECRET = process.env.WS_SHARED_SECRET;
if (!WS_SHARED_SECRET) {
  console.error('WS_SHARED_SECRET is required');
  process.exit(1);
}

void createWsServer({ secret: WS_SHARED_SECRET }).listen(WS_PORT);
