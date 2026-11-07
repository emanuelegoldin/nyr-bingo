/**
 * Smoke test for the DB test harness: connection, per-test rollback and savepoint transactions.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { describe, expect, it } from 'vitest';
import { withTransaction } from '@/lib/db/connection';
import { findUserById } from '@/lib/db/user-repository';
import { createUser } from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';

// Fixed id so the second test can look for the row the first one wrote
const ISOLATION_USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Count the users with an id.
 * @param userId The id to look for
 * @returns 0 or 1
 */
const countUsers = async (userId: string): Promise<number> => {
  const rows = await query<{ total: number }[]>('SELECT COUNT(*) AS total FROM users WHERE id = ?', [userId]);
  return Number(rows[0].total);
};

describe('DB test harness', () => {
  it('connects to the migrated test database', async () => {
    // Act
    const rows = await query<{ version: string }[]>(
      'SELECT version FROM flyway_schema_history WHERE success = 1 ORDER BY installed_rank DESC LIMIT 1'
    );

    // Assert
    expect(rows).toHaveLength(1);
  });

  it('routes repository code through the test transaction', async () => {
    // Arrange
    const user = await createUser({ id: ISOLATION_USER_ID });

    // Act
    const found = await findUserById(user.id);

    // Assert
    expect(found?.username).toBe(user.username);
  });

  it('rolls back what the previous test wrote', async () => {
    // Act
    const total = await countUsers(ISOLATION_USER_ID);

    // Assert
    expect(total).toBe(0);
  });

  it('undoes only the failed withTransaction, not the rest of the test', async () => {
    // Arrange
    const kept = await createUser();
    const undoneId = '00000000-0000-4000-8000-000000000002';

    // Act
    const attempt = withTransaction(async (connection) => {
      await execute(
        "INSERT INTO users (id, username, email, password_hash) VALUES (?, 'undone', 'undone@test.local', 'x')",
        [undoneId],
        connection
      );
      throw new Error('work failed');
    });

    // Assert
    await expect(attempt).rejects.toThrow('work failed');
    expect(await countUsers(undoneId)).toBe(0);
    expect(await countUsers(kept.id)).toBe(1);
  });
});
