/**
 * DB tests for listing personal resolutions.
 * Spec Reference: 03-personal-resolutions.md - Read
 */

import { describe, expect, it } from 'vitest';
import { getResolutionsByUser } from '@/lib/db/resolution-repository';
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
    it('lists only the caller\'s personal resolutions (03-personal-resolutions.md – Read)', async () => {
      // Arrange
      const owner = await createUser();
      const teammate = await createUser();
      const team = await seedTeam(owner);
      await addMember(team, teammate);
      const game = await seedGame(team, [owner, teammate]);
      const personalId = await createPersonalResolution(owner, 'Mine');
      await createPersonalResolution(teammate, 'Theirs');
      await createMemberResolution(game, owner, teammate);

      // Act
      const resolutions = await getResolutionsByUser(owner.id);

      // Assert
      expect(resolutions.map((resolution) => resolution.id)).toEqual([personalId]);
    });
  });
});
