/**
 * DB tests for listing personal resolutions: a player's resolutions of a game, and the legacy list.
 * Spec Reference: 03-personal-resolutions.md - Read, Legacy Personal Resolutions
 */

import { describe, expect, it } from 'vitest';
import { getLegacyPersonalResolutions, getPlayerGameResolutions } from '@/lib/db/resolution-repository';
import {
  addMember,
  createGame as seedGame,
  createMemberResolution,
  createPersonalResolution,
  createTeam as seedTeam,
  createUser,
} from '../../support/db/fixtures';

describe('resolutions – listing', () => {
  describe('operations', () => {
    it('lists only the caller\'s personal resolutions of the given game (03-personal-resolutions.md – Read)', async () => {
      // Arrange
      const owner = await createUser();
      const teammate = await createUser();
      const team = await seedTeam(owner);
      await addMember(team, teammate);
      const game = await seedGame(team, [owner, teammate]);
      const otherGame = await seedGame(team, [owner, teammate]);
      const mineId = await createPersonalResolution(owner, 'Mine', game);
      await createPersonalResolution(owner, 'Mine elsewhere', otherGame);
      await createPersonalResolution(owner, 'Mine from the old list');
      await createPersonalResolution(teammate, 'Theirs', game);
      await createMemberResolution(game, owner, teammate);

      // Act
      const resolutions = await getPlayerGameResolutions(game.id, owner.id);

      // Assert
      expect(resolutions.map((resolution) => resolution.id)).toEqual([mineId]);
    });

    it('lists only the caller\'s legacy personal resolutions, which have no game (03-personal-resolutions.md – Legacy Personal Resolutions)', async () => {
      // Arrange
      const owner = await createUser();
      const teammate = await createUser();
      const team = await seedTeam(owner);
      await addMember(team, teammate);
      const game = await seedGame(team, [owner, teammate]);
      const legacyId = await createPersonalResolution(owner, 'Mine from the old list');
      await createPersonalResolution(owner, 'Mine', game);
      await createPersonalResolution(teammate, 'Theirs from the old list');

      // Act
      const resolutions = await getLegacyPersonalResolutions(owner.id);

      // Assert
      expect(resolutions.map((resolution) => resolution.id)).toEqual([legacyId]);
    });
  });
});
