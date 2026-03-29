/**
 * Authentication API - Email Verification
 * Spec Reference: 01-authentication.md - Email Verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/db';
import { errorResponse } from '@/app/api/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return errorResponse('Verification token is required', 400);
    }

    // Verify the token
    // Spec: 01-authentication.md - User clicks verification link, System marks user as verified
    const result = await verifyEmailToken(token);

    if (!result.success) {
      // Spec: 01-authentication.md - Expired/invalid verification token → show failure
      return errorResponse(result.error, 400);
    }

    return NextResponse.json({
      message: 'Email verified successfully. You can now login.',
    });
  } catch (error) {
    console.error('Verification error:', error);
    return errorResponse('An error occurred during verification', 500);
  }
}
