/**
 * Authentication API - Resend Verification Email
 * Spec Reference: 01-authentication.md - Email Verification
 * 
 * Allows users to request a new verification email if their token expired
 */

import { NextRequest, NextResponse } from 'next/server';
import { createVerificationToken, User } from '@/lib/db';
import { sendVerificationEmail, isEmailConfigured } from '@/lib/email';
import { errorResponse, withAuth, AuthContextNoParams } from '@/app/api/utils';

/**
 * POST /api/auth/resend-verification - Resend verification email
 * Spec: 01-authentication.md - Expired/invalid verification token → allow re-send
 */
export const POST = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
    // Check if user is already verified
  if (currentUser.emailVerifiedAt !== null) {
    return errorResponse('Email is already verified', 400);
  }

  // Create a new verification token
  const verificationToken = await createVerificationToken(currentUser.id);

  // Send verification email
  if (isEmailConfigured()) {
    const emailResult = await sendVerificationEmail(
      currentUser.email,
      currentUser.username,
      verificationToken.token
    );

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return errorResponse('Failed to send verification email. Please try again later.', 500);
    }

    return NextResponse.json({
      message: 'Verification email sent successfully. Please check your inbox.',
    });
  } else {
    // Development mode without SMTP - log token to console
    console.log(`[DEV] Verification token for ${currentUser.email}: ${verificationToken.token}`);
    console.log(`[DEV] Verification URL: ${process.env.APP_BASE_URL || 'http://localhost:9002'}/verify?token=${verificationToken.token}`);

    const response: { message: string; verificationToken?: string } = {
      message: 'Verification email would be sent. Check console for token (dev mode).',
    };

    // Include token in response for development
    if (process.env.NODE_ENV !== 'production') {
      response.verificationToken = verificationToken.token;
    }

    return NextResponse.json(response);
  }
});