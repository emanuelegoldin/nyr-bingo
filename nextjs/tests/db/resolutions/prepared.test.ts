/**
 * DB tests for the prepared resolution pool: browsing it and adding a copy to one's personal resolutions.
 * Spec Reference: 17-prepared-resolutions.md - Browsing the Pool, Adding to Personal Resolutions
 */

import { describe, expect, it } from 'vitest';
import { addPreparedResolutionToUser, getPreparedResolutions } from '@/lib/db/prepared-resolution-repository';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute, query } from '../../support/db/test-connection';

/** The stored fields of a copied resolution that the tests look at. */
interface StoredCopy {
  owner_user_id: string;
  scope: string;
  resolution_type: string;
  title: string;
  description: string | null;
  subtasks: unknown;
}

/** The seeded compound entry the tests copy. */
interface PoolEntry {
  id: string;
  title: string;
  description: string | null;
  subtasks: unknown;
}

/**
 * Pick a compound entry from the seeded pool, the same one every run.
 * @returns The entry
 */
const pickCompoundEntry = async (): Promise<PoolEntry> => {
  const rows = await query<PoolEntry[]>(
    "SELECT id, title, description, subtasks FROM prepared_resolutions WHERE resolution_type = 'compound' ORDER BY id LIMIT 1"
  );
  return rows[0];
};

/**
 * Get the subtask titles of a stored JSON column, whatever the driver returned.
 * @param column The column value, as text or parsed JSON
 * @returns The titles, in order
 */
const subtaskTitles = (column: unknown): string[] => {
  const subtasks = (typeof column === 'string' ? JSON.parse(column) : column) as { title: string }[];
  return subtasks.map((subtask) => subtask.title);
};

/**
 * Read a resolution straight from the table.
 * @param id The resolution
 * @returns The stored fields
 */
const readCopy = async (id: string): Promise<StoredCopy> => {
  const rows = await query<StoredCopy[]>(
    'SELECT owner_user_id, scope, resolution_type, title, description, subtasks FROM resolutions WHERE id = ?',
    [id]
  );
  return rows[0];
};

describe('resolutions – prepared', () => {
  describe('operations', () => {
    it('returns the pool grouped by category (17-prepared-resolutions.md – Browsing the Pool)', async () => {
      // Act
      const pool = await getPreparedResolutions();

      // Assert: each category forms one block
      const blocks = pool.map((entry) => entry.category).filter((category, index, all) => category !== all[index - 1]);
      expect(pool.length).toBeGreaterThan(0);
      expect(new Set(blocks).size).toBe(blocks.length);
    });

    it('adds a personal copy with the entry\'s type, text and subtasks (17-prepared-resolutions.md – Adding to Personal Resolutions)', async () => {
      // Arrange
      const user = await createUser();
      const entry = await pickCompoundEntry();

      // Act
      const result = await addPreparedResolutionToUser(entry.id, user.id);

      // Assert
      if (!('id' in result)) throw new Error(`expected a copy, got ${result.error}`);
      const copy = await readCopy(result.id);
      expect(copy).toMatchObject({ owner_user_id: user.id, scope: 'personal', resolution_type: 'compound', title: entry.title });
      expect(copy.description).toBe(entry.description ?? entry.title);
      expect(subtaskTitles(copy.subtasks)).toEqual(subtaskTitles(entry.subtasks));
    });

    it('gives two users independent copies of the same entry (17-prepared-resolutions.md – Acceptance Criteria)', async () => {
      // Arrange
      const [alice, bob] = [await createUser(), await createUser()];
      const entry = await pickCompoundEntry();
      await addPreparedResolutionToUser(entry.id, alice.id);

      // Act
      const result = await addPreparedResolutionToUser(entry.id, bob.id);

      // Assert
      expect('id' in result).toBe(true);
      expect(await countRows('resolutions', 'owner_user_id IN (?, ?)', [alice.id, bob.id])).toBe(2);
    });

    it('adds the entry again once the earlier copy\'s text was changed (17-prepared-resolutions.md – Adding to Personal Resolutions)', async () => {
      // Arrange
      const user = await createUser();
      const entry = await pickCompoundEntry();
      const first = await addPreparedResolutionToUser(entry.id, user.id);
      if (!('id' in first)) throw new Error('setup failed');
      await execute("UPDATE resolutions SET title = 'My own goal', description = 'My own goal' WHERE id = ?", [first.id]);

      // Act
      const result = await addPreparedResolutionToUser(entry.id, user.id);

      // Assert
      expect('id' in result).toBe(true);
    });
  });

  describe('rejects', () => {
    it('an entry whose text the user already has, ignoring case, creating nothing (17-prepared-resolutions.md – Adding to Personal Resolutions)', async () => {
      // Arrange
      const user = await createUser();
      const entry = await pickCompoundEntry();
      const text = (entry.description ?? entry.title).toUpperCase();
      await execute(
        "INSERT INTO resolutions (id, owner_user_id, scope, resolution_type, title, description) VALUES (UUID(), ?, 'personal', 'base', ?, ?)",
        [user.id, text, text]
      );

      // Act
      const result = await addPreparedResolutionToUser(entry.id, user.id);

      // Assert
      expect(result).toEqual({ error: 'already_added' });
      expect(await countRows('resolutions', 'owner_user_id = ?', [user.id])).toBe(1);
    });

    it('an unknown entry (17-prepared-resolutions.md – Adding to Personal Resolutions)', async () => {
      // Arrange
      const user = await createUser();

      // Act
      const result = await addPreparedResolutionToUser('00000000-0000-4000-8000-00000000dead', user.id);

      // Assert
      expect(result).toEqual({ error: 'not_found' });
    });
  });
});
