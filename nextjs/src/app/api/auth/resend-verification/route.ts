/**
 * Authentication API - Resend Verification Email
 * Spec Reference: 01-authentication.md - Email Verification
 * 
 * Allows users to request a new verification email if their token expired
 */

import { NextRequest, NextResponse } from 'next/server';
import { countRecentVerificationTokens, createVerificationToken } from '@/lib/db';
import { deliverVerificationToken } from '@/lib/email';
import { errorResponse, withAuth, AuthContextNoParams } from '@/app/api/utils';

const MAX_VERIFICATION_EMAILS_PER_HOUR = 3;

/**
 * POST /api/auth/resend-verification - Resend verification email
 * Spec: 01-authentication.md - Expired/invalid verification token → allow re-send
 */
export const POST = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
    // Check if user is already verified
  if (currentUser.emailVerifiedAt !== null) {
    return errorResponse('Email is already verified', 400);
  }

  if (await countRecentVerificationTokens(currentUser.id) >= MAX_VERIFICATION_EMAILS_PER_HOUR) {
    return errorResponse('Too many verification emails. Please try again later.', 429);
  }

  // Create a new verification token
  const verificationToken = await createVerificationToken(currentUser.id);

  // Send verification email
  const { emailConfigured, sent } = await deliverVerificationToken(
    currentUser.email,
    currentUser.username,
    verificationToken.token
  );

  if (!emailConfigured) {
    const response: { message: string; verificationToken?: string } = {
      message: 'Verification email would be sent. Check console for token (dev mode).',
    };

    // Include token in response for development
    if (process.env.NODE_ENV !== 'production') {
      response.verificationToken = verificationToken.token;
    }

    return NextResponse.json(response);
  }

  if (!sent) {
    return errorResponse('Failed to send verification email. Please try again later.', 500);
  }

  return NextResponse.json({
    message: 'Verification email sent successfully. Please check your inbox.',
  });
});