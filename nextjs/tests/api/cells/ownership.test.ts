/**
 * Route tests for changes to a cell by someone who does not own its card.
 * Spec Reference: 21-authorization.md - Status Rules, Resource Rules (Ownership); 06-bingo-gameplay.md - Permissions
 */

import { describe, expect, it } from 'vitest';
import { PUT as editCell } from '@/app/api/cells/[cellId]/edit/route';
import { PATCH as increment } from '@/app/api/cells/[cellId]/progress/increment/route';
import { PUT as setState } from '@/app/api/cells/[cellId]/route';
import { PATCH as toggleSubtask } from '@/app/api/cells/[cellId]/subtasks/[index]/toggle/route';
import { POST as undo } from '@/app/api/cells/[cellId]/undo-complete/route';
import { CellState, ResolutionType } from '@/lib/shared/types';
import { createUser } from '../../support/db/fixtures';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createCellSetup, readCellState } from './helpers';

describe('cells – ownership', () => {
  describe('rejects', () => {
    it('a teammate setting the state of the owner\'s cell, with 400 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup();
      await signInAs(teammate);

      // Act
      const result = await callRoute(setState, { method: 'PUT', body: { state: CellState.COMPLETED }, params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
      expect((await readCellState(cellId)).state).toBe(CellState.PENDING);
    });

    it('a teammate undoing the owner\'s completed cell, with 400 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup({ state: CellState.COMPLETED });
      await signInAs(teammate);

      // Act
      const result = await callRoute(undo, { method: 'POST', params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
      expect((await readCellState(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('a teammate emptying the owner\'s cell, with 400 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup();
      await signInAs(teammate);

      // Act
      const result = await callRoute(editCell, { method: 'PUT', body: { sourceType: 'empty' }, params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
      expect(await readCellState(cellId)).toMatchObject({ state: CellState.PENDING });
    });

    it('a teammate moving the counter of the owner\'s iterative cell, with 400 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup({ type: ResolutionType.ITERATIVE });
      await signInAs(teammate);

      // Act
      const result = await callRoute(increment, { method: 'PATCH', params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
      expect((await readCellState(cellId)).completed_times).toBe(0);
    });

    it('a teammate toggling a subtask of the owner\'s compound cell, with 400 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup({ type: ResolutionType.COMPOUND });
      await signInAs(teammate);

      // Act
      const result = await callRoute(toggleSubtask, { method: 'PATCH', params: { cellId, index: '0' } });

      // Assert
      expect(result.status).toBe(400);
    });

    it('a change to a cell that does not exist, with 400 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(setState, {
        method: 'PUT',
        body: { state: CellState.COMPLETED },
        params: { cellId: '00000000-0000-4000-8000-00000000dead' },
      });

      // Assert
      expect(result.status).toBe(400);
    });
  });
});
