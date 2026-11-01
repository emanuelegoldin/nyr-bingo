/**
 * Bingo Card Generation - Builds the cards of a started game
 * Spec Reference: 05-bingo-card-generation.md
 */

import { randomUUID } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { BINGO_GRID_SIZE, CellSourceType, JOKER_POSITION, ResolutionType } from '../shared/types';
import { CardRow, rowToCard } from './bingo-card-rows';
import { autoTransitionCellState } from './bingo-cell-repository';
import { execute, query, withTransaction } from './connection';
import { refreshLeaderboardEntry } from './leaderboard-repository';
import { getGameById } from './game-repository';
import { getGameGoalResolution, getMemberProvidedResolutionsForUser, getRandomResolutions, isProgressComplete } from './resolution-repository';
import { getTeamMembers } from './team-repository';
import { BingoCard, Game, GameStatus, Resolution } from './types';

const TOTAL_CELLS = BINGO_GRID_SIZE * BINGO_GRID_SIZE;
/** The Joker takes one position and is not stored. */
const STORED_CELLS = TOTAL_CELLS - 1;

/** The statuses in which a game can receive cards. */
type CardGenerationStatus = GameStatus.FORMING | GameStatus.STARTED;

const WRONG_STATUS_ERRORS: Record<CardGenerationStatus, string> = {
  [GameStatus.FORMING]: 'Game is not in forming status',
  [GameStatus.STARTED]: 'Game is not started',
};

interface CellPlan {
  resolutionId: string | null;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  resolutionType: ResolutionType;
}

/**
 * Check that a game can have cards and load the goal they are built around.
 * @param gameId The game to check
 * @param requiredStatus The status the game must be in
 * @returns The game and its team goal, or the error explaining why cards cannot be generated
 */
async function loadGameContext(
  gameId: string,
  requiredStatus: CardGenerationStatus
): Promise<{ game: Game; teamGoalResolution: Resolution } | { error: string }> {
  const game = await getGameById(gameId);
  if (!game) {
    return { error: 'Game not found' };
  }

  if (game.status !== requiredStatus) {
    return { error: WRONG_STATUS_ERRORS[requiredStatus] };
  }

  if (!game.teamResolutionText) {
    return { error: 'Team resolution must be set' };
  }

  // Fetch the team goal resolution entity (needed for resolution_id on cells)
  const teamGoalResolution = await getGameGoalResolution(gameId);
  if (!teamGoalResolution) {
    return { error: 'Team goal resolution entity not found' };
  }

  return { game, teamGoalResolution };
}

/**
 * Start a game: mark it as started and generate a card for every team member.
 * Both happen in one transaction, so a failure leaves the game in forming status.
 * Spec: 16-games.md - Start Conditions, 05-bingo-card-generation.md - Generation Rules
 *
 * @param gameId The game to start
 * @returns Whether the game started, and why not if it did not
 */
export async function startGameWithCards(gameId: string): Promise<{ success: boolean; error?: string }> {
  const context = await loadGameContext(gameId, GameStatus.FORMING);
  if ('error' in context) {
    return { success: false, error: context.error };
  }

  const { game, teamGoalResolution } = context;
  const members = await getTeamMembers(game.teamId);

  return withTransaction<{ success: boolean; error?: string }>(async (connection) => {
    // The status guard stops two concurrent starts from generating cards twice.
    const statusUpdate = await execute(
      `UPDATE games SET status = 'started' WHERE id = ? AND status = 'forming'`,
      [gameId],
      connection
    );

    if (statusUpdate.affectedRows === 0) {
      return { success: false, error: WRONG_STATUS_ERRORS[GameStatus.FORMING] };
    }

    for (const member of members) {
      await generateCardForUser(connection, game, member.userId, teamGoalResolution);
    }

    return { success: true };
  }, (outcome) => outcome.success);
}

/**
 * Choose the content of a user's stored cells, in shuffled order.
 * @param gameId The game the card belongs to
 * @param userId The card owner
 * @param teamGoalResolution The team goal
 * @returns One plan per stored cell
 */
async function planCells(
  gameId: string,
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
  addUnique(await getMemberProvidedResolutionsForUser(gameId, userId), CellSourceType.MEMBER_PROVIDED);

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
  game: Game,
  userId: string,
  teamGoalResolution: Resolution
): Promise<BingoCard> {
  // Create the card
  const cardId = randomUUID();
  await connection.execute(
    `INSERT INTO bingo_cards (id, team_id, game_id, user_id, grid_size) VALUES (?, ?, ?, ?, ?)`,
    [cardId, game.teamId, game.id, userId, BINGO_GRID_SIZE]
  );

  const plan = await planCells(game.id, userId, teamGoalResolution);

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
    gameId: game.id,
    teamId: game.teamId,
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
 * Ensure a user has a bingo card for a started game.
 * Spec: 16-games.md - Joining After Start
 */
export async function ensureBingoCardForUser(
  gameId: string,
  userId: string
): Promise<{ created: boolean; card?: BingoCard; error?: string }> {
  const existing = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE game_id = ? AND user_id = ? LIMIT 1`,
    [gameId, userId]
  );

  if (existing.length > 0) {
    return { created: false, card: rowToCard(existing[0]) };
  }

  const context = await loadGameContext(gameId, GameStatus.STARTED);
  if ('error' in context) {
    return { created: false, error: context.error };
  }

  const { game, teamGoalResolution: goal } = context;
  const card = await withTransaction((connection) =>
    generateCardForUser(connection, game, userId, goal)
  );

  // A late joiner's goal cell must match progress the leader has already made
  if (goal.resolutionType !== ResolutionType.BASE) {
    await autoTransitionCellState(goal.id, goal.resolutionType, isProgressComplete(goal));
  }

  await refreshLeaderboardEntry(gameId, userId);

  return { created: true, card };
}
