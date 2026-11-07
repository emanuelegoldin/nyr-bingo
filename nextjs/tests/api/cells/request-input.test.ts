/**
 * Route tests for the request bodies the cell routes accept.
 * Spec Reference: 06-bingo-gameplay.md - Cell States, Progress on a Cell; 09-bingo-card-editing.md - Backend Rules
 */

import { describe, expect, it } from 'vitest';
import { PUT as editCell } from '@/app/api/cells/[cellId]/edit/route';
import { PATCH as increment } from '@/app/api/cells/[cellId]/progress/increment/route';
import { PUT as setState } from '@/app/api/cells/[cellId]/route';
import { PATCH as toggleSubtask } from '@/app/api/cells/[cellId]/subtasks/[index]/toggle/route';
import { CellState, ResolutionType } from '@/lib/shared/types';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createCellSetup, readCellState } from './helpers';

describe('cells – request input', () => {
  describe('rejects', () => {
    it.each([CellState.PENDING_REVIEW, CellState.ACCOMPLISHED, 'done'])(
      'setting the state to %s, with 400 (06-bingo-gameplay.md – Cell States)',
      async (state) => {
        // Arrange
        const { owner, cellId } = await createCellSetup();
        await signInAs(owner);

        // Act
        const result = await callRoute(setState, { method: 'PUT', body: { state }, params: { cellId } });

        // Assert
        expect(result.status).toBe(400);
        expect((await readCellState(cellId)).state).toBe(CellState.PENDING);
      }
    );

    it('an edit with an unknown sourceType, with 400 (09-bingo-card-editing.md – Backend Rules)', async () => {
      // Arrange
      const { owner, cellId } = await createCellSetup();
      await signInAs(owner);

      // Act
      const result = await callRoute(editCell, { method: 'PUT', body: { sourceType: 'team' }, params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
    });

    it.each(['personal', 'member_provided'])('a %s edit without resolutionId, with 400 (09-bingo-card-editing.md – Backend Rules)', async (sourceType) => {
      // Arrange
      const { owner, cellId } = await createCellSetup();
      await signInAs(owner);

      // Act
      const result = await callRoute(editCell, { method: 'PUT', body: { sourceType }, params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
    });

    it('moving the counter of a cell that is not iterative, with 400 (06-bingo-gameplay.md – Progress on a Cell)', async () => {
      // Arrange
      const { owner, cellId } = await createCellSetup({ type: ResolutionType.COMPOUND });
      await signInAs(owner);

      // Act
      const result = await callRoute(increment, { method: 'PATCH', params: { cellId } });

      // Assert
      expect(result.status).toBe(400);
    });

    it('toggling a subtask of a cell that is not compound, with 400 (06-bingo-gameplay.md – Progress on a Cell)', async () => {
      // Arrange
      const { owner, cellId } = await createCellSetup({ type: ResolutionType.ITERATIVE });
      await signInAs(owner);

      // Act
      const result = await callRoute(toggleSubtask, { method: 'PATCH', params: { cellId, index: '0' } });

      // Assert
      expect(result.status).toBe(400);
    });

    it.each(['2', '-1', 'first'])('toggling subtask %s of a cell with two subtasks, with 400 (06-bingo-gameplay.md – Progress on a Cell)', async (index) => {
      // Arrange
      const { owner, cellId } = await createCellSetup({ type: ResolutionType.COMPOUND });
      await signInAs(owner);

      // Act
      const result = await callRoute(toggleSubtask, { method: 'PATCH', params: { cellId, index } });

      // Assert
      expect(result.status).toBe(400);
    });
  });
});
