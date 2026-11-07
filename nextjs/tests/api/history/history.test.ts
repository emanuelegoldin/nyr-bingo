/**
 * Route tests for reading and writing a cell's history.
 * Spec Reference: 13-resolution-history-and-progress.md - API Endpoints, Permissions
 */

import { describe, expect, it } from 'vitest';
import { GET as readHistory, POST as writeNote } from '@/app/api/cells/[cellId]/history/route';
import { createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createCellSetup } from '../cells/helpers';

describe('history', () => {
  describe('operations', () => {
    it('lets a teammate read the history, without writing (13-resolution-history-and-progress.md – Permissions)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup();
      await signInAs(teammate);

      // Act
      const result = await callRoute<{ entries: unknown[]; canWrite: boolean }>(readHistory, { params: { cellId } });

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.canWrite).toBe(false);
    });

    it('lets the card owner add a note (13-resolution-history-and-progress.md – Permissions)', async () => {
      // Arrange
      const { owner, cellId } = await createCellSetup();
      await signInAs(owner);

      // Act
      const result = await callRoute(writeNote, { method: 'POST', body: { content: 'Ran 5 km' }, params: { cellId } });

      // Assert
      expect(result.status).toBeLessThan(300);
      expect(await countRows('cell_history_entries', 'cell_id = ?', [cellId])).toBe(1);
    });
  });

  describe('rejects', () => {
    it.each([
      ['limit=0'],
      ['limit=-5'],
      ['limit=many'],
      ['offset=-1'],
    ])('a page with %s, with 400 (13-resolution-history-and-progress.md – API Endpoints)', async (search) => {
      // Arrange
      const { owner, cellId } = await createCellSetup();
      await signInAs(owner);

      // Act
      const result = await callRoute(readHistory, { params: { cellId }, search });

      // Assert
      expect(result.status).toBe(400);
    });

    it('a user who does not play the game reading it, with 403 (13-resolution-history-and-progress.md – Permissions)', async () => {
      // Arrange
      const { cellId } = await createCellSetup();
      await signInAs(await createUser());

      // Act
      const result = await callRoute(readHistory, { params: { cellId } });

      // Assert
      expect(result.status).toBe(403);
    });

    it('a teammate writing a note, with 403 (13-resolution-history-and-progress.md – Permissions)', async () => {
      // Arrange
      const { teammate, cellId } = await createCellSetup();
      await signInAs(teammate);

      // Act
      const result = await callRoute(writeNote, { method: 'POST', body: { content: 'Not mine' }, params: { cellId } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('cell_history_entries', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('a cell that does not exist, with 404 (13-resolution-history-and-progress.md – API Endpoints)', async () => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(readHistory, { params: { cellId: '00000000-0000-4000-8000-00000000dead' } });

      // Assert
      expect(result.status).toBe(404);
    });
  });
});
