/**
 * Route tests for voting in a review thread.
 * Spec Reference: 07-proof-and-approval.md - Vote Types, Eligible Voters; 21-authorization.md - Status Rules
 */

import { describe, expect, it } from 'vitest';
import { POST as vote } from '@/app/api/threads/[threadId]/vote/route';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createOpenThread, MISSING_THREAD_ID } from './helpers';

describe('threads – vote', () => {
  describe('operations', () => {
    it('records a player\'s vote (07-proof-and-approval.md – Eligible Voters)', async () => {
      // Arrange
      const { voterA, threadId } = await createOpenThread();
      await signInAs(voterA);

      // Act
      const result = await callRoute(vote, { method: 'POST', body: { vote: 'accept' }, params: { threadId } });

      // Assert: the spec gives no success code
      expect(result.status).toBeLessThan(300);
      expect(await countRows('review_votes', 'thread_id = ? AND voter_user_id = ?', [threadId, voterA.id])).toBe(1);
    });
  });

  describe('rejects', () => {
    it.each(['maybe', '', null])('a vote of %s, with 400 (07-proof-and-approval.md – Vote Types)', async (value) => {
      // Arrange
      const { voterA, threadId } = await createOpenThread();
      await signInAs(voterA);

      // Act
      const result = await callRoute(vote, { method: 'POST', body: { vote: value }, params: { threadId } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('review_votes', 'thread_id = ?', [threadId])).toBe(0);
    });

    it('a user who does not play the game, with 403 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { outsider, threadId } = await createOpenThread();
      await signInAs(outsider);

      // Act
      const result = await callRoute(vote, { method: 'POST', body: { vote: 'accept' }, params: { threadId } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('review_votes', 'thread_id = ?', [threadId])).toBe(0);
    });

    it('a thread that does not exist, with 404 (21-authorization.md – Status Rules)', async () => {
      // Arrange
      const { voterA } = await createOpenThread();
      await signInAs(voterA);

      // Act
      const result = await callRoute(vote, { method: 'POST', body: { vote: 'accept' }, params: { threadId: MISSING_THREAD_ID } });

      // Assert
      expect(result.status).toBe(404);
    });
  });
});
