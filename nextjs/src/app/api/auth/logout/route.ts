/**
 * Authentication API - Logout
 * Spec Reference: 01-authentication.md
 */

import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/db';
import { cookies } from 'next/headers';
import { errorResponse } from '@/app/api/utils';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (sessionToken) {
      // Delete session from database
      await deleteSession(sessionToken);
    }

    // Clear session cookie
    cookieStore.delete('session_token');

    return NextResponse.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('An error occurred during logout', 500);
  }
}
