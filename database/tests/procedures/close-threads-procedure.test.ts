import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../helpers/db-client';

type CountRow = RowDataPacket & { count: number };
type StatusRow = RowDataPacket & { status: string };
type StateRow = RowDataPacket & { state: string };
type LeaderboardRow = RowDataPacket & { completed_tasks: number; first_bingo_at: Date | null };

const ids = {
	teamId: 'f9efb876-f224-422d-9316-96e3b49e5f34',
	cardId: '4a2f2e58-c428-44d8-a1ae-8cc238036e43',
	resolutionId: '0bf1a1c5-1c8c-4a67-bf71-2f57b1b4f334',
	reviewId: 'b1e91c0b-ebfc-4be0-aeb2-7c71d956767c',
	otherReviewId: '81b0da83-2f71-4510-a902-bb3bedb92f05',
	completedByUserId: 'f40f5005-cdd0-47ac-8535-53f03788a087',
	memberUserId: '1e6a8a2d-cdb9-4f62-9c2f-4f2996e4f9b1',
	voterUserId: '39731ca0-b73e-49c0-ad9e-32a1b34ea5ec',
	fileUserId: '2b4e8a5c-33f6-4e12-96e1-7b84b37a1f5f',
	cellId: 'dce16460-6199-4a1d-9551-e791baee3101',
	otherCellId: '8d4b2f3d-7b19-4c7d-8a51-93c882e5be61',
	voteId: 'a18e9699-9dd6-4a04-8cf1-a22b3c61ce9b',
	reviewFileId: 'f9efb875-f224-422d-9316-96e3b49e5f34',
	reviewFileIdOther: 'f9efb875-f224-422d-9316-96e3b49e5f35',
};

const cellIds = {
	pos0: 'e7f541c7-1f42-4a3a-8d54-1d0798a63e40',
	pos1: '28d7730d-2c7c-4f9d-8d9d-f5301f70c7f7',
	pos3: 'a4e63a59-1a5f-4c12-8d3d-3b2a5e23d06a',
	pos4: 'd2a6a38e-fb1b-42b6-8b5c-7f6f0a6c8ad7',
	pos7: 'b1f9d045-f7b7-4d1f-8c15-1d1b2d58a91f',
	pos17: '4a1a4bdf-6fcb-4c15-8a9b-9d8b1fcd1a91',
	pos22: '79e77c9b-92c8-4fa2-9b12-9a6b6f88a601',
};

async function getThreadStatus(): Promise<string> {
	const rows = await query<StatusRow[]>(
		'SELECT status FROM review_threads WHERE id = ?',
		[ids.reviewId]
	);
	return rows[0]?.status ?? 'unknown';
}

async function getCellState(): Promise<string> {
	const rows = await query<StateRow[]>('SELECT state FROM bingo_cells WHERE id = ?', [ids.cellId]);
	return rows[0]?.state ?? 'unknown';
}

async function getLeaderboard(): Promise<LeaderboardRow | null> {
	const rows = await query<LeaderboardRow[]>(
		'SELECT completed_tasks, first_bingo_at FROM team_leaderboard WHERE team_id = ? AND user_id = ?',
		[ids.teamId, ids.completedByUserId]
	);
	return rows[0] ?? null;
}

beforeAll(async () => {
	await execute(
		'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
		[
			ids.completedByUserId,
			'completed_user',
			'completed@example.com',
			'hash',
			ids.memberUserId,
			'member_user',
			'member@example.com',
			'hash',
			ids.voterUserId,
			'voter_user',
			'voter@example.com',
			'hash',
			ids.fileUserId,
			'file_user',
			'file@example.com',
			'hash',
		]
	);

	await execute(
		'INSERT INTO teams (id, name, leader_user_id, status) VALUES (?, ?, ?, ?)',
		[ids.teamId, 'Test Team', ids.completedByUserId, 'started']
	);

	await execute(
		'INSERT INTO team_memberships (id, team_id, user_id, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
		[
			'9c9c8e3c-4b3f-4a3c-8c51-4c8d82f7fbf1',
			ids.teamId,
			ids.completedByUserId,
			'leader',
			'4f3a6c6b-9c21-4f1a-8b8e-32d1a9b1b2e6',
			ids.teamId,
			ids.memberUserId,
			'member',
		]
	);

	await execute(
		'INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope) VALUES (?, ?, ?, ?, ?, ?)',
		[ids.resolutionId, ids.completedByUserId, 'Test Resolution', 'Description', 'base', 'personal']
	);

	await execute(
		'INSERT INTO bingo_cards (id, team_id, user_id, grid_size) VALUES (?, ?, ?, ?)',
		[ids.cardId, ids.teamId, ids.completedByUserId, 5]
	);

	await execute(
		'INSERT INTO bingo_cells (id, card_id, position, source_type, state, resolution_id, resolution_type) VALUES ' +
			'(?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?)',
		[
			cellIds.pos0,
			ids.cardId,
			0,
			'personal',
			'pending',
			ids.resolutionId,
			'base',
			cellIds.pos1,
			ids.cardId,
			1,
			'personal',
			'pending',
			ids.resolutionId,
			'base',
			ids.cellId,
			ids.cardId,
			2,
			'personal',
			'pending_review',
			ids.resolutionId,
			'base',
			cellIds.pos3,
			ids.cardId,
			3,
			'personal',
			'pending',
			ids.resolutionId,
			'base',
			cellIds.pos4,
			ids.cardId,
			4,
			'personal',
			'pending',
			ids.resolutionId,
			'base',
			cellIds.pos7,
			ids.cardId,
			7,
			'personal',
			'pending',
			ids.resolutionId,
			'base',
			cellIds.pos17,
			ids.cardId,
			17,
			'personal',
			'pending',
			ids.resolutionId,
			'base',
			cellIds.pos22,
			ids.cardId,
			22,
			'personal',
			'pending',
			ids.resolutionId,
			'base',
			ids.otherCellId,
			ids.cardId,
			6,
			'personal',
			'pending',
			ids.resolutionId,
			'base',
		]
	);

	await execute(
		'INSERT INTO review_threads (id, cell_id, completed_by_user_id, status, created_at) VALUES (?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 3 DAY)), (?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 3 DAY))',
		[
			ids.reviewId,
			ids.cellId,
			ids.completedByUserId,
			'open',
			ids.otherReviewId,
			ids.otherCellId,
			ids.completedByUserId,
			'closed',
		]
	);
});

afterAll(async () => {
	await execute('DELETE FROM review_votes WHERE thread_id IN (?, ?)', [ids.reviewId, ids.otherReviewId]);
	await execute('DELETE FROM review_files WHERE thread_id IN (?, ?)', [ids.reviewId, ids.otherReviewId]);
	await execute('DELETE FROM review_messages WHERE thread_id IN (?, ?)', [ids.reviewId, ids.otherReviewId]);
	await execute('DELETE FROM review_threads WHERE id IN (?, ?)', [ids.reviewId, ids.otherReviewId]);
	await execute('DELETE FROM bingo_cells WHERE card_id = ?', [ids.cardId]);
	await execute('DELETE FROM bingo_cards WHERE id = ?', [ids.cardId]);
	await execute('DELETE FROM resolutions WHERE id = ?', [ids.resolutionId]);
	await execute('DELETE FROM team_leaderboard WHERE team_id = ?', [ids.teamId]);
	await execute('DELETE FROM team_memberships WHERE team_id = ?', [ids.teamId]);
	await execute('DELETE FROM teams WHERE id = ?', [ids.teamId]);
	await execute(
		'DELETE FROM users WHERE id IN (?, ?, ?, ?)',
		[ids.completedByUserId, ids.memberUserId, ids.voterUserId, ids.fileUserId]
	);
});

describe('stored procedure: CloseThreads', () => {
	test('closes thread and accomplishes cell when accept >= deny', async () => {
		// PREPARE
        const initialCompletedTasks = (await getLeaderboard())?.completed_tasks ?? 0;
        
        // ACT
        await execute('CALL CloseThreads');

        // ASSERT
		const status = await getThreadStatus();
		const state = await getCellState();
		const leaderboard = await getLeaderboard();
		const reviewFiles = await query<CountRow[]>(
			'SELECT COUNT(*) AS count FROM review_files WHERE thread_id = ?',
			[ids.reviewId]
		);

		expect(status).toBe('closed');
		expect(state).toBe('accomplished');
		expect(reviewFiles[0].count).toBe(0);
		expect(leaderboard?.completed_tasks).toBe(initialCompletedTasks + 1);
	});

	test('sets cell state to pending when deny > accept', async () => {
		await execute(
			'INSERT INTO review_votes (id, thread_id, voter_user_id, vote) VALUES (?, ?, ?, ?)',
			[ids.voteId, ids.reviewId, ids.voterUserId, 'deny']
		);

		await execute('CALL CloseThreads');

		const state = await getCellState();
		expect(state).toBe('pending');
	});

	test('accomplishes cell when no votes are cast', async () => {
		await execute('DELETE FROM review_votes WHERE thread_id = ?', [ids.reviewId]);

		await execute('CALL CloseThreads');

		const state = await getCellState();
		expect(state).toBe('accomplished');
	});

	test('keeps thread open when deadline not met', async () => {
		await execute('UPDATE review_threads SET created_at = CURDATE() WHERE id = ?', [ids.reviewId]);

		await execute('CALL CloseThreads');

		const status = await getThreadStatus();
		expect(status).toBe('open');
	});

	test('updates leaderboard when bingo is completed on a row', async () => {
		await execute(
			'UPDATE bingo_cells SET state = ? WHERE card_id = ? AND position IN (0, 1, 3, 4)',
			['accomplished', ids.cardId]
		);
		await execute(
			'INSERT INTO team_leaderboard (team_id, user_id, completed_tasks, first_bingo_at) VALUES (?, ?, ?, ?)',
			[ids.teamId, ids.completedByUserId, 4, null]
		);

		await execute('CALL CloseThreads');

		const leaderboard = await getLeaderboard();
		expect(leaderboard?.completed_tasks).toBe(5);
		expect(leaderboard?.first_bingo_at).not.toBeNull();
	});

	test('updates leaderboard when bingo is completed on a column with center joker', async () => {
		await execute(
			'UPDATE bingo_cells SET state = ? WHERE card_id = ? AND position IN (7, 17, 22)',
			['accomplished', ids.cardId]
		);
		await execute(
			'INSERT INTO team_leaderboard (team_id, user_id, completed_tasks, first_bingo_at) VALUES (?, ?, ?, ?)',
			[ids.teamId, ids.completedByUserId, 4, null]
		);

		await execute('CALL CloseThreads');

		const leaderboard = await getLeaderboard();
		expect(leaderboard?.completed_tasks).toBe(5);
		expect(leaderboard?.first_bingo_at).not.toBeNull();
	});

	test('removes review files for closed thread only', async () => {
		await execute(
			'INSERT INTO review_files (id, thread_id, uploaded_by_user_id, file_name, file_path, file_size) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)',
			[
				ids.reviewFileId,
				ids.reviewId,
				ids.fileUserId,
				'SHALL NOT EXIST',
				'path',
				12,
				ids.reviewFileIdOther,
				ids.otherReviewId,
				ids.fileUserId,
				'SHALL EXIST',
				'path',
				12,
			]
		);

		await execute('CALL CloseThreads');

		const reviewFileCounts = await query<CountRow[]>(
			'SELECT COUNT(*) AS count FROM review_files WHERE thread_id = ?',
			[ids.reviewId]
		);
		const otherFileCounts = await query<CountRow[]>(
			'SELECT COUNT(*) AS count FROM review_files WHERE thread_id = ?',
			[ids.otherReviewId]
		);

		expect(reviewFileCounts[0].count).toBe(0);
		expect(otherFileCounts[0].count).toBe(1);
	});
});
