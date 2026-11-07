/**
 * DB tests for deleting an archived game or one of its threads.
 * Spec Reference: 18-game-archive.md - Deleting an Archived Game, Deleting an Archived Thread
 */

import { describe, expect, it } from 'vitest';
import { archiveGame, deleteArchivedGame } from '@/lib/db/archived-game-repository';
import { deleteArchivedThread } from '@/lib/db/archived-thread-repository';
import type { Game } from '@/lib/db/types';
import { createThread, createThreadMessage } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { createEndedGame, loadGame } from './helpers';

describe('archive – deleting', () => {
  describe('operations', () => {
    it('deletes an archived game with its players, cells and threads (18-game-archive.md – Deleting an Archived Game)', async () => {
      // Arrange
      const { admin, game, adminCellIds } = await createEndedGame();
      await createThread(adminCellIds[0], admin, { closedWithOutcome: 'accomplished' });
      await archiveGame(await loadGame(game));

      // Act
      await deleteArchivedGame(game.id);

      // Assert
      expect(await countRows('archived_games', 'id = ?', [game.id])).toBe(0);
      expect(await countRows('archived_game_players', 'archived_game_id = ?', [game.id])).toBe(0);
      expect(await countRows('archived_cells', 'archived_game_id = ?', [game.id])).toBe(0);
      expect(await countRows('archived_threads', 'archived_game_id = ?', [game.id])).toBe(0);
    });

    it('deletes one archived thread and its messages, keeping the game (18-game-archive.md – Deleting an Archived Thread)', async () => {
      // Arrange
      const { admin, member, game, adminCellIds } = await createEndedGame();
      const threadId = await createThread(adminCellIds[0], admin, { closedWithOutcome: 'accomplished' });
      await createThreadMessage(threadId, member, 'Nice work');
      await archiveGame(await loadGame(game));

      // Act
      const result = await deleteArchivedThread(game.id, threadId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await countRows('archived_threads', 'id = ?', [threadId])).toBe(0);
      expect(await countRows('archived_thread_messages', 'archived_thread_id = ?', [threadId])).toBe(0);
      expect(await countRows('archived_games', 'id = ?', [game.id])).toBe(1);
    });
  });

  describe('rejects', () => {
    it('deleting an archived thread through another archived game (18-game-archive.md – Deleting an Archived Thread)', async () => {
      // Arrange
      const first = await createEndedGame();
      const threadId = await createThread(first.adminCellIds[0], first.admin, { closedWithOutcome: 'accomplished' });
      await archiveGame(await loadGame(first.game));
      const second = await createEndedGame();
      await archiveGame(await loadGame(second.game));

      // Act
      const result = await deleteArchivedThread(second.game.id, threadId);

      // Assert
      expect(result).toMatchObject({ success: false, status: 404 });
      expect(await countRows('archived_threads', 'id = ?', [threadId])).toBe(1);
    });
  });
});
