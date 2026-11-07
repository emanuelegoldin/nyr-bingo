/**
 * Route tests for who may react to which cell; every refusal of a cell route is 400.
 * Spec Reference: 24-cell-reactions.md - Who Can React, Backend Rules
 */

import { describe, expect, it } from 'vitest';
import { PUT as react } from '@/app/api/cells/[cellId]/reaction/route';
import { CellState } from '@/lib/shared/types';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createCellSetup } from '../cells/helpers';

describe('reactions – check order', () => {
  describe('operations', () => {
    it('lets a teammate react to a completed cell (24-cell-reactions.md – Who Can React)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup({ state: CellState.COMPLETED });
      await signInAs(teammate);

      // Act
      const result = await callRoute(react, { method: 'PUT', body: { reaction: 'heart' }, params: { cellId } });

      // Assert
      expect(result.status).toBe(200);
      expect(await countRows('cell_reactions', 'cell_id = ?', [cellId])).toBe(1);
    });
  });

  describe('rejects', () => {
    it('the owner reacting to their own cell, with 400 (24-cell-reactions.md – Who Can React)', async () => {
      // Arrange
      const { owner, cellId } = await createCellSetup({ state: CellState.COMPLETED });
      await signInAs(owner);

      // Act
      const result = await callRoute(react, { method: 'PUT', body: { reaction: 'heart' }, params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('cell_reactions', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('reacting to a cell that is not stamped, with 400 (24-cell-reactions.md – Backend Rules)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup({ state: CellState.PENDING });
      await signInAs(teammate);

      // Act
      const result = await callRoute(react, { method: 'PUT', body: { reaction: 'heart' }, params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
    });

    it('a reaction outside the pool, with 400 (24-cell-reactions.md – Backend Rules)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup({ state: CellState.COMPLETED });
      await signInAs(teammate);

      // Act
      const result = await callRoute(react, { method: 'PUT', body: { reaction: 'thumbs_down' }, params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('cell_reactions', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('a user who does not play the game, with 400 (24-cell-reactions.md – Backend Rules)', async () => {
      // Arrange
      const { cellId } = await createCellSetup({ state: CellState.COMPLETED });
      await signInAs(await createUser());

      // Act
      const result = await callRoute(react, { method: 'PUT', body: { reaction: 'heart' }, params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('cell_reactions', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('reacting to the Joker, with 400 (24-cell-reactions.md – Backend Rules)', async () => {
      // Arrange
      const { teammate, game } = await createCellSetup({ state: CellState.COMPLETED });
      await signInAs(teammate);

      // Act
      const result = await callRoute(react, { method: 'PUT', body: { reaction: 'heart' }, params: { cellId: `joker:${game.id}` } });

      // Assert
      expect(result.status).toBe(400);
    });
  });
});
