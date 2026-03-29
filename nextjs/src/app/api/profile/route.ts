/**
 * Profile API
 * Spec Reference: 02-user-profile-and-privacy.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile, updateUserProfile, getPublicUserProfile, User } from '@/lib/db';
import { errorResponse, withAuth, AuthContextNoParams } from '../utils';

/**
 * GET /api/profile - Get current user's profile
 * GET /api/profile?userId=xxx - Get another user's public profile
 * Spec: 02-user-profile-and-privacy.md - View own profile, Viewing Other Users
 */
export const GET = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
    const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (userId && userId !== currentUser.id) {
    // Get another user's public profile
    // Spec: 02-user-profile-and-privacy.md - only public fields are shown
    const publicProfile = await getPublicUserProfile(userId);

    if (!publicProfile) {
      return errorResponse('User not found', 404);
    }

    return NextResponse.json({ profile: publicProfile, isOwner: false });
  }

  // Get own profile (full access)
  const profile = await getUserProfile(currentUser.id);

  return NextResponse.json({
    profile,
    user: {
      id: currentUser.id,
      username: currentUser.username,
      email: currentUser.email,
      emailVerified: currentUser.emailVerifiedAt !== null,
    },
    isOwner: true,
  });
});

/**
 * PUT /api/profile - Update current user's profile
 * Spec: 02-user-profile-and-privacy.md - User can update their own profile fields
 */
export const PUT = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
    const body = await request.json();
  const { displayName, bio, avatarUrl, displayNamePublic, bioPublic, avatarPublic } = body;

  // Spec: 02-user-profile-and-privacy.md - Only the profile owner can edit their profile
  const updatedProfile = await updateUserProfile(currentUser.id, {
    displayName,
    bio,
    avatarUrl,
    displayNamePublic,
    bioPublic,
    avatarPublic,
  });

  if (!updatedProfile) {
    return errorResponse('Failed to update profile', 500);
  }

  return NextResponse.json({
    message: 'Profile updated successfully',
    profile: updatedProfile,
  });
});
