/**
 * DB tests for generating the cards when a game starts.
 * Spec Reference: 05-bingo-card-generation.md - Generation Rules, Duplicate Handling, Data Model Notes
 */

import { describe, expect, it } from 'vitest';
import { startGameWithCards } from '@/lib/db/bingo-card-generation';
import {
  CellSourceType,
  GameStatus,
  type GridSize,
  ResolutionType,
} from '@/lib/shared/types';
import {
  createGame as seedGame,
  createMemberResolution,
  createPersonalResolution,
  createTeam as seedTeam,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';
import {
  createFormingGame,
  readCardCells,
  countSource,
  countPreparedFrom,
} from './helpers';

describe('cards – generation', () => {
  describe('operations', () => {
    it('starts the game and gives every player a 5×5 card without a stored Joker (05-bingo-card-generation.md – Assumptions)', async () => {
      // Arrange
      const { game, players } = await createFormingGame(2);

      // Act
      const result = await startGameWithCards(game.id);

      // Assert
      expect(result).toEqual({ success: true });
      const stored = await query<{ status: string; started: number }[]>(
        'SELECT status, started_at IS NOT NULL AS started FROM games WHERE id = ?',
        [game.id]
      );
      expect(stored[0]).toEqual({ status: GameStatus.STARTED, started: 1 });
      for (const player of players) {
        const cells = await readCardCells(game, player);
        expect(cells).toHaveLength(24);
        expect(cells.map((cell) => cell.position)).not.toContain(12);
        expect(cells.every((cell) => cell.state === 'pending' && cell.completed_times === 0)).toBe(true);
      }
      expect(await countRows('bingo_cards', 'game_id = ? AND grid_size = 5', [game.id])).toBe(2);
    });

    it.each([
      { gridSize: 3 as GridSize, storedCells: 8, center: 4 },
      { gridSize: 9 as GridSize, storedCells: 80, center: 40 },
    ])('gives a game of size $gridSize cards of $storedCells cells, leaving out the center $center (05-bingo-card-generation.md – Assumptions)', async ({ gridSize, storedCells, center }) => {
      // Arrange
      const { game, players } = await createFormingGame(1, gridSize);

      // Act
      await startGameWithCards(game.id);

      // Assert
      const cells = await readCardCells(game, players[0]);
      expect(cells).toHaveLength(storedCells);
      expect(cells.map((cell) => cell.position)).not.toContain(center);
    });

    it('puts the team goal on every card, each with its own cell (05-bingo-card-generation.md – Generation Rules)', async () => {
      // Arrange
      const { game, players } = await createFormingGame(2, 3);

      // Act
      await startGameWithCards(game.id);

      // Assert
      for (const player of players) {
        const goalCells = (await readCardCells(game, player)).filter((cell) => cell.source_type === CellSourceType.TEAM);
        expect(goalCells).toHaveLength(1);
        expect(goalCells[0].title).toBe('Team goal');
      }
    });

    it('copies a member-provided resolution as a snapshot with uncompleted subtasks (05-bingo-card-generation.md – Data Model Notes)', async () => {
      // Arrange
      const { game, players } = await createFormingGame(2);
      const [owner, author] = players;
      const resolutionId = await createMemberResolution(game, author, owner, { title: 'Climb', type: ResolutionType.COMPOUND });

      // Act
      await startGameWithCards(game.id);

      // Assert
      const cells = await readCardCells(game, owner);
      const provided = cells.filter((cell) => cell.source_type === CellSourceType.MEMBER_PROVIDED);
      expect(provided).toHaveLength(1);
      expect(provided[0]).toMatchObject({ title: 'Climb', source_user_id: author.id, resolution_id: resolutionId });
      const subtasks = await query<{ title: string; completed: number }[]>(
        `SELECT s.title, s.completed FROM bingo_cell_subtasks s JOIN bingo_cells c ON c.id = s.cell_id
          JOIN bingo_cards b ON b.id = c.card_id
          WHERE b.game_id = ? AND b.user_id = ? AND c.source_type = 'member_provided' ORDER BY s.subtask_index`,
        [game.id, owner.id]
      );
      expect(subtasks.map((subtask) => [subtask.title, Number(subtask.completed)])).toEqual([
        ['Step 1', 0],
        ['Step 2', 0],
      ]);
    });

    it('gives one short prepared resolution per player who proposed nothing (05-bingo-card-generation.md – Generation Rules)', async () => {
      // Arrange
      const { game, players } = await createFormingGame(3);
      const [owner, writer] = players;
      await createMemberResolution(game, writer, owner, { title: 'Swim' });

      // Act
      await startGameWithCards(game.id);

      // Assert
      expect(await countPreparedFrom(game, owner, 'short')).toBe(1);
    });

    it('uses personal resolutions before long and medium prepared ones, then fills the card (05-bingo-card-generation.md – Generation Rules)', async () => {
      // Arrange
      const { game, players } = await createFormingGame(1);
      const [owner] = players;
      await createPersonalResolution(owner, 'Paint');
      await createPersonalResolution(owner, 'Bake');

      // Act
      await startGameWithCards(game.id);

      // Assert
      const cells = await readCardCells(game, owner);
      expect(countSource(cells, CellSourceType.PERSONAL)).toBe(2);
      expect(countSource(cells, CellSourceType.EMPTY)).toBe(0);
      expect(await countPreparedFrom(game, owner, 'long')).toBe(20);
      expect(await countPreparedFrom(game, owner, 'medium')).toBe(1);
    });

    it('creates no resolution rows for prepared cells and leaves them unlinked (05-bingo-card-generation.md – Data Model Notes)', async () => {
      // Arrange
      const { game, players } = await createFormingGame(1);
      const resolutionsBefore = await countRows('resolutions', '1 = 1', []);

      // Act
      await startGameWithCards(game.id);

      // Assert
      const prepared = (await readCardCells(game, players[0])).filter((cell) => cell.source_type === CellSourceType.PREPARED);
      expect(prepared.length).toBeGreaterThan(0);
      expect(prepared.every((cell) => cell.resolution_id === null && cell.source_user_id === null)).toBe(true);
      expect(await countRows('resolutions', '1 = 1', [])).toBe(resolutionsBefore);
    });

    it('generates a card without duplicate texts (05-bingo-card-generation.md – Duplicate Handling)', async () => {
      // Arrange
      const { game, players } = await createFormingGame(2);
      const [owner, author] = players;
      await createMemberResolution(game, author, owner, { title: 'Swim' });
      await createPersonalResolution(owner, 'SWIM');
      await createPersonalResolution(owner, 'TEAM GOAL');

      // Act
      await startGameWithCards(game.id);

      // Assert
      const cells = (await readCardCells(game, owner)).filter((cell) => cell.source_type !== CellSourceType.EMPTY);
      const texts = cells.map((cell) => (cell.title ?? '').toLowerCase());
      expect(new Set(texts).size).toBe(texts.length);
      expect(countSource(cells, CellSourceType.PERSONAL)).toBe(0);
    });
  });

  describe('rejects', () => {
    it('starting without a team goal, leaving the game forming with no cards (05-bingo-card-generation.md – Constraints)', async () => {
      // Arrange
      const admin = await createUser();
      const game = await seedGame(await seedTeam(admin), [admin], GameStatus.FORMING);

      // Act
      const result = await startGameWithCards(game.id);

      // Assert
      expect(result.success).toBe(false);
      expect(await countRows('games', "id = ? AND status = 'forming' AND started_at IS NULL", [game.id])).toBe(1);
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(0);
    });

    it('starting a game twice (16-games.md – Start Conditions)', async () => {
      // Arrange
      const { game } = await createFormingGame(2);
      await startGameWithCards(game.id);

      // Act
      const result = await startGameWithCards(game.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Game is not in forming status' });
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(2);
    });
  });
});
