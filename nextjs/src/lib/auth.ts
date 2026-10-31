/**
 * Authentication Utility
 * Helper functions for authentication in API routes
 * Spec Reference: 01-authentication.md - Access Control
 */

import { findSessionByToken, findUserById } from '@/lib/db';
import type { User } from '@/lib/db/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Get the current authenticated user from the session
 * Spec: 01-authentication.md - Authentication required for any user-specific operations
 * Database errors propagate, so an outage is not mistaken for being logged out.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await findSessionByToken(sessionToken);
  if (!session) {
    return null;
  }

  return findUserById(session.userId);
}

/**
 * Get the current user for a server page, redirecting to login when there is none
 * @returns The authenticated user
 */
export async function requireUser(): Promise<User> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/login');
  }
  return currentUser;
}

/**
 * Check if user is verified
 * Returns true if user has verified their email
 */
export function isUserVerified(user: User): boolean {
  return user.emailVerifiedAt !== null;
}
