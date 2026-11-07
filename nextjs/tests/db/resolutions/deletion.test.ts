/**
 * DB tests for deleting resolutions.
 * Spec Reference: 03-personal-resolutions.md - Delete
 */

import { describe, expect, it } from 'vitest';
import { deleteResolution } from '@/lib/db/resolution-repository';
import { GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createMemberResolution,
  createPersonalResolution,
  createTeam as seedTeam,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';

describe('resolutions – deletion', () => {
  describe('operations', () => {
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
  });

  describe('rejects', () => {
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
