/**
 * Bingo Card Generation - Builds the cards of a started team
 * Spec Reference: 05-bingo-card-generation.md
 */

import { randomUUID } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { BINGO_GRID_SIZE, CellSourceType, JOKER_POSITION, ResolutionType } from '../shared/types';
import { CardRow, rowToCard } from './bingo-card-rows';
import { query, withTransaction } from './connection';
import { getMemberProvidedResolutionsForUser, getRandomResolutions, getTeamGoalResolution } from './resolution-repository';
import { getTeamById, getTeamMembers } from './team-repository';
import { BingoCard, Resolution } from './types';

const TOTAL_CELLS = BINGO_GRID_SIZE * BINGO_GRID_SIZE;
/** The Joker takes one position and is not stored. */
const STORED_CELLS = TOTAL_CELLS - 1;

interface CellPlan {
  resolutionId: string | null;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  resolutionType: ResolutionType;
}

/**
 * Generate bingo cards for all team members
 * Spec: 05-bingo-card-generation.md - Generation Rules
 */
export async function generateBingoCardsForTeam(teamId: string): Promise<BingoCard[]> {
  const team = await getTeamById(teamId);
  if (!team || team.status !== 'started') {
    throw new Error('Team must be in started status to generate cards');
  }

  if (!team.teamResolutionText) {
    throw new Error('Team resolution must be set');
  }

  // Fetch the team goal resolution entity (needed for resolution_id on cells)
  const teamGoalResolution = await getTeamGoalResolution(teamId);
  if (!teamGoalResolution) {
    throw new Error('Team goal resolution entity not found');
  }

  const members = await getTeamMembers(teamId);

  return withTransaction(async (connection) => {
    const cards: BingoCard[] = [];

    for (const member of members) {
      const card = await generateCardForUser(
        connection,
        teamId,
        member.userId,
        teamGoalResolution
      );
      cards.push(card);
    }

    return cards;
  });
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

  const team = await getTeamById(teamId);
  if (!team) {
    return { created: false, error: 'Team not found' };
  }

  if (team.status !== 'started') {
    return { created: false, error: 'Team is not started' };
  }

  if (!team.teamResolutionText) {
    return { created: false, error: 'Team resolution must be set' };
  }

  const teamGoalResolution = await getTeamGoalResolution(teamId);
  if (!teamGoalResolution) {
    return { created: false, error: 'Team goal resolution entity not found' };
  }

  const card = await withTransaction((connection) =>
    generateCardForUser(connection, teamId, userId, teamGoalResolution)
  );
  return { created: true, card };
}
