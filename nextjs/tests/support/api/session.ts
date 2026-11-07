/**
 * Log a fixture user in or out for a route test.
 * Spec Reference: 01-authentication.md - Login
 */

import { createSession } from '@/lib/db/user-repository';
import type { UserFixture } from '../db/fixtures';
import { clearCookies, cookieJar } from './cookie-jar';

/**
 * Log a user in: create a real session and store its token as the session cookie.
 * @param user The user
 */
export const signInAs = async (user: UserFixture): Promise<void> => {
  const session = await createSession(user.id);
  cookieJar.set('session_token', session.token);
};

/** Log out: drop every cookie. */
export const signOut = (): void => {
  clearCookies();
};
