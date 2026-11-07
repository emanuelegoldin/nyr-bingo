/**
 * DB tests for keeping an archive when its team is deleted.
 * Spec Reference: 18-game-archive.md - Independence
 */

import { describe, expect, it } from 'vitest';
import { archiveGame, getArchivedGamesForUser } from '@/lib/db/archived-game-repository';
import { deleteTeam } from '@/lib/db/team-repository';
import { countRows } from '../../support/db/rows';
import { createEndedGame, loadGame } from './helpers';

describe('archive – independence', () => {
  describe('operations', () => {
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
  });
});
