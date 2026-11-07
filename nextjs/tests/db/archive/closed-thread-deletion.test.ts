/**
 * DB tests for deleting a closed thread of a running game.
 * Spec Reference: 07-proof-and-approval.md - Deleting an Archived Thread
 */

import { describe, expect, it } from 'vitest';
import { deleteClosedThread } from '@/lib/db/closed-thread-repository';
import { CellState } from '@/lib/shared/types';
import {
  createCard,
  createGame as seedGame,
  createTeam as seedTeam,
  createThread,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';

describe('archive – closed thread deletion', () => {
  describe('operations', () => {
    it('deletes a closed thread of a running game and leaves its cell (07-proof-and-approval.md – Deleting an Archived Thread)', async () => {
      // Arrange
      const owner = await createUser();
      const game = await seedGame(await seedTeam(owner), [owner]);
      const card = await createCard(game, owner, [{ state: CellState.ACCOMPLISHED }]);
      const threadId = await createThread(card.cellIds[0], owner, { closedWithOutcome: 'accomplished' });

      // Act
      const result = await deleteClosedThread(threadId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await countRows('review_threads', 'id = ?', [threadId])).toBe(0);
      expect(await countRows('bingo_cells', "id = ? AND state = 'accomplished'", [card.cellIds[0]])).toBe(1);
    });
  });

  describe('rejects', () => {
    it('deleting a thread that is still open (07-proof-and-approval.md – Deleting an Archived Thread)', async () => {
      // Arrange
      const owner = await createUser();
      const game = await seedGame(await seedTeam(owner), [owner]);
      const card = await createCard(game, owner, [{ state: CellState.PENDING_REVIEW }]);
      const threadId = await createThread(card.cellIds[0], owner);

      // Act
      const result = await deleteClosedThread(threadId);

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await countRows('review_threads', 'id = ?', [threadId])).toBe(1);
    });
  });
});
