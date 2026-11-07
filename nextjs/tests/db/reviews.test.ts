/**
 * DB tests for review threads and votes: table structure, proof requests, messages, voting, closure and refusals.
 * Spec Reference: 07-proof-and-approval.md - Review Trigger, Discussion, Voting & Approval, Closure by the Completing User, Closure by Deadline
 */

import { describe, expect, it } from 'vitest';
import {
  addMessage,
  closeExpiredThreads,
  closeThread,
  requestProof,
  submitVote,
} from '@/lib/db/review-thread-repository';
import { CellState, GameStatus, VoteType } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createTeam as seedTeam,
  createThread,
  createUser,
  createVote,
  type UserFixture,
} from './support/fixtures';
import { countRows } from './support/rows';
import { getColumns } from './support/schema';
import { query } from './support/test-connection';

/** A game with a card owner and two other players. */
interface ReviewSetup {
  owner: UserFixture;
  voterA: UserFixture;
  voterB: UserFixture;
  cellId: string;
}

/**
 * Build a started game of three players where the owner's only cell is in the given state.
 * @param state The state of the owner's cell
 * @param gameStatus The game's status (default started)
 * @returns The players and the cell
 */
const createReviewSetup = async (state: CellState, gameStatus = GameStatus.STARTED): Promise<ReviewSetup> => {
  const owner = await createUser();
  const voterA = await createUser();
  const voterB = await createUser();
  const team = await seedTeam(owner);
  await addMember(team, voterA);
  await addMember(team, voterB);
  const game = await seedGame(team, [owner, voterA, voterB], gameStatus);
  const card = await createCard(game, owner, [{ state }]);
  return { owner, voterA, voterB, cellId: card.cellIds[0] };
};

/** The persisted fields of a thread that the tests look at. */
interface StoredThread {
  status: 'open' | 'closed';
  outcome: 'accomplished' | 'pending' | null;
  closed: number;
}

/**
 * Read a thread and its cell's state straight from the tables.
 * @param threadId The thread
 * @returns The thread's status, outcome and whether closed_at is set, with the cell state
 */
const readThread = async (threadId: string): Promise<StoredThread & { cell_state: CellState }> => {
  const rows = await query<(StoredThread & { cell_state: CellState })[]>(
    `SELECT t.status, t.outcome, t.closed_at IS NOT NULL AS closed, c.state AS cell_state
       FROM review_threads t JOIN bingo_cells c ON c.id = t.cell_id WHERE t.id = ?`,
    [threadId]
  );
  return { ...rows[0], closed: Number(rows[0].closed) };
};

describe('reviews and votes', () => {
  describe('structure', () => {
    it('has the expected review_threads columns (07-proof-and-approval.md – Review Thread Model)', async () => {
      // Act
      const columns = await getColumns('review_threads');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'cell_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'completed_by_user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'status', type: "enum('open','closed')", nullable: true, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'closed_at', type: 'datetime', nullable: true, generated: false },
        { name: 'outcome', type: "enum('accomplished','pending')", nullable: true, generated: false },
      ]);
    });

    it('has the expected review_votes columns (10-voting-mechanic.md – Persistence & Database Notes)', async () => {
      // Act
      const columns = await getColumns('review_votes');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'thread_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'voter_user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'vote', type: "enum('accept','deny')", nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });

  describe('operations', () => {
    it('opens a thread and puts a completed cell under review (07-proof-and-approval.md – Review Trigger)', async () => {
      // Arrange
      const { voterA, cellId } = await createReviewSetup(CellState.COMPLETED);

      // Act
      const result = await requestProof(cellId, voterA.id);

      // Assert
      expect(result.success).toBe(true);
      expect(await readThread(result.thread!.id)).toEqual({
        status: 'open',
        outcome: null,
        closed: 0,
        cell_state: CellState.PENDING_REVIEW,
      });
    });

    it('stores a trimmed message (07-proof-and-approval.md – Discussion)', async () => {
      // Arrange
      const { owner, voterA, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);

      // Act
      const result = await addMessage(threadId, voterA.id, '  Show me a photo  ');

      // Assert
      expect(result.success).toBe(true);
      const rows = await query<{ content: string }[]>('SELECT content FROM review_messages WHERE thread_id = ?', [threadId]);
      expect(rows).toEqual([{ content: 'Show me a photo' }]);
    });

    it('keeps one vote per voter and lets them change it (07-proof-and-approval.md – Eligible Voters)', async () => {
      // Arrange
      const { owner, voterA, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);
      await submitVote(threadId, voterA.id, VoteType.ACCEPT);

      // Act
      const result = await submitVote(threadId, voterA.id, VoteType.DENY);

      // Assert
      expect(result).toMatchObject({ success: true, threadClosed: false });
      const votes = await query<{ vote: VoteType }[]>('SELECT vote FROM review_votes WHERE thread_id = ?', [threadId]);
      expect(votes).toEqual([{ vote: VoteType.DENY }]);
    });

    it('closes as accomplished once every voter voted and half accept (07-proof-and-approval.md – Outcome)', async () => {
      // Arrange
      const { owner, voterA, voterB, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);
      await createVote(threadId, voterA, VoteType.DENY);

      // Act
      const result = await submitVote(threadId, voterB.id, VoteType.ACCEPT);

      // Assert
      expect(result).toMatchObject({ success: true, threadClosed: true });
      expect(await readThread(threadId)).toEqual({
        status: 'closed',
        outcome: 'accomplished',
        closed: 1,
        cell_state: CellState.ACCOMPLISHED,
      });
    });

    it('closes as pending when fewer than half accept (07-proof-and-approval.md – Outcome)', async () => {
      // Arrange
      const { owner, voterA, voterB, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);
      await createVote(threadId, voterA, VoteType.DENY);

      // Act
      await submitVote(threadId, voterB.id, VoteType.DENY);

      // Assert
      expect(await readThread(threadId)).toMatchObject({ status: 'closed', outcome: 'pending', cell_state: CellState.PENDING });
    });

    it('returns the cell to pending when the completing user closes the thread (07-proof-and-approval.md – Closure by the Completing User)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);

      // Act
      const result = await closeThread(threadId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await readThread(threadId)).toEqual({
        status: 'closed',
        outcome: 'pending',
        closed: 1,
        cell_state: CellState.PENDING,
      });
    });

    it('closes threads open for 2 days, a thread without votes as accomplished (07-proof-and-approval.md – Closure by Deadline)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner, { ageDays: 2 });

      // Act
      const closed = await closeExpiredThreads();

      // Assert
      expect(closed).toEqual([threadId]);
      expect(await readThread(threadId)).toMatchObject({ status: 'closed', outcome: 'accomplished', cell_state: CellState.ACCOMPLISHED });
    });
  });

  describe('rejects', () => {
    it('requesting proof on your own cell (07-proof-and-approval.md – Review Trigger)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.COMPLETED);

      // Act
      const result = await requestProof(cellId, owner.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Cannot request proof for your own resolution' });
      expect(await countRows('review_threads', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('requesting proof on a cell that is not completed (07-proof-and-approval.md – Review Trigger)', async () => {
      // Arrange
      const { voterA, cellId } = await createReviewSetup(CellState.PENDING);

      // Act
      const result = await requestProof(cellId, voterA.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Cell must be completed before requesting proof' });
      expect(await countRows('review_threads', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('requesting proof in an ended game (16-games.md – Ending a Game)', async () => {
      // Arrange
      const { voterA, cellId } = await createReviewSetup(CellState.COMPLETED, GameStatus.ENDED);

      // Act
      const result = await requestProof(cellId, voterA.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'This game has ended' });
      expect(await countRows('review_threads', 'cell_id = ?', [cellId])).toBe(0);
    });

    it('the completing user voting on their own proof (07-proof-and-approval.md – Eligible Voters)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);

      // Act
      const result = await submitVote(threadId, owner.id, VoteType.ACCEPT);

      // Assert
      expect(result).toMatchObject({ success: false, status: 403 });
      expect(await countRows('review_votes', 'thread_id = ?', [threadId])).toBe(0);
    });

    it('voting on a closed thread (07-proof-and-approval.md – Eligible Voters)', async () => {
      // Arrange
      const { owner, voterA, cellId } = await createReviewSetup(CellState.ACCOMPLISHED);
      const threadId = await createThread(cellId, owner, { closedWithOutcome: 'accomplished' });

      // Act
      const result = await submitVote(threadId, voterA.id, VoteType.DENY);

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await countRows('review_votes', 'thread_id = ?', [threadId])).toBe(0);
    });

    it('an empty message (07-proof-and-approval.md – Discussion)', async () => {
      // Arrange
      const { owner, voterA, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner);

      // Act
      const result = await addMessage(threadId, voterA.id, '   ');

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await countRows('review_messages', 'thread_id = ?', [threadId])).toBe(0);
    });

    it('closing threads younger than 2 days by deadline (07-proof-and-approval.md – Closure by Deadline)', async () => {
      // Arrange
      const { owner, cellId } = await createReviewSetup(CellState.PENDING_REVIEW);
      const threadId = await createThread(cellId, owner, { ageDays: 1 });

      // Act
      const closed = await closeExpiredThreads();

      // Assert
      expect(closed).toEqual([]);
      expect(await readThread(threadId)).toMatchObject({ status: 'open', cell_state: CellState.PENDING_REVIEW });
    });
  });
});
