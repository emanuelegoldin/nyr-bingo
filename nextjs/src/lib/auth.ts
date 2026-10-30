/**
 * Authentication Utility
 * Helper functions for authentication in API routes
 * Spec Reference: 01-authentication.md - Access Control
 */

import { findSessionByToken, findUserById } from '@/lib/db';
import type { User } from '@/lib/db/types';
import { cookies } from 'next/headers';

/**
 * Get the current authenticated user from the session
 * Spec: 01-authentication.md - Authentication required for any user-specific operations
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return null;
    }

    const session = await findSessionByToken(sessionToken);
    if (!session) {
      return null;
    }

    const user = await findUserById(session.userId);
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Check if user is verified
 * Returns true if user has verified their email
 */
export function isUserVerified(user: User): boolean {
  return user.emailVerifiedAt !== null;
}
