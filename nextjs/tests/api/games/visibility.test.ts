/**
 * Route tests for who can see the cards of a game.
 * Spec Reference: 08-visibility-and-updates.md - Permissions; 21-authorization.md - Status Rules
 */

import { describe, expect, it } from 'vitest';
import { GET as getCards } from '@/app/api/games/[gameId]/cards/route';
import { GameStatus } from '@/lib/shared/types';
import { addMember, createCard, createUser } from '../../support/db/fixtures';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createGameSetup } from './helpers';

describe('games – visibility', () => {
  describe('operations', () => {
    it('shows a player every card of the game (08-visibility-and-updates.md – Permissions)', async () => {
      // Arrange
      const { admin, player, game } = await createGameSetup();
      await createCard(game, admin, [{}]);
      await createCard(game, player, [{}]);
      await signInAs(player);

      // Act
      const result = await callRoute<{ cards: unknown[] }>(getCards, { params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.cards).toHaveLength(2);
    });
  });

  describe('rejects', () => {
    it('a team member who does not play the game, with 403 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { team, game } = await createGameSetup();
      const benched = await createUser();
      await addMember(team, benched);
      await signInAs(benched);

      // Act
      const result = await callRoute(getCards, { params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(403);
    });

    it('an ended game, with 404 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { player, game } = await createGameSetup(GameStatus.ENDED);
      await signInAs(player);

      // Act
      const result = await callRoute(getCards, { params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(404);
    });

    it('a missing game, with 404 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(getCards, { params: { gameId: '00000000-0000-4000-8000-00000000dead' } });

      // Assert
      expect(result.status).toBe(404);
    });
  });
});
