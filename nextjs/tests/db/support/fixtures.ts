/**
 * Fixture builders: insert the toy data a test needs, inside the test's rolled-back transaction.
 * Spec Reference: 01-authentication.md - Registration
 */

import { randomUUID } from 'node:crypto';
import { execute } from './test-connection';

/** A user created by createUser. */
export interface UserFixture {
  id: string;
  username: string;
  email: string;
}

/**
 * Insert a verified user with a profile (getTeamWithMembers and similar reads JOIN user_profiles).
 * @param overrides Values to use instead of the generated ones
 * @returns The created user
 */
export const createUser = async (overrides: Partial<UserFixture> = {}): Promise<UserFixture> => {
  const id = overrides.id ?? randomUUID();
  const suffix = id.slice(0, 8);
  const user: UserFixture = {
    id,
    username: overrides.username ?? `user_${suffix}`,
    email: overrides.email ?? `user_${suffix}@test.local`,
  };

  await execute(
    'INSERT INTO users (id, username, email, password_hash, email_verified_at) VALUES (?, ?, ?, ?, NOW())',
    [user.id, user.username, user.email, 'not-a-real-hash']
  );
  await execute(
    'INSERT INTO user_profiles (id, user_id, display_name) VALUES (?, ?, ?)',
    [randomUUID(), user.id, user.username]
  );

  return user;
};
