/**
 * Route tests for the proof files the completing user may upload.
 * Spec Reference: 07-proof-and-approval.md - File Constraints, Completing User
 *
 * Only refused uploads are tested: they are checked before anything reaches the disk.
 */

import { describe, expect, it } from 'vitest';
import { POST as upload } from '@/app/api/threads/[threadId]/files/route';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createOpenThread } from './helpers';

/**
 * Wrap one file in the multipart form the route reads.
 * @param size The file size in bytes
 * @param type The file's MIME type
 * @param name The file name
 * @returns The form
 */
const fileForm = (size: number, type: string, name: string): FormData => {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(size)], name, { type }));
  return form;
};

describe('threads – files', () => {
  describe('rejects', () => {
    it('a file over 5MB, with 400 (07-proof-and-approval.md – File Constraints)', async () => {
      // Arrange
      const { owner, threadId } = await createOpenThread();
      await signInAs(owner);

      // Act
      const result = await callRoute(upload, { method: 'POST', body: fileForm(5 * 1024 * 1024 + 1, 'image/png', 'proof.png'), params: { threadId } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('review_files', 'thread_id = ?', [threadId])).toBe(0);
    });

    it.each([
      ['text/plain', 'notes.txt'],
      ['image/svg+xml', 'drawing.svg'],
      ['application/zip', 'proof.zip'],
    ])('a %s file, which is not an accepted type, with 400 (07-proof-and-approval.md – File Constraints)', async (type, name) => {
      // Arrange
      const { owner, threadId } = await createOpenThread();
      await signInAs(owner);

      // Act
      const result = await callRoute(upload, { method: 'POST', body: fileForm(10, type, name), params: { threadId } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('review_files', 'thread_id = ?', [threadId])).toBe(0);
    });

    it('a player other than the completing user, with 403 (07-proof-and-approval.md – Completing User)', async () => {
      // Arrange
      const { voterA, threadId } = await createOpenThread();
      await signInAs(voterA);

      // Act
      const result = await callRoute(upload, { method: 'POST', body: fileForm(10, 'image/png', 'proof.png'), params: { threadId } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('review_files', 'thread_id = ?', [threadId])).toBe(0);
    });
  });
});
