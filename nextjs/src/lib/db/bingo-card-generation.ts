/**
 * Bingo Card Generation - Builds the cards of a started team
 * Spec Reference: 05-bingo-card-generation.md
 */

import { randomUUID } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { BINGO_GRID_SIZE, CellSourceType, JOKER_POSITION, ResolutionType } from '../shared/types';
import { CardRow, rowToCard } from './bingo-card-rows';
import { autoTransitionCellState } from './bingo-cell-repository';
import { execute, query, withTransaction } from './connection';
import { getMemberProvidedResolutionsForUser, getRandomResolutions, getTeamGoalResolution, isProgressComplete } from './resolution-repository';
import { getTeamById, getTeamMembers } from './team-repository';
import { BingoCard, Resolution, TeamStatus } from './types';

const TOTAL_CELLS = BINGO_GRID_SIZE * BINGO_GRID_SIZE;
/** The Joker takes one position and is not stored. */
const STORED_CELLS = TOTAL_CELLS - 1;

const WRONG_STATUS_ERRORS: Record<TeamStatus, string> = {
  [TeamStatus.FORMING]: 'Team is not in forming status',
  [TeamStatus.STARTED]: 'Team is not started',
};

interface CellPlan {
  resolutionId: string | null;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  resolutionType: ResolutionType;
}

/**
 * Check that a team can have cards and load the goal they are built around.
 * @param teamId The team to check
 * @param requiredStatus The status the team must be in
 * @returns The team goal, or the error explaining why cards cannot be generated
 */
async function loadTeamGameContext(
  teamId: string,
  requiredStatus: TeamStatus
): Promise<{ teamGoalResolution: Resolution } | { error: string }> {
  const team = await getTeamById(teamId);
  if (!team) {
    return { error: 'Team not found' };
  }

  if (team.status !== requiredStatus) {
    return { error: WRONG_STATUS_ERRORS[requiredStatus] };
  }

  if (!team.teamResolutionText) {
    return { error: 'Team resolution must be set' };
  }

  // Fetch the team goal resolution entity (needed for resolution_id on cells)
  const teamGoalResolution = await getTeamGoalResolution(teamId);
  if (!teamGoalResolution) {
    return { error: 'Team goal resolution entity not found' };
  }

  return { teamGoalResolution };
}

/**
 * Start a team's game: mark it as started and generate a card for every member.
 * Both happen in one transaction, so a failure leaves the team in forming status.
 * Spec: 04-bingo-teams.md - Start Conditions, 05-bingo-card-generation.md - Generation Rules
 *
 * @param teamId The team to start
 * @returns Whether the game started, and why not if it did not
 */
export async function startGameWithCards(teamId: string): Promise<{ success: boolean; error?: string }> {
  const context = await loadTeamGameContext(teamId, TeamStatus.FORMING);
  if ('error' in context) {
    return { success: false, error: context.error };
  }

  const members = await getTeamMembers(teamId);

  return withTransaction<{ success: boolean; error?: string }>(async (connection) => {
    // The status guard stops two concurrent starts from generating cards twice.
    const statusUpdate = await execute(
      `UPDATE teams SET status = 'started' WHERE id = ? AND status = 'forming'`,
      [teamId],
      connection
    );

    if (statusUpdate.affectedRows === 0) {
      return { success: false, error: WRONG_STATUS_ERRORS[TeamStatus.FORMING] };
    }

    for (const member of members) {
      await generateCardForUser(connection, teamId, member.userId, context.teamGoalResolution);
    }

    return { success: true };
  }, (outcome) => outcome.success);
}

/**
 * Choose the content of a user's stored cells, in shuffled order.
 * @param teamId The team the card belongs to
 * @param userId The card owner
 * @param teamGoalResolution The team goal
 * @returns One plan per stored cell
 */
async function planCells(
  teamId: string,
  userId: string,
  teamGoalResolution: Resolution
): Promise<CellPlan[]> {
  const plan: CellPlan[] = [];

  const usedTexts = new Set<string>();
  usedTexts.add(teamGoalResolution.description?.toLowerCase() || teamGoalResolution.title.toLowerCase());

  const addUnique = (resolutions: Resolution[], sourceType: CellSourceType): void => {
    for (const res of resolutions) {
      if (plan.length >= STORED_CELLS) break; // Leave room for joker
      const resText = (res.description || res.title).toLowerCase();
      if (!usedTexts.has(resText)) {
        plan.push({
          resolutionId: res.id,
          sourceType,
          sourceUserId: res.ownerUserId,
          resolutionType: res.resolutionType,
        });
        usedTexts.add(resText);
      }
    }
  };

  // Add member-provided resolutions (highest priority)
  // Spec: 05-bingo-card-generation.md - Step 3
  addUnique(await getMemberProvidedResolutionsForUser(teamId, userId), CellSourceType.MEMBER_PROVIDED);

  // Add team resolution as a completable cell (second priority)
  if (plan.length < STORED_CELLS) {
    plan.push({
      resolutionId: teamGoalResolution.id,
      sourceType: CellSourceType.TEAM,
      sourceUserId: null,
      resolutionType: teamGoalResolution.resolutionType,
    });
  }

  // Fill remaining with personal resolutions
  // Spec: 05-bingo-card-generation.md - Step 4
  const neededPersonal = STORED_CELLS - plan.length;
  if (neededPersonal > 0) {
    const personalResolutions = await getRandomResolutions(
      userId,
      neededPersonal * 2, // Get extra in case of duplicates
      Array.from(usedTexts)
    );
    addUnique(personalResolutions, CellSourceType.PERSONAL);
  }

  // Fill any remaining with empty cells
  // Spec: 05-bingo-card-generation.md - Step 5
  while (plan.length < STORED_CELLS) {
    plan.push({
      resolutionId: null,
      sourceType: CellSourceType.EMPTY,
      sourceUserId: null,
      resolutionType: ResolutionType.BASE,
    });
  }

  // Shuffle the cells (excluding joker position)
  // Spec: 05-bingo-card-generation.md - randomize selection
  shuffleArray(plan);

  return plan;
}

/**
 * Generate a single card for a user
 * Internal helper
 */
async function generateCardForUser(
  connection: PoolConnection,
  teamId: string,
  userId: string,
  teamGoalResolution: Resolution
): Promise<BingoCard> {
  // Create the card
  const cardId = randomUUID();
  await connection.execute(
    `INSERT INTO bingo_cards (id, team_id, user_id, grid_size) VALUES (?, ?, ?, ?)`,
    [cardId, teamId, userId, BINGO_GRID_SIZE]
  );

  const plan = await planCells(teamId, userId, teamGoalResolution);

  // Insert cells into database
  // The Joker cell is implicit (always at center position) and is NOT stored in the database.
  // Spec (updated): 05-bingo-card-generation.md
  const positions = Array.from({ length: TOTAL_CELLS }, (_, position) => position)
    .filter((position) => position !== JOKER_POSITION);

  for (const [index, position] of positions.entries()) {
    const data = plan[index];

    await connection.execute(
      `INSERT INTO bingo_cells
       (id, card_id, position, resolution_id, resolution_type, source_type, source_user_id, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        randomUUID(),
        cardId,
        position,
        data.resolutionId,
        data.resolutionType,
        data.sourceType,
        data.sourceUserId,
      ]
    );
  }

  return {
    id: cardId,
    teamId,
    userId,
    gridSize: BINGO_GRID_SIZE,
    createdAt: new Date(),
  };
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Ensure a user has a bingo card for a started team.
 * Spec: 04-bingo-teams.md - Joining After Start
 */
export async function ensureBingoCardForUser(
  teamId: string,
  userId: string
): Promise<{ created: boolean; card?: BingoCard; error?: string }> {
  const existing = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE team_id = ? AND user_id = ? LIMIT 1`,
    [teamId, userId]
  );

  if (existing.length > 0) {
    return { created: false, card: rowToCard(existing[0]) };
  }

  const context = await loadTeamGameContext(teamId, TeamStatus.STARTED);
  if ('error' in context) {
    return { created: false, error: context.error };
  }

  const goal = context.teamGoalResolution;
  const card = await withTransaction((connection) =>
    generateCardForUser(connection, teamId, userId, goal)
  );

  // A late joiner's goal cell must match progress the leader has already made
  if (goal.resolutionType !== ResolutionType.BASE) {
    await autoTransitionCellState(goal.id, goal.resolutionType, isProgressComplete(goal));
  }

  return { created: true, card };
}
