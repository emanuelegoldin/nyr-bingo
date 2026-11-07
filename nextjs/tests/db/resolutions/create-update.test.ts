/**
 * DB tests for creating and updating personal resolutions.
 * Spec Reference: 03-personal-resolutions.md - Types, Create and Update, Constraints
 */

import { describe, expect, it } from 'vitest';
import { changeResolutionType, createResolution, updateResolutionContent } from '@/lib/db/resolution-repository';
import { ResolutionScope, ResolutionType } from '@/lib/shared/types';
import {
  createCard,
  createGame as seedGame,
  createPersonalResolution,
  createTeam as seedTeam,
  createUser,
} from '../../support/db/fixtures';
import { query } from '../../support/db/test-connection';
import { readResolution } from './helpers';

describe('resolutions – create update', () => {
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
  });
});
