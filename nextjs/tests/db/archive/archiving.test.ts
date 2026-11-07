/**
 * DB tests for archiving an ended game.
 * Spec Reference: 18-game-archive.md - Archiving a Game; 24-cell-reactions.md - Losing Reactions
 */

import { describe, expect, it } from 'vitest';
import { archiveGame } from '@/lib/db/archived-game-repository';
import type { Game } from '@/lib/db/types';
import { CellState, GameStatus, VoteType } from '@/lib/shared/types';
import {
  createCard,
  createGame as seedGame,
  createProgressPoint,
  createReaction,
  createTeam as seedTeam,
  createThread,
  createThreadMessage,
  createUser,
  createVote,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';
import { createEndedGame, loadGame } from './helpers';

describe('archive – archiving', () => {
  describe('operations', () => {
    it('archives an ended game with its players, admins and cards, then deletes the game (18-game-archive.md – Archiving a Game)', async () => {
      // Arrange
      const { admin, member, team, game } = await createEndedGame();

      // Act
      const archived = await archiveGame(await loadGame(game));

      // Assert
      expect(archived).toBe(true);
      expect(await countRows('archived_games', 'id = ?', [game.id])).toBe(1);
      const players = await query<{ user_id: string; is_leader: number }[]>(
        'SELECT user_id, is_leader FROM archived_game_players WHERE archived_game_id = ? ORDER BY is_leader DESC',
        [game.id]
      );
      expect(players.map((player) => [player.user_id, Number(player.is_leader)])).toEqual([
        [admin.id, 1],
        [member.id, 0],
      ]);
      const cells = await query<{ position: number; state: CellState; title: string }[]>(
        'SELECT position, state, title FROM archived_cells WHERE archived_game_id = ? AND user_id = ? ORDER BY position',
        [game.id, admin.id]
      );
      expect(cells).toEqual([
        { position: 0, state: CellState.ACCOMPLISHED, title: 'Cell 0' },
        { position: 1, state: CellState.PENDING, title: 'Cell 1' },
      ]);
      expect(await countRows('archived_cell_subtasks', 'archived_game_id = ? AND position = 1', [game.id])).toBe(2);
      expect(await countRows('games', 'id = ?', [game.id])).toBe(0);
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('teams', 'id = ?', [team.id])).toBe(1);
    });

    it('archives a closed thread with its outcome, vote counts and messages (18-game-archive.md – Archiving a Game)', async () => {
      // Arrange
      const { admin, member, game, adminCellIds } = await createEndedGame();
      const threadId = await createThread(adminCellIds[0], admin, { closedWithOutcome: 'accomplished' });
      await createVote(threadId, member, VoteType.ACCEPT);
      await createThreadMessage(threadId, member, 'Nice work');

      // Act
      await archiveGame(await loadGame(game));

      // Assert
      const threads = await query<{ position: number; outcome: string; accept_votes: number; deny_votes: number }[]>(
        'SELECT position, outcome, accept_votes, deny_votes FROM archived_threads WHERE id = ?',
        [threadId]
      );
      expect(threads).toEqual([{ position: 0, outcome: 'accomplished', accept_votes: 1, deny_votes: 0 }]);
      const messages = await query<{ author_name: string; content: string }[]>(
        'SELECT author_name, content FROM archived_thread_messages WHERE archived_thread_id = ?',
        [threadId]
      );
      expect(messages).toEqual([{ author_name: member.username, content: 'Nice work' }]);
    });

    it('copies the players\' progress points into the archive (23-progress-chart.md – Archiving)', async () => {
      // Arrange
      const { admin, game } = await createEndedGame();
      await createProgressPoint(game, admin, 0);
      await createProgressPoint(game, admin, 1);

      // Act
      await archiveGame(await loadGame(game));

      // Assert
      expect(await countRows('archived_progress', 'archived_game_id = ? AND user_id = ?', [game.id, admin.id])).toBe(2);
      expect(await countRows('leaderboard_progress', 'game_id = ?', [game.id])).toBe(0);
    });

    it('copies the reactions of the cards with their emoji and placement (24-cell-reactions.md – Losing Reactions)', async () => {
      // Arrange
      const { admin, member, game, adminCellIds } = await createEndedGame();
      await createReaction(adminCellIds[0], member, 'star');

      // Act
      await archiveGame(await loadGame(game));

      // Assert
      const reactions = await query<{ user_id: string; position: number; reactor_user_id: string; reaction: string; pos_x: number; pos_y: number }[]>(
        'SELECT user_id, position, reactor_user_id, reaction, pos_x, pos_y FROM archived_cell_reactions WHERE archived_game_id = ?',
        [game.id]
      );
      expect(reactions).toEqual([{ user_id: admin.id, position: 0, reactor_user_id: member.id, reaction: 'star', pos_x: 50, pos_y: 50 }]);
    });
  });

  describe('rejects', () => {
    it('archiving a game that still has an open thread (18-game-archive.md – Archiving a Game)', async () => {
      // Arrange
      const { admin, game, adminCellIds } = await createEndedGame();
      await createThread(adminCellIds[0], admin);

      // Act
      const archived = await archiveGame(await loadGame(game));

      // Assert
      expect(archived).toBe(false);
      expect(await countRows('archived_games', 'id = ?', [game.id])).toBe(0);
      expect(await countRows('games', 'id = ?', [game.id])).toBe(1);
    });

    it('archiving a game that has not ended, leaving nothing archived (16-games.md – Lifecycle)', async () => {
      // Arrange
      const owner = await createUser();
      const game = await seedGame(await seedTeam(owner), [owner], GameStatus.STARTED);
      await createCard(game, owner, [{}]);

      // Act
      const attempt = archiveGame(await loadGame(game));

      // Assert
      await expect(attempt).rejects.toThrow('is no longer in ended status');
      expect(await countRows('archived_games', 'id = ?', [game.id])).toBe(0);
      expect(await countRows('games', 'id = ?', [game.id])).toBe(1);
    });
  });
});
