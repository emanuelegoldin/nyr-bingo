/**
 * DB tests for the archive: archiving an ended game with its cards, threads and progress, deleting archived
 * games and threads, deleting closed threads of a running game, and the refusals.
 * Spec Reference: 18-game-archive.md - Archiving a Game, Independence, Deleting an Archived Game, Deleting an Archived Thread, 07-proof-and-approval.md - Deleting an Archived Thread
 */

import { describe, expect, it } from 'vitest';
import {
  archiveGame,
  deleteArchivedGame,
  getArchivedGamesForUser,
} from '@/lib/db/archived-game-repository';
import { deleteArchivedThread } from '@/lib/db/archived-thread-repository';
import { deleteClosedThread } from '@/lib/db/closed-thread-repository';
import { getGameById } from '@/lib/db/game-repository';
import { deleteTeam } from '@/lib/db/team-repository';
import { CellState, GameStatus, ResolutionType, VoteType } from '@/lib/shared/types';
import type { Game } from '@/lib/db/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createLeaderboardRow,
  createProgressPoint,
  createTeam as seedTeam,
  createThread,
  createThreadMessage,
  createUser,
  createVote,
  type GameFixture,
  type TeamFixture,
  type UserFixture,
} from './support/fixtures';
import { countRows } from './support/rows';
import { getColumns } from './support/schema';
import { query } from './support/test-connection';

/** An ended game of an admin and a member, each with a card. */
interface EndedGameSetup {
  admin: UserFixture;
  member: UserFixture;
  team: TeamFixture;
  game: GameFixture;
  adminCellIds: string[];
  memberCellIds: string[];
}

/**
 * Build an ended game of two players with cards and leaderboard rows.
 * The admin's card holds an accomplished base cell and a compound cell; the member's a pending cell.
 * @returns The players, the team, the game and the cells
 */
const createEndedGame = async (): Promise<EndedGameSetup> => {
  const admin = await createUser();
  const member = await createUser();
  const team = await seedTeam(admin);
  await addMember(team, member);
  const game = await seedGame(team, [admin, member], GameStatus.ENDED);
  const adminCard = await createCard(game, admin, [
    { state: CellState.ACCOMPLISHED },
    { type: ResolutionType.COMPOUND },
  ]);
  const memberCard = await createCard(game, member, [{}]);
  await createLeaderboardRow(game, admin);
  await createLeaderboardRow(game, member);
  return { admin, member, team, game, adminCellIds: adminCard.cellIds, memberCellIds: memberCard.cellIds };
};

/**
 * Load the repository's view of a game, which archiveGame takes.
 * @param game The game
 * @returns The game
 */
const loadGame = async (game: GameFixture): Promise<Game> => {
  const loaded = await getGameById(game.id);
  if (!loaded) throw new Error('Fixture game not found');
  return loaded;
};

describe('archive', () => {
  describe('structure', () => {
    it('has the expected archived_games and archived_threads columns (18-game-archive.md – Data Model)', async () => {
      // Act
      const games = await getColumns('archived_games');
      const threads = await getColumns('archived_threads');

      // Assert
      expect(games).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'team_name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'ended_at', type: 'datetime', nullable: false, generated: false },
        { name: 'grid_size', type: 'tinyint(4)', nullable: false, generated: false },
        { name: 'started_at', type: 'datetime', nullable: true, generated: false },
      ]);
      expect(threads).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'archived_game_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'position', type: 'int(11)', nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: false, generated: false },
        { name: 'closed_at', type: 'datetime', nullable: true, generated: false },
        { name: 'outcome', type: "enum('accomplished','pending')", nullable: true, generated: false },
        { name: 'accept_votes', type: 'int(11)', nullable: false, generated: false },
        { name: 'deny_votes', type: 'int(11)', nullable: false, generated: false },
      ]);
    });
  });

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

    it('keeps the archive when its team is deleted (18-game-archive.md – Independence)', async () => {
      // Arrange
      const { admin, team, game } = await createEndedGame();
      await archiveGame(await loadGame(game));

      // Act
      await deleteTeam(team.id);

      // Assert
      expect(await countRows('archived_games', 'id = ?', [game.id])).toBe(1);
      expect((await getArchivedGamesForUser(admin.id)).map((summary) => summary.id)).toEqual([game.id]);
    });

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
