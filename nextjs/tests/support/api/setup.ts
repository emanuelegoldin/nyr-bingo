/**
 * Vitest setup for the route tests: the DB harness, plus stand-ins for request cookies and email.
 * Spec Reference: 21-authorization.md - Status Rules
 *
 * Routes run unchanged. A test logs in by storing a real session token in the cookie jar,
 * so `withAuth` and `getCurrentUser` go through the same code as in production.
 * WS_SHARED_SECRET stays unset, so real-time signals are skipped.
 */

import { afterEach, vi } from 'vitest';
import '../db/setup';
import { clearCookies } from './cookie-jar';

vi.mock('next/headers', async () => {
  const { cookieJar } = await import('./cookie-jar');
  return { cookies: async () => cookieJar };
});

vi.mock('@/lib/email', () => ({
  deliverVerificationToken: vi.fn(async () => ({ emailConfigured: false, sent: false })),
}));

delete process.env.WS_SHARED_SECRET;

afterEach(() => {
  clearCookies();
});
