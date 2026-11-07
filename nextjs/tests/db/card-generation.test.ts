/**
 * DB tests for bingo card generation: at game start, at join time, the fallbacks, snapshots and refusals.
 * Spec Reference: 05-bingo-card-generation.md - Generation Rules, Data Model Notes, Duplicate Handling, Constraints, 16-games.md - Start Conditions, Joining After Start
 */

import { describe, expect, it } from 'vitest';
import { ensureBingoCardForUser, startGameWithCards } from '@/lib/db/bingo-card-generation';
import { CellSourceType, GameStatus, type GridSize, ResolutionType } from '@/lib/shared/types';
import {
  addMember,
  createGame as seedGame,
  createMemberResolution,
  createPersonalResolution,
  createTeam as seedTeam,
  createTeamGoal,
  createUser,
  type GameFixture,
  type TeamFixture,
  type UserFixture,
} from './support/fixtures';
import { countRows } from './support/rows';
import { getColumns } from './support/schema';
import { query } from './support/test-connection';

/** A forming game with its team goal set. */
interface FormingGameSetup {
  team: TeamFixture;
  game: GameFixture;
  players: UserFixture[];
}

/**
 * Build a forming game whose admin set the team goal ('Team goal').
 * @param playerCount How many players, the first being the admin (default 2)
 * @param gridSize The side length of its cards (default 5)
 * @returns The team, the game and its players
 */
const createFormingGame = async (playerCount = 2, gridSize: GridSize = 5): Promise<FormingGameSetup> => {
  const players: UserFixture[] = [await createUser()];
  const team = await seedTeam(players[0]);
  for (let index = 1; index < playerCount; index++) {
    const member = await createUser();
    await addMember(team, member);
    players.push(member);
  }
  const game = await seedGame(team, players, GameStatus.FORMING, gridSize);
  await createTeamGoal(game, players[0]);
  return { team, game, players };
};

/** A generated cell as the tests look at it. */
interface GeneratedCell {
  position: number;
  source_type: CellSourceType;
  source_user_id: string | null;
  resolution_id: string | null;
  title: string | null;
  state: string;
  completed_times: number;
}

/**
 * Read the cells of a player's card in a game, by position.
 * @param game The game
 * @param player The card owner
 * @returns The stored cells
 */
const readCardCells = async (game: GameFixture, player: UserFixture): Promise<GeneratedCell[]> =>
  query<GeneratedCell[]>(
    `SELECT c.position, c.source_type, c.source_user_id, c.resolution_id, c.title, c.state, c.completed_times
       FROM bingo_cells c JOIN bingo_cards b ON b.id = c.card_id
      WHERE b.game_id = ? AND b.user_id = ?
      ORDER BY c.position`,
    [game.id, player.id]
  );

/**
 * Count a card's cells by source.
 * @param cells The card's cells
 * @param source The source type
 * @returns How many cells have it
 */
const countSource = (cells: GeneratedCell[], source: CellSourceType): number =>
  cells.filter((cell) => cell.source_type === source).length;

/**
 * Count a card's prepared cells copied from one category of the pool.
 * @param game The game
 * @param player The card owner
 * @param category short, medium or long
 * @returns How many cells came from that category
 */
const countPreparedFrom = async (game: GameFixture, player: UserFixture, category: string): Promise<number> => {
  const rows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total
       FROM bingo_cells c JOIN bingo_cards b ON b.id = c.card_id
       JOIN prepared_resolutions p ON p.title = c.title AND p.category = ?
      WHERE b.game_id = ? AND b.user_id = ? AND c.source_type = 'prepared'`,
    [category, game.id, player.id]
  );
  return Number(rows[0].total);
};

describe('card generation', () => {
  describe('structure', () => {
    it('has the expected bingo_cards columns (05-bingo-card-generation.md – Data Model Notes)', async () => {
      // Act
      const columns = await getColumns('bingo_cards');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'grid_size', type: 'int(11)', nullable: true, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'game_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'locked_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });

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

    it('gives a late joiner a card with the goal, no prepared cells and empty filler (05-bingo-card-generation.md – Generation Rules)', async () => {
      // Arrange
      const { team, game } = await createFormingGame(1);
      await startGameWithCards(game.id);
      const joiner = await createUser();
      await addMember(team, joiner);
      await createPersonalResolution(joiner, 'Juggle');

      // Act
      const result = await ensureBingoCardForUser(game.id, joiner.id);

      // Assert
      expect(result.created).toBe(true);
      const cells = await readCardCells(game, joiner);
      expect(cells).toHaveLength(24);
      expect(countSource(cells, CellSourceType.TEAM)).toBe(1);
      expect(countSource(cells, CellSourceType.PERSONAL)).toBe(1);
      expect(countSource(cells, CellSourceType.PREPARED)).toBe(0);
      expect(countSource(cells, CellSourceType.EMPTY)).toBe(22);
      expect(await countRows('team_leaderboard', 'game_id = ? AND user_id = ?', [game.id, joiner.id])).toBe(1);
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

    it('regenerating a card the player already has (05-bingo-card-generation.md – Generation Rules)', async () => {
      // Arrange
      const { game, players } = await createFormingGame(1);
      await startGameWithCards(game.id);
      const cellsBefore = await readCardCells(game, players[0]);

      // Act
      const result = await ensureBingoCardForUser(game.id, players[0].id);

      // Assert
      expect(result.created).toBe(false);
      expect(await readCardCells(game, players[0])).toEqual(cellsBefore);
    });

    it('generating a join-time card in a game that has not started (05-bingo-card-generation.md – Constraints)', async () => {
      // Arrange
      const { team, game } = await createFormingGame(1);
      const joiner = await createUser();
      await addMember(team, joiner);

      // Act
      const result = await ensureBingoCardForUser(game.id, joiner.id);

      // Assert
      expect(result).toEqual({ created: false, error: 'Game is not started' });
      expect(await countRows('bingo_cards', 'game_id = ? AND user_id = ?', [game.id, joiner.id])).toBe(0);
    });
  });
});
