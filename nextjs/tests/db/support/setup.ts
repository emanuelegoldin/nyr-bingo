/**
 * Vitest setup for every DB test file: swaps lib/db/connection for the test connection
 * and wraps each test in a transaction that is rolled back afterwards.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import {
  beginTestTransaction,
  closeTestConnection,
  openTestConnection,
  rollbackTestTransaction,
} from './test-connection';

// Every repository reaches the DB through this module, so the whole data layer runs on the test connection
vi.mock('@/lib/db/connection', () => import('./test-connection'));

beforeAll(async () => {
  await openTestConnection();
});

beforeEach(async () => {
  await beginTestTransaction();
});

afterEach(async () => {
  await rollbackTestTransaction();
});

afterAll(async () => {
  await closeTestConnection();
});
