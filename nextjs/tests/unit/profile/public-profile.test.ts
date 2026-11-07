/**
 * Unit tests for building a public profile from a user's privacy settings.
 * Spec Reference: 02-user-profile-and-privacy.md - Privacy Settings
 */

import { describe, expect, it } from 'vitest';
import { rowToPublicUserProfile, type PublicUserProfileRow } from '@/lib/db/user-repository';

/**
 * A profile row with every optional field filled, public unless overridden.
 * @param overrides Columns to change
 * @returns The row
 */
const profileRow = (overrides: Partial<PublicUserProfileRow> = {}): PublicUserProfileRow => ({
  user_id: 'user-1',
  username: 'alice',
  display_name: 'Alice',
  bio: 'Runner',
  avatar_url: '/avatars/alice.webp',
  display_name_public: 1,
  bio_public: 1,
  avatar_public: 1,
  ...overrides,
});

describe('public profile', () => {
  it('shows each optional field that is public (02-user-profile-and-privacy.md – Privacy Settings)', () => {
    // Act
    const profile = rowToPublicUserProfile(profileRow());

    // Assert
    expect(profile).toMatchObject({ username: 'alice', displayName: 'Alice', bio: 'Runner', avatarUrl: '/avatars/alice.webp' });
  });

  it('returns a private field as null (02-user-profile-and-privacy.md – Privacy Settings)', () => {
    // Act
    const profile = rowToPublicUserProfile(profileRow({ bio_public: 0 }));

    // Assert
    expect(profile.bio).toBeNull();
    expect(profile.displayName).toBe('Alice');
  });

  it('keeps the username when every optional field is private (02-user-profile-and-privacy.md – Errors & Edge Cases)', () => {
    // Act
    const profile = rowToPublicUserProfile(profileRow({ display_name_public: 0, bio_public: 0, avatar_public: 0 }));

    // Assert
    expect(profile).toMatchObject({ username: 'alice', displayName: null, bio: null, avatarUrl: null });
  });
});
