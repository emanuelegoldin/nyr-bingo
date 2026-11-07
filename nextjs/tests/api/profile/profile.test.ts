/**
 * Route tests for reading and updating profiles.
 * Spec Reference: 02-user-profile-and-privacy.md - API, Privacy Settings, Permissions
 */

import { describe, expect, it } from 'vitest';
import { GET as getProfile, PUT as updateProfile } from '@/app/api/profile/route';
import { createUser } from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

/**
 * Read a user's stored display name.
 * @param userId The user
 * @returns The display name
 */
const readDisplayName = async (userId: string): Promise<string | null> => {
  const rows = await query<{ display_name: string | null }[]>('SELECT display_name FROM user_profiles WHERE user_id = ?', [userId]);
  return rows[0].display_name;
};

describe('profile', () => {
  describe('operations', () => {
    it('changes only the caller\'s profile (02-user-profile-and-privacy.md – Permissions)', async () => {
      // Arrange
      const [caller, other] = [await createUser(), await createUser()];
      await signInAs(caller);

      // Act
      const result = await callRoute(updateProfile, { method: 'PUT', body: { displayName: 'New name', userId: other.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(await readDisplayName(caller.id)).toBe('New name');
      expect(await readDisplayName(other.id)).toBe(other.username);
    });

    it('returns another user\'s profile with private fields as null (02-user-profile-and-privacy.md – Privacy Settings)', async () => {
      // Arrange
      const [caller, other] = [await createUser(), await createUser()];
      await execute("UPDATE user_profiles SET bio = 'Secret', bio_public = 0, display_name_public = 1 WHERE user_id = ?", [other.id]);
      await signInAs(caller);

      // Act
      const result = await callRoute<{ profile: { username: string; displayName: string; bio: string | null }; isOwner: boolean }>(
        getProfile,
        { search: `userId=${other.id}` }
      );

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.isOwner).toBe(false);
      expect(result.body.profile).toMatchObject({ username: other.username, displayName: other.username, bio: null });
    });

    it('returns the caller\'s own editable profile when given their own id (02-user-profile-and-privacy.md – API)', async () => {
      // Arrange
      const caller = await createUser();
      await signInAs(caller);

      // Act
      const result = await callRoute<{ isOwner: boolean }>(getProfile, { search: `userId=${caller.id}` });

      // Assert
      expect(result.body.isOwner).toBe(true);
    });
  });

  describe('rejects', () => {
    it('reading the profile of a user who does not exist, with 404 (02-user-profile-and-privacy.md – API)', async () => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(getProfile, { search: 'userId=00000000-0000-4000-8000-00000000dead' });

      // Assert
      expect(result.status).toBe(404);
    });
  });
});
