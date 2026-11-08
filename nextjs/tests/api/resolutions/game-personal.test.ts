/**
 * Route tests for a player's personal resolutions of a game: listing them for card editing, and adding a prepared
 * entry to them.
 * Spec Reference: 03-personal-resolutions.md - Read; 09-bingo-card-editing.md - Replacement Options;
 * 17-prepared-resolutions.md - Adding to Personal Resolutions
 */

import { describe, expect, it } from 'vitest';
import { GET as listPersonal } from '@/app/api/games/[gameId]/personal-resolutions/route';
import { POST as addPrepared } from '@/app/api/resolutions/prepared/[id]/add/route';
import { GameStatus } from '@/lib/shared/types';
import { addMember, createGame, createPersonalResolution, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createGameSetup } from '../games/helpers';

/**
 * Pick an entry of the seeded prepared pool, the same one every run.
 * @returns The entry id
 */
const pickEntryId = async (): Promise<string> => {
  const rows = await query<{ id: string }[]>('SELECT id FROM prepared_resolutions ORDER BY id LIMIT 1');
  return rows[0].id;
};

describe('resolutions – personal resolutions of a game', () => {
  describe('operations', () => {
    it('lists only the caller\'s personal resolutions of the game (09-bingo-card-editing.md – Replacement Options)', async () => {
      // Arrange
      const { admin, player, team, game } = await createGameSetup();
      const otherGame = await createGame(team, [admin, player]);
      const mineId = await createPersonalResolution(player, 'Mine', game);
      await createPersonalResolution(player, 'Mine elsewhere', otherGame);
      await createPersonalResolution(player, 'Mine from the old list');
      await createPersonalResolution(admin, 'Theirs', game);
      await signInAs(player);

      // Act
      const result = await callRoute<{ resolutions: { id: string }[] }>(listPersonal, { params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.resolutions.map((resolution) => resolution.id)).toEqual([mineId]);
    });

    it('adds a prepared entry to the caller\'s personal resolutions of the game (17-prepared-resolutions.md – Adding to Personal Resolutions)', async () => {
      // Arrange
      const { player, game } = await createGameSetup(GameStatus.FORMING);
      await signInAs(player);

      // Act
      const result = await callRoute(addPrepared, { method: 'POST', body: { gameId: game.id }, params: { id: await pickEntryId() } });

      // Assert
      expect(result.status).toBe(201);
      expect(await countRows('resolutions', "owner_user_id = ? AND scope = 'personal' AND game_id = ?", [player.id, game.id])).toBe(1);
    });
  });

  describe('rejects', () => {
    it('listing the personal resolutions of a game the caller does not play, with 403 (03-personal-resolutions.md – Read)', async () => {
      // Arrange
      const { team, game } = await createGameSetup();
      const benched = await createUser();
      await addMember(team, benched);
      await signInAs(benched);

      // Act
      const result = await callRoute(listPersonal, { params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(403);
    });

    it('adding a prepared entry without a game, with 400 (17-prepared-resolutions.md – Adding to Personal Resolutions)', async () => {
      // Arrange
      const { player } = await createGameSetup(GameStatus.FORMING);
      await signInAs(player);

      // Act
      const result = await callRoute(addPrepared, { method: 'POST', body: {}, params: { id: await pickEntryId() } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'owner_user_id = ?', [player.id])).toBe(0);
    });

    it('adding a prepared entry to a game the caller does not play, with 403 (17-prepared-resolutions.md – Adding to Personal Resolutions)', async () => {
      // Arrange
      const { team, game } = await createGameSetup(GameStatus.FORMING);
      const benched = await createUser();
      await addMember(team, benched);
      await signInAs(benched);

      // Act
      const result = await callRoute(addPrepared, { method: 'POST', body: { gameId: game.id }, params: { id: await pickEntryId() } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('resolutions', 'owner_user_id = ?', [benched.id])).toBe(0);
    });
  });
});
