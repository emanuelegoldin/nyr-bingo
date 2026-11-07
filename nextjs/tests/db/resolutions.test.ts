/**
 * DB tests for resolutions: table structure, create, update, type change, delete and the rules that refuse them.
 * Spec Reference: 03-personal-resolutions.md - Resolution Model, Create and Update, Delete, Permissions
 */

import { describe, expect, it } from 'vitest';
import {
  changeResolutionType,
  createResolution,
  deleteResolution,
  getResolutionsByUser,
  updateResolutionContent,
} from '@/lib/db/resolution-repository';
import { GameStatus, ResolutionScope, ResolutionType } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createMemberResolution,
  createPersonalResolution,
  createTeam as seedTeam,
  createUser,
} from './support/fixtures';
import { countRows } from './support/rows';
import { getColumns } from './support/schema';
import { query } from './support/test-connection';

/** The persisted fields of a resolution that the tests look at. */
interface StoredResolution {
  title: string;
  description: string | null;
  resolution_type: ResolutionType;
  subtasks: string | null;
  number_of_repetition: number | null;
}

/**
 * Read a resolution straight from the table, bypassing the repository.
 * @param id The resolution
 * @returns The stored fields
 */
const readResolution = async (id: string): Promise<StoredResolution> => {
  const rows = await query<StoredResolution[]>(
    'SELECT title, description, resolution_type, subtasks, number_of_repetition FROM resolutions WHERE id = ?',
    [id]
  );
  return rows[0];
};

describe('resolutions', () => {
  describe('structure', () => {
    it('has the expected columns (03-personal-resolutions.md – Resolution Model)', async () => {
      // Act
      const columns = await getColumns('resolutions');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'owner_user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'title', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'description', type: 'text', nullable: true, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
        { name: 'resolution_type', type: "enum('base','compound','iterative')", nullable: false, generated: false },
        { name: 'scope', type: "enum('personal','team','member_provided')", nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'to_user_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'subtasks', type: 'longtext', nullable: true, generated: false },
        { name: 'number_of_repetition', type: 'int(11)', nullable: true, generated: false },
        { name: 'game_id', type: 'varchar(36)', nullable: true, generated: false },
      ]);
    });
  });

  describe('operations', () => {
    it('creates a base resolution whose description defaults to its title (03-personal-resolutions.md – Constraints)', async () => {
      // Arrange
      const owner = await createUser();

      // Act
      const id = await createResolution(
        owner.id,
        { type: ResolutionType.BASE, title: 'Read 12 books', text: '' },
        { scope: ResolutionScope.PERSONAL }
      );

      // Assert
      expect(await readResolution(id)).toEqual({
        title: 'Read 12 books',
        description: 'Read 12 books',
        resolution_type: ResolutionType.BASE,
        subtasks: null,
        number_of_repetition: null,
      });
    });

    it('creates a compound resolution with trimmed subtasks and no progress (03-personal-resolutions.md – Types)', async () => {
      // Arrange
      const owner = await createUser();

      // Act
      const id = await createResolution(
        owner.id,
        {
          type: ResolutionType.COMPOUND,
          title: 'Move house',
          text: '',
          subtasks: [{ title: ' Pack ', description: ' boxes ' }, { title: 'Unpack', description: '' }],
        },
        { scope: ResolutionScope.PERSONAL }
      );

      // Assert
      const stored = await readResolution(id);
      expect(JSON.parse(stored.subtasks ?? 'null')).toEqual([
        { title: 'Pack', description: 'boxes' },
        { title: 'Unpack', description: '' },
      ]);
      expect(stored.number_of_repetition).toBeNull();
    });

    it('replaces the target of an iterative resolution without touching cells (03-personal-resolutions.md – Create and Update)', async () => {
      // Arrange
      const owner = await createUser();
      const id = await createResolution(
        owner.id,
        { type: ResolutionType.ITERATIVE, title: 'Run', text: '', numberOfRepetition: 3 },
        { scope: ResolutionScope.PERSONAL }
      );
      const game = await seedGame(await seedTeam(owner), [owner]);
      const card = await createCard(game, owner, [{ type: ResolutionType.ITERATIVE, resolutionId: id }]);

      // Act
      await updateResolutionContent(id, owner.id, {
        type: ResolutionType.ITERATIVE,
        title: 'Run more',
        text: '',
        numberOfRepetition: 10,
      });

      // Assert
      expect(await readResolution(id)).toMatchObject({ title: 'Run more', number_of_repetition: 10 });
      const cells = await query<{ title: string; number_of_repetition: number }[]>(
        'SELECT title, number_of_repetition FROM bingo_cells WHERE id = ?',
        [card.cellIds[0]]
      );
      expect(cells[0]).toEqual({ title: 'Cell 0', number_of_repetition: 3 });
    });

    it('changes the type and rewrites the type-specific data (03-personal-resolutions.md – Create and Update)', async () => {
      // Arrange
      const owner = await createUser();
      const id = await createPersonalResolution(owner, 'Meditate');

      // Act
      await changeResolutionType(id, owner.id, {
        type: ResolutionType.ITERATIVE,
        title: 'Meditate',
        text: 'Every morning',
        numberOfRepetition: 30,
      });

      // Assert
      expect(await readResolution(id)).toEqual({
        title: 'Meditate',
        description: 'Every morning',
        resolution_type: ResolutionType.ITERATIVE,
        subtasks: null,
        number_of_repetition: 30,
      });
    });

    it('deletes a resolution and only unlinks the cells filled from it (03-personal-resolutions.md – Delete)', async () => {
      // Arrange
      const owner = await createUser();
      const id = await createPersonalResolution(owner, 'Learn Italian');
      const game = await seedGame(await seedTeam(owner), [owner]);
      const card = await createCard(game, owner, [{ resolutionId: id }]);

      // Act
      const deleted = await deleteResolution(id, owner.id);

      // Assert
      expect(deleted).toBe(true);
      expect(await countRows('resolutions', 'id = ?', [id])).toBe(0);
      const cells = await query<{ resolution_id: string | null; title: string }[]>(
        'SELECT resolution_id, title FROM bingo_cells WHERE id = ?',
        [card.cellIds[0]]
      );
      expect(cells[0]).toEqual({ resolution_id: null, title: 'Cell 0' });
    });

    it('lists only the caller\'s personal resolutions (03-personal-resolutions.md – Read)', async () => {
      // Arrange
      const owner = await createUser();
      const teammate = await createUser();
      const team = await seedTeam(owner);
      await addMember(team, teammate);
      const game = await seedGame(team, [owner, teammate]);
      const personalId = await createPersonalResolution(owner, 'Mine');
      await createPersonalResolution(teammate, 'Theirs');
      await createMemberResolution(game, owner, teammate);

      // Act
      const resolutions = await getResolutionsByUser(owner.id);

      // Assert
      expect(resolutions.map((resolution) => resolution.id)).toEqual([personalId]);
    });
  });

  describe('rejects', () => {
    it('another user updating a resolution (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const owner = await createUser();
      const intruder = await createUser();
      const id = await createPersonalResolution(owner, 'Original');

      // Act
      await updateResolutionContent(id, intruder.id, { type: ResolutionType.BASE, title: 'Hacked', text: '' });

      // Assert
      expect((await readResolution(id)).title).toBe('Original');
    });

    it('another user deleting a resolution (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const owner = await createUser();
      const intruder = await createUser();
      const id = await createPersonalResolution(owner, 'Original');

      // Act
      const deleted = await deleteResolution(id, intruder.id);

      // Assert
      expect(deleted).toBe(false);
      expect(await countRows('resolutions', 'id = ?', [id])).toBe(1);
    });

    it('deleting a member-provided resolution of an ended game (16-games.md – Ending a Game)', async () => {
      // Arrange
      const author = await createUser();
      const recipient = await createUser();
      const team = await seedTeam(author);
      await addMember(team, recipient);
      const game = await seedGame(team, [author, recipient], GameStatus.ENDED);
      const id = await createMemberResolution(game, author, recipient);

      // Act
      const deleted = await deleteResolution(id, author.id);

      // Assert
      expect(deleted).toBe(false);
      expect(await countRows('resolutions', 'id = ?', [id])).toBe(1);
    });

    it('deleting a member-provided resolution after leaving its game (16-games.md – Leaving a Game)', async () => {
      // Arrange
      const author = await createUser();
      const recipient = await createUser();
      const team = await seedTeam(recipient);
      await addMember(team, author);
      const game = await seedGame(team, [recipient]);
      const id = await createMemberResolution(game, author, recipient);

      // Act
      const deleted = await deleteResolution(id, author.id);

      // Assert
      expect(deleted).toBe(false);
      expect(await countRows('resolutions', 'id = ?', [id])).toBe(1);
    });
  });
});
