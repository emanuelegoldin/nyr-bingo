/**
 * User Repository - Database operations for users
 * Spec Reference: 01-authentication.md, 02-user-profile-and-privacy.md
 */

import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from './connection';
import type { EmailVerificationToken, PublicUserProfile, Session, User, UserProfile } from './types';

// Row type from database (snake_case)
interface UserRow extends RowDataPacket {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface UserProfileRow extends RowDataPacket {
  id: string;
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  display_name_public: boolean | number;
  bio_public: boolean | number;
  avatar_public: boolean | number;
  created_at: Date;
  updated_at: Date;
}

interface TokenRow extends RowDataPacket {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

interface SessionRow extends RowDataPacket {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

// Convert database row to User type
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    displayNamePublic: Boolean(row.display_name_public),
    bioPublic: Boolean(row.bio_public),
    avatarPublic: Boolean(row.avatar_public),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Password hashing configuration
// Can be adjusted via environment variable based on server performance
// Valid range: 10-15 (higher = more secure but slower)
const DEFAULT_SALT_ROUNDS = 12;
const MIN_SALT_ROUNDS = 10;
const MAX_SALT_ROUNDS = 15;

function getSaltRounds(): number {
  const envValue = process.env.PASSWORD_SALT_ROUNDS;
  if (!envValue) {
    return DEFAULT_SALT_ROUNDS;
  }
  
  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid PASSWORD_SALT_ROUNDS value "${envValue}", using default ${DEFAULT_SALT_ROUNDS}`);
    return DEFAULT_SALT_ROUNDS;
  }
  
  if (parsed < MIN_SALT_ROUNDS || parsed > MAX_SALT_ROUNDS) {
    console.warn(`PASSWORD_SALT_ROUNDS ${parsed} out of range (${MIN_SALT_ROUNDS}-${MAX_SALT_ROUNDS}), using default ${DEFAULT_SALT_ROUNDS}`);
    return DEFAULT_SALT_ROUNDS;
  }
  
  return parsed;
}

const SALT_ROUNDS = getSaltRounds();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user
 * Spec: 01-authentication.md - Registration
 */
export async function createUser(
  username: string,
  email: string,
  password: string
): Promise<User> {
  const id = uuidv4();
  const passwordHash = await hashPassword(password);

  await query(
    `INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)`,
    [id, username, email, passwordHash]
  );

  // Create default profile
  const profileId = uuidv4();
  await query(
    `INSERT INTO user_profiles (id, user_id, display_name) VALUES (?, ?, ?)`,
    [profileId, id, username]
  );

  const rows = await query<UserRow[]>(
    `SELECT * FROM users WHERE id = ?`,
    [id]
  );

  return rowToUser(rows[0]);
}

/**
 * Find user by email
 * Spec: 01-authentication.md - Login
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await query<UserRow[]>(
    `SELECT * FROM users WHERE email = ?`,
    [email]
  );
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const rows = await query<UserRow[]>(
    `SELECT * FROM users WHERE id = ?`,
    [id]
  );
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

/**
 * Check if username or email already exists
 * Spec: 01-authentication.md - Registration validation
 */
export async function checkUserExists(
  username: string,
  email: string
): Promise<{ usernameExists: boolean; emailExists: boolean }> {
  const rows = await query<{ field: string }[]>(
    `SELECT 'username' as field FROM users WHERE username = ?
     UNION ALL
     SELECT 'email' as field FROM users WHERE email = ?`,
    [username, email]
  );
  
  return {
    usernameExists: rows.some(r => r.field === 'username'),
    emailExists: rows.some(r => r.field === 'email'),
  };
}

/**
 * Create email verification token, invalidating the user's earlier ones.
 * Rows are kept and marked as used, because resend limits count them.
 * Spec: 01-authentication.md - Email Verification
 */
export async function createVerificationToken(userId: string): Promise<EmailVerificationToken> {
  const id = uuidv4();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`,
    [userId]
  );

  await query(
    `INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
    [id, userId, token, expiresAt]
  );

  return {
    id,
    userId,
    token,
    expiresAt,
    usedAt: null,
    createdAt: new Date(),
  };
}

/**
 * Verify email token and mark user as verified
 * Spec: 01-authentication.md - Email Verification
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; error?: string }> {
  return withTransaction<{ success: boolean; error?: string }>(async (connection) => {
    // Find valid, unused token
    const tokens = await query<TokenRow[]>(
      `SELECT * FROM email_verification_tokens
       WHERE token = ? AND used_at IS NULL AND expires_at > NOW()`,
      [token],
      connection
    );

    if (tokens.length === 0) {
      return { success: false, error: 'Invalid or expired verification token' };
    }

    const verificationToken = tokens[0];

    // Mark token as used
    await connection.execute(
      `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?`,
      [verificationToken.id]
    );

    // Mark user as verified
    await connection.execute(
      `UPDATE users SET email_verified_at = NOW() WHERE id = ?`,
      [verificationToken.user_id]
    );

    return { success: true };
  }, (outcome) => outcome.success);
}

/**
 * Create session for authenticated user
 * Spec: 01-authentication.md - Login
 */
export async function createSession(userId: string): Promise<Session> {
  const id = uuidv4();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await query(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
    [id, userId, token, expiresAt]
  );

  return {
    id,
    userId,
    token,
    expiresAt,
    createdAt: new Date(),
  };
}

/**
 * Find valid session by token
 * Spec: 01-authentication.md - Access Control
 */
export async function findSessionByToken(token: string): Promise<Session | null> {
  const rows = await query<SessionRow[]>(
    `SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()`,
    [token]
  );
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Delete session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE token = ?`, [token]);
}

/**
 * Get user profile
 * Spec: 02-user-profile-and-privacy.md - View/edit own profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const rows = await query<UserProfileRow[]>(
    `SELECT * FROM user_profiles WHERE user_id = ?`,
    [userId]
  );
  return rows.length > 0 ? rowToProfile(rows[0]) : null;
}

/**
 * Update user profile
 * Spec: 02-user-profile-and-privacy.md - Profile Data
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'avatarUrl' | 'displayNamePublic' | 'bioPublic' | 'avatarPublic'>>
): Promise<UserProfile | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.displayName !== undefined) {
    setClauses.push('display_name = ?');
    values.push(updates.displayName);
  }
  if (updates.bio !== undefined) {
    setClauses.push('bio = ?');
    values.push(updates.bio);
  }
  if (updates.avatarUrl !== undefined) {
    setClauses.push('avatar_url = ?');
    values.push(updates.avatarUrl);
  }
  if (updates.displayNamePublic !== undefined) {
    setClauses.push('display_name_public = ?');
    values.push(updates.displayNamePublic);
  }
  if (updates.bioPublic !== undefined) {
    setClauses.push('bio_public = ?');
    values.push(updates.bioPublic);
  }
  if (updates.avatarPublic !== undefined) {
    setClauses.push('avatar_public = ?');
    values.push(updates.avatarPublic);
  }

  if (setClauses.length === 0) {
    return getUserProfile(userId);
  }

  values.push(userId);
  await query(
    `UPDATE user_profiles SET ${setClauses.join(', ')} WHERE user_id = ?`,
    values
  );

  return getUserProfile(userId);
}

/**
 * Get public profile for another user
 * Spec: 02-user-profile-and-privacy.md - Viewing Other Users
 */
export async function getPublicUserProfile(userId: string): Promise<PublicUserProfile | null> {
  const rows = await query<(UserRow & UserProfileRow)[]>(
    `SELECT u.id, u.username, p.user_id, p.display_name, p.bio, p.avatar_url,
            p.display_name_public, p.bio_public, p.avatar_public
     FROM users u
     JOIN user_profiles p ON u.id = p.user_id
     WHERE u.id = ?`,
    [userId]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name_public ? row.display_name : null,
    bio: row.bio_public ? row.bio : null,
    avatarUrl: row.avatar_public ? row.avatar_url : null,
  };
}
