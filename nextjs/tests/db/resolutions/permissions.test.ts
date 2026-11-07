/**
 * DB tests for changing a resolution that belongs to another user.
 * Spec Reference: 03-personal-resolutions.md - Permissions
 */

import { describe, expect, it } from 'vitest';
import { deleteResolution, updateResolutionContent } from '@/lib/db/resolution-repository';
import { ResolutionType } from '@/lib/shared/types';
import { createPersonalResolution, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { readResolution } from './helpers';

describe('resolutions – permissions', () => {
  describe('rejects', () => {
    it('another user updating a resolution (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const owner = await createUser();
      const intruder = await createUser();
      const id = await createPersonalResolution(owner, 'Original');

      // Act
      await updateResolutionContent(id, intruder.id, { type: ResolutionType.BASE, title: 'Hacked', text: '' });

      // Assert
      expect((await readResolution(id)).title).toBe('Original');
    });

    it('another user deleting a resolution (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const owner = await createUser();
      const intruder = await createUser();
      const id = await createPersonalResolution(owner, 'Original');

      // Act
      const deleted = await deleteResolution(id, intruder.id);

      // Assert
      expect(deleted).toBe(false);
      expect(await countRows('resolutions', 'id = ?', [id])).toBe(1);
    });
  });
});
