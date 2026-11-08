/**
 * Bingo Card Generation - Builds the cards of a started game
 * Spec Reference: 05-bingo-card-generation.md
 */

import { randomUUID } from 'crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getResolutionTextKey } from '../shared/resolution-type';
import { shuffleArray } from '../shared/shuffle';
import type { PreparedResolution } from '../shared/types';
import {
  CellSourceType,
  getJokerPosition,
  PreparedResolutionCategory,
  ResolutionScope,
} from '../shared/types';
import { CardRow, rowToCard } from './bingo-card-rows';
import { EMPTY_SNAPSHOT, insertCellSubtasks, snapshotOf, type CellSnapshot } from './cell-snapshot';
import { execute, query, withTransaction } from './connection';
import { getGameById, getGamePlayerIds } from './game-repository';
import { refreshLeaderboardEntry } from './leaderboard-repository';
import {
  getRandomPreparedEntry,
  getRandomPreparedResolutions,
  preparedResolutionToContent,
} from './prepared-resolution-repository';
import {
  createResolution,
  getGameGoalResolution,
  getMemberProvidedResolutionsForUser,
  getRandomResolutions,
  getResolutionById,
} from './resolution-repository';
import { BingoCard, Game, GameStatus, Resolution } from './types';

/** The statuses in which a game can receive cards. */
type CardGenerationStatus = GameStatus.FORMING | GameStatus.STARTED;

const WRONG_STATUS_ERRORS: Record<CardGenerationStatus, string> = {
  [GameStatus.FORMING]: 'Game is not in forming status',
  [GameStatus.STARTED]: 'Game is not started',
};

/** The categories that replace empty cells, hardest first, in the order they are used. */
const EMPTY_CELL_FALLBACK_CATEGORIES = [
  PreparedResolutionCategory.LONG,
  PreparedResolutionCategory.MEDIUM,
  PreparedResolutionCategory.SHORT,
];

/** The content of one stored cell: where it comes from, and its copy of the definition. */
interface CellPlan {
  /** The resolution the cell is copied from; null for prepared and empty cells. */
  resolutionId: string | null;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  snapshot: CellSnapshot;
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
 * Start a game: mark it as started and generate a card for every player. A game without a team goal first gets a
 * random prepared entry as its goal, owned by its admin who joined first. All of it happens in one transaction, so
 * a failure leaves the game in forming status with no goal added.
 * Spec: 16-games.md - Automatic Start, 05-bingo-card-generation.md - Generation Rules
 *
 * @param gameId The game to start
 * @returns Whether the game started, and why not if it did not
 */
export async function startGameWithCards(gameId: string): Promise<{ success: boolean; error?: string }> {
  const game = await getGameById(gameId);
  if (!game) {
    return { success: false, error: 'Game not found' };
  }
  if (game.status !== GameStatus.FORMING) {
    return { success: false, error: WRONG_STATUS_ERRORS[GameStatus.FORMING] };
  }

  const playerIds = await getGamePlayerIds(gameId);

  return withTransaction<{ success: boolean; error?: string }>(async (connection) => {
    // The status guard stops two concurrent starts from generating cards, or a goal, twice.
    const statusUpdate = await execute(
      `UPDATE games SET status = 'started', started_at = NOW() WHERE id = ? AND status = 'forming'`,
      [gameId],
      connection
    );

    if (statusUpdate.affectedRows === 0) {
      return { success: false, error: WRONG_STATUS_ERRORS[GameStatus.FORMING] };
    }

    const teamGoalResolution = (await getGameGoalResolution(gameId)) ?? (await createFallbackGoal(connection, game));
    if (!teamGoalResolution) {
      return { success: false, error: 'No team goal is set and the prepared pool is empty' };
    }

    for (const playerId of playerIds) {
      await generateCardForUser(connection, game, playerId, teamGoalResolution, true);
    }

    return { success: true };
  }, (outcome) => outcome.success);
}

/**
 * Store a random prepared entry as the team goal of a game that has none, owned by the game's admin who joined
 * it first (or its first player, should no admin play it).
 * Spec: 16-games.md - Automatic Start
 * @param connection The start transaction
 * @param game The game being started
 * @returns The new goal, or null if the pool is empty
 */
async function createFallbackGoal(connection: PoolConnection, game: Game): Promise<Resolution | null> {
  const entry = await getRandomPreparedEntry(connection);
  const owners = await query<Array<RowDataPacket & { user_id: string }>>(
    `SELECT p.user_id
     FROM game_players p
     LEFT JOIN team_memberships m ON m.team_id = ? AND m.user_id = p.user_id AND m.role = 'leader'
     WHERE p.game_id = ?
     ORDER BY m.user_id IS NULL, p.joined_at, p.user_id
     LIMIT 1`,
    [game.teamId, game.id],
    connection
  );
  if (!entry || owners.length === 0) {
    return null;
  }

  const goalId = await createResolution(
    owners[0].user_id,
    preparedResolutionToContent(entry),
    { scope: ResolutionScope.TEAM, teamId: game.teamId, gameId: game.id },
    connection
  );
  return getResolutionById(goalId, connection);
}

/**
 * Count the other players of a game who provided no resolution for a user.
 * @param gameId The game
 * @param userId The card owner
 * @param provided The member-provided resolutions targeted to the card owner
 * @returns The number of missing proposals
 */
async function countMissingProposals(
  gameId: string,
  userId: string,
  provided: Resolution[]
): Promise<number> {
  const playerIds = await getGamePlayerIds(gameId);
  const authors = new Set(provided.map((resolution) => resolution.ownerUserId));

  return playerIds.filter((playerId) => playerId !== userId && !authors.has(playerId)).length;
}

/**
 * Choose the content of a user's stored cells, in shuffled order. Every cell gets its own
 * copy of the definition it is filled with (spec 05).
 * @param game The game the card belongs to
 * @param userId The card owner
 * @param teamGoalResolution The team goal
 * @param useFallbacks Whether prepared resolutions fill the gaps; see generateCardForUser
 * @returns One plan per stored cell
 */
async function planCells(
  game: Game,
  userId: string,
  teamGoalResolution: Resolution,
  useFallbacks: boolean
): Promise<CellPlan[]> {
  const plan: CellPlan[] = [];
  // The Joker takes the center position and is not stored
  const storedCells = game.gridSize * game.gridSize - 1;

  const usedTexts = new Set<string>();
  usedTexts.add(getResolutionTextKey(teamGoalResolution.title, teamGoalResolution.description));

  // The team goal always gets a cell, whatever the card size
  // Spec: 05-bingo-card-generation.md - Step 2
  plan.push({
    resolutionId: teamGoalResolution.id,
    sourceType: CellSourceType.TEAM,
    sourceUserId: null,
    snapshot: snapshotOf(teamGoalResolution),
  });

  const addUnique = (resolutions: Resolution[], sourceType: CellSourceType): void => {
    for (const res of resolutions) {
      if (plan.length >= storedCells) break; // Leave room for joker
      const resText = getResolutionTextKey(res.title, res.description);
      if (!usedTexts.has(resText)) {
        plan.push({
          resolutionId: res.id,
          sourceType,
          sourceUserId: res.ownerUserId,
          snapshot: snapshotOf(res),
        });
        usedTexts.add(resText);
      }
    }
  };

  // A prepared cell is copied straight from the pool entry (spec 17)
  const addPrepared = (entries: PreparedResolution[]): void => {
    for (const entry of entries) {
      if (plan.length >= storedCells) break;
      const text = getResolutionTextKey(entry.title, entry.description);
      if (usedTexts.has(text)) continue;

      plan.push({
        resolutionId: null,
        sourceType: CellSourceType.PREPARED,
        sourceUserId: null,
        snapshot: snapshotOf(entry),
      });
      usedTexts.add(text);
    }
  };

  // Add member-provided resolutions in random order, so the ones that fit a small card are a random pick
  // Spec: 05-bingo-card-generation.md - Step 3
  const memberProvided = await getMemberProvidedResolutionsForUser(game.id, userId);
  const memberProvidedInRandomOrder = [...memberProvided];
  shuffleArray(memberProvidedInRandomOrder);
  addUnique(memberProvidedInRandomOrder, CellSourceType.MEMBER_PROVIDED);

  // Replace every missing proposal with an easy prepared resolution, while cells are left
  // Spec: 05-bingo-card-generation.md - Step 4
  if (useFallbacks) {
    const missing = await countMissingProposals(game.id, userId, memberProvided);
    addPrepared(
      await getRandomPreparedResolutions(PreparedResolutionCategory.SHORT, missing, Array.from(usedTexts))
    );
  }

  // Fill remaining with the owner's personal resolutions of this game
  // Spec: 05-bingo-card-generation.md - Step 5
  const neededPersonal = storedCells - plan.length;
  if (neededPersonal > 0) {
    const personalResolutions = await getRandomResolutions(
      game.id,
      userId,
      neededPersonal * 2, // Get extra in case of duplicates
      Array.from(usedTexts)
    );
    addUnique(personalResolutions, CellSourceType.PERSONAL);
  }

  // Replace would-be empty cells with prepared resolutions, hardest first
  // Spec: 05-bingo-card-generation.md - Step 6
  if (useFallbacks) {
    for (const category of EMPTY_CELL_FALLBACK_CATEGORIES) {
      addPrepared(
        await getRandomPreparedResolutions(category, storedCells - plan.length, Array.from(usedTexts))
      );
    }
  }

  // Fill any remaining with empty cells
  // Spec: 05-bingo-card-generation.md - Step 7
  while (plan.length < storedCells) {
    plan.push({
      resolutionId: null,
      sourceType: CellSourceType.EMPTY,
      sourceUserId: null,
      snapshot: EMPTY_SNAPSHOT,
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
 * @param connection The transaction to generate in
 * @param game The game the card belongs to
 * @param userId The card owner
 * @param teamGoalResolution The team goal
 * @param useFallbacks Whether prepared resolutions fill the gaps: true at game start, false
 *   for a member joining a started game
 * @returns The new card
 */
async function generateCardForUser(
  connection: PoolConnection,
  game: Game,
  userId: string,
  teamGoalResolution: Resolution,
  useFallbacks: boolean
): Promise<BingoCard> {
  // Create the card
  const cardId = randomUUID();
  await connection.execute(
    `INSERT INTO bingo_cards (id, team_id, game_id, user_id, grid_size) VALUES (?, ?, ?, ?, ?)`,
    [cardId, game.teamId, game.id, userId, game.gridSize]
  );

  const plan = await planCells(game, userId, teamGoalResolution, useFallbacks);

  // Insert cells into database
  // The Joker cell is implicit (always at center position) and is NOT stored in the database.
  // Spec (updated): 05-bingo-card-generation.md
  const jokerPosition = getJokerPosition(game.gridSize);
  const positions = Array.from({ length: game.gridSize * game.gridSize }, (_, position) => position)
    .filter((position) => position !== jokerPosition);

  for (const [index, position] of positions.entries()) {
    const data = plan[index];
    const cellId = randomUUID();

    await connection.execute(
      `INSERT INTO bingo_cells
       (id, card_id, position, resolution_id, resolution_type, source_type, source_user_id, state,
        title, description, number_of_repetition, completed_times)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 0)`,
      [
        cellId,
        cardId,
        position,
        data.resolutionId,
        data.snapshot.resolutionType,
        data.sourceType,
        data.sourceUserId,
        data.snapshot.title,
        data.snapshot.description,
        data.snapshot.numberOfRepetition,
      ]
    );
    await insertCellSubtasks(connection, cellId, data.snapshot.subtasks);
  }

  return {
    id: cardId,
    gameId: game.id,
    teamId: game.teamId,
    userId,
    gridSize: game.gridSize,
    createdAt: new Date(),
    lockedAt: null,
  };
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

  // The late joiner's goal cell is a fresh copy with its own progress (spec 16)
  const { game, teamGoalResolution: goal } = context;
  const card = await withTransaction((connection) =>
    generateCardForUser(connection, game, userId, goal, false)
  );

  await refreshLeaderboardEntry(gameId, userId);

  return { created: true, card };
}
