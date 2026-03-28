/**
 * Authentication API - Login
 * Spec Reference: 01-authentication.md - Login
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  findUserByEmail, 
  verifyPassword, 
  createSession 
} from '@/lib/db';
import { cookies } from 'next/headers';
import { errorResponse } from '@/app/api/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    // Find user by email
    const user = await findUserByEmail(email);

    // Spec: 01-authentication.md - Login with invalid credentials → reject
    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return errorResponse('Invalid email or password', 401);
    }

    // Note: We allow login for unverified users but they should complete verification
    // Spec: 01-authentication.md - Unverified email behavior is implementation choice

    // Create session
    // Spec: 01-authentication.md - System authenticates and issues a session
    const session = await createSession(user.id);

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('session_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('An error occurred during login', 500);
  }
}