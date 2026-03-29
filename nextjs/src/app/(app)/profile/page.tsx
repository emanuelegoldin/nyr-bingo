/**
 * Profile Page
 * Spec Reference: 02-user-profile-and-privacy.md
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getUserProfile } from '@/lib/db';
import ProfilePageClient from './ProfilePageClient';

export default async function ProfilePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login');
  }

  const profile = await getUserProfile(currentUser.id);

  return (
    <ProfilePageClient
      initialUser={{
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        emailVerified: currentUser.emailVerifiedAt !== null,
      }}
      initialProfile={profile}
    />
  );
}
