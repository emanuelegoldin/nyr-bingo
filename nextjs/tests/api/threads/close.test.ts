/**
 * Route tests for closing a review thread, which only the completing user may do.
 * Spec Reference: 07-proof-and-approval.md - Closure by the Completing User; 21-authorization.md - Status Rules
 */

import { describe, expect, it } from 'vitest';
import { POST as closeThread } from '@/app/api/threads/[threadId]/close/route';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createOpenThread, MISSING_THREAD_ID } from './helpers';

describe('threads – close', () => {
  describe('operations', () => {
    it('lets the completing user close the thread (07-proof-and-approval.md – Closure by the Completing User)', async () => {
      // Arrange
      const { owner, threadId } = await createOpenThread();
      await signInAs(owner);

      // Act
      const result = await callRoute(closeThread, { method: 'POST', params: { threadId } });

      // Assert
      expect(result.status).toBe(200);
      expect(await countRows('review_threads', "id = ? AND status = 'closed'", [threadId])).toBe(1);
    });
  });

  describe('rejects', () => {
    it('another player closing it, with 403 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { voterA, threadId } = await createOpenThread();
      await signInAs(voterA);

      // Act
      const result = await callRoute(closeThread, { method: 'POST', params: { threadId } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('review_threads', "id = ? AND status = 'open'", [threadId])).toBe(1);
    });

    it('a thread that does not exist, with 404 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { owner } = await createOpenThread();
      await signInAs(owner);

      // Act
      const result = await callRoute(closeThread, { method: 'POST', params: { threadId: MISSING_THREAD_ID } });

      // Assert
      expect(result.status).toBe(404);
    });
  });
});
