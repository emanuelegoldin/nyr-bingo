/**
 * DB tests for editing the content of a cell.
 * Spec Reference: 09-bingo-card-editing.md - Persisting a Cell Edit, Permissions & Safety, Backend Rules
 */

import { describe, expect, it } from 'vitest';
import { updateCellContent } from '@/lib/db/bingo-cell-repository';
import { CellSourceType, CellState, GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame,
  createMemberResolution,
  createPersonalResolution,
  createPlayingCard,
  createTeam,
  createUser,
  type GameFixture,
  type UserFixture,
} from '../../support/db/fixtures';
import { query } from '../../support/db/test-connection';
import { readCell, type StoredCell } from '../gameplay/helpers';

/**
 * Try to place a new personal resolution of the card owner, written for the card's game, on a cell, and return
 * the result with the cell after it.
 * @param cellId The cell
 * @param owner The card owner
 * @param game The card's game
 * @returns The repository result and the stored cell
 */
const placeOwnResolution = async (
  cellId: string,
  owner: UserFixture,
  game: GameFixture
): Promise<{ success: boolean; cell: StoredCell }> => {
  const resolutionId = await createPersonalResolution(owner, 'Read twelve books', game);
  const result = await updateCellContent(cellId, { resolutionId, sourceType: CellSourceType.PERSONAL });
  return { success: result.success, cell: await readCell(cellId) };
};

describe('cards – editing', () => {
  describe('operations', () => {
    it('replaces a cell with a personal resolution and resets its state (09-bingo-card-editing.md – Persisting a Cell Edit)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;
      const resolutionId = await createPersonalResolution(owner, 'Read twelve books', game);

      // Act
      const result = await updateCellContent(cellId, { resolutionId, sourceType: CellSourceType.PERSONAL });

      // Assert
      expect(result.success).toBe(true);
      expect(await readCell(cellId)).toEqual({
        state: CellState.PENDING,
        source_type: CellSourceType.PERSONAL,
        resolution_id: resolutionId,
        title: 'Read twelve books',
        is_empty: 0,
      });
    });

    it('empties a cell and clears its snapshot (09-bingo-card-editing.md – Persisting a Cell Edit)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellContent(cellId, { resolutionId: null, sourceType: CellSourceType.EMPTY });

      // Assert
      expect(result.success).toBe(true);
      expect(await readCell(cellId)).toEqual({
        state: CellState.PENDING,
        source_type: CellSourceType.EMPTY,
        resolution_id: null,
        title: null,
        is_empty: 1,
      });
    });
    it('places a resolution proposed to the owner in this game, with its author as source (09-bingo-card-editing.md – Backend Rules)', async () => {
      // Arrange
      const { owner, team, game, card } = await createPlayingCard([{}]);
      const author = await createUser();
      await addMember(team, author);
      const resolutionId = await createMemberResolution(game, author, owner, { title: 'Learn to juggle' });

      // Act
      const result = await updateCellContent(card.cellIds[0], { resolutionId, sourceType: CellSourceType.MEMBER_PROVIDED });

      // Assert
      expect(result.success).toBe(true);
      const rows = await query<{ source_type: string; source_user_id: string; title: string }[]>(
        'SELECT source_type, source_user_id, title FROM bingo_cells WHERE id = ?',
        [card.cellIds[0]]
      );
      expect(rows).toEqual([{ source_type: CellSourceType.MEMBER_PROVIDED, source_user_id: author.id, title: 'Learn to juggle' }]);
    });
  });

  describe('rejects', () => {
    it('editing the Joker (09-bingo-card-editing.md – Permissions & Safety)', async () => {
      // Arrange
      const { owner, game } = await createPlayingCard([{}]);
      const resolutionId = await createPersonalResolution(owner, 'Read twelve books', game);

      // Act
      const result = await updateCellContent(`joker:${game.id}`, { resolutionId, sourceType: CellSourceType.PERSONAL });

      // Assert
      expect(result.success).toBe(false);
    });

    it('editing the team goal cell (09-bingo-card-editing.md – Permissions & Safety)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{ source: 'team' }]);

      // Act
      const { success, cell } = await placeOwnResolution(card.cellIds[0], owner, game);

      // Assert
      expect(success).toBe(false);
      expect(cell.source_type).toBe(CellSourceType.TEAM);
    });

    it('editing a cell under review (09-bingo-card-editing.md – Permissions & Safety)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{ state: CellState.PENDING_REVIEW }]);

      // Act
      const { success, cell } = await placeOwnResolution(card.cellIds[0], owner, game);

      // Assert
      expect(success).toBe(false);
      expect(cell).toMatchObject({ state: CellState.PENDING_REVIEW, title: 'Cell 0' });
    });

    it('editing a cell of an ended game (09-bingo-card-editing.md – Backend Rules)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{}], GameStatus.ENDED);

      // Act
      const { success, cell } = await placeOwnResolution(card.cellIds[0], owner, game);

      // Assert
      expect(success).toBe(false);
      expect(cell.title).toBe('Cell 0');
    });

    it('placing another user\'s personal resolution (09-bingo-card-editing.md – Backend Rules)', async () => {
      // Arrange
      const { team, game, card } = await createPlayingCard([{}]);
      const stranger = await createUser();
      await addMember(team, stranger);
      const resolutionId = await createPersonalResolution(stranger, 'Not yours', game);

      // Act
      const result = await updateCellContent(card.cellIds[0], { resolutionId, sourceType: CellSourceType.PERSONAL });

      // Assert
      expect(result.success).toBe(false);
      expect((await readCell(card.cellIds[0])).title).toBe('Cell 0');
    });

    it('placing the owner\'s legacy personal resolution (09-bingo-card-editing.md – Definitions)', async () => {
      // Arrange
      const { owner, card } = await createPlayingCard([{}]);
      const resolutionId = await createPersonalResolution(owner, 'From the old list');

      // Act
      const result = await updateCellContent(card.cellIds[0], { resolutionId, sourceType: CellSourceType.PERSONAL });

      // Assert
      expect(result.success).toBe(false);
      expect((await readCell(card.cellIds[0])).title).toBe('Cell 0');
    });

    it('placing the owner\'s personal resolution of another game (09-bingo-card-editing.md – Definitions)', async () => {
      // Arrange
      const { owner, team, card } = await createPlayingCard([{}]);
      const otherGame = await createGame(team, [owner]);
      const resolutionId = await createPersonalResolution(owner, 'For the other game', otherGame);

      // Act
      const result = await updateCellContent(card.cellIds[0], { resolutionId, sourceType: CellSourceType.PERSONAL });

      // Assert
      expect(result.success).toBe(false);
      expect((await readCell(card.cellIds[0])).title).toBe('Cell 0');
    });

    it('placing a resolution proposed to the owner in another game (09-bingo-card-editing.md – Backend Rules)', async () => {
      // Arrange
      const { owner, team, card } = await createPlayingCard([{}]);
      const author = await createUser();
      await addMember(team, author);
      const otherGame = await createGame(team, [owner, author]);
      const resolutionId = await createMemberResolution(otherGame, author, owner);

      // Act
      const result = await updateCellContent(card.cellIds[0], { resolutionId, sourceType: CellSourceType.MEMBER_PROVIDED });

      // Assert
      expect(result.success).toBe(false);
      expect((await readCell(card.cellIds[0])).title).toBe('Cell 0');
    });

    it('placing a resolution that is already on another cell of the card (09-bingo-card-editing.md – Backend Rules)', async () => {
      // Arrange
      const owner = await createUser();
      const game = await createGame(await createTeam(owner), [owner]);
      const resolutionId = await createPersonalResolution(owner, 'Read twelve books', game);
      const card = await createCard(game, owner, [{ resolutionId }, {}]);

      // Act
      const result = await updateCellContent(card.cellIds[1], { resolutionId, sourceType: CellSourceType.PERSONAL });

      // Assert
      expect(result.success).toBe(false);
      expect((await readCell(card.cellIds[1])).resolution_id).toBeNull();
    });

    it('an empty cell that names a resolution (09-bingo-card-editing.md – Backend Rules)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{}]);
      const resolutionId = await createPersonalResolution(owner, 'Read twelve books', game);

      // Act
      const result = await updateCellContent(card.cellIds[0], { resolutionId, sourceType: CellSourceType.EMPTY });

      // Assert
      expect(result.success).toBe(false);
      expect((await readCell(card.cellIds[0])).source_type).toBe(CellSourceType.PERSONAL);
    });
  });
});
