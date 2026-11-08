/**
 * DB tests for the card of a player who joins a running game.
 * Spec Reference: 05-bingo-card-generation.md - Generation Rules, Constraints
 */

import { describe, expect, it } from 'vitest';
import { ensureBingoCardForUser, startGameWithCards } from '@/lib/db/bingo-card-generation';
import { CellSourceType } from '@/lib/shared/types';
import { addMember, createPersonalResolution, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { createFormingGame, readCardCells, countSource } from './helpers';

describe('cards – late join', () => {
  describe('operations', () => {
    it('gives a late joiner a card with the goal, no prepared or legacy personal cells and empty filler (05-bingo-card-generation.md – Generation Rules, Inputs)', async () => {
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
      expect(countSource(cells, CellSourceType.PERSONAL)).toBe(0);
      expect(countSource(cells, CellSourceType.PREPARED)).toBe(0);
      expect(countSource(cells, CellSourceType.EMPTY)).toBe(23);
      expect(await countRows('team_leaderboard', 'game_id = ? AND user_id = ?', [game.id, joiner.id])).toBe(1);
    });
  });

  describe('rejects', () => {
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
