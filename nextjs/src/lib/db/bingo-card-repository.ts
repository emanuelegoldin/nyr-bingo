/**
 * Bingo Card Repository - Database operations for bingo cards
 * Spec Reference: 05-bingo-card-generation.md, 06-bingo-gameplay.md
 */

import { query, getConnection } from './connection';
import {
  BingoCard,
  BingoCell,
  BingoCellWithProof,
  BingoCardWithCells,
  CellProof,
} from './types';
import { randomUUID } from 'crypto';
import { getTeamById, getTeamMembers, isTeamMember } from './team-repository';
import { getTeamProvidedResolutionsForUser } from './team-repository';
import { getRandomResolutions } from './resolution-repository';
import { CellSourceType, CellState, ProofStatus, ResolutionType } from '../shared/types';
import { refreshLeaderboardEntry } from './leaderboard-repository';

// Row types from database
interface CardRow {
  id: string;
  team_id: string;
  user_id: string;
  grid_size: number;
  created_at: Date;
}

interface CellRow {
  id: string;
  card_id: string;
  position: number;
  resolution_id: string | null;
  team_provided_resolution_id: string | null;
  resolution_type: ResolutionType;
  // Derived display text (resolved from joins)
  resolution_text: string;
  resolution_title: string;
  is_empty: boolean | number;
  source_type: CellSourceType;
  source_user_id: string | null;
  state: CellState;
  created_at: Date;
  updated_at: Date;
}

interface ProofRow {
  id: string;
  cell_id: string;
  file_url: string | null;
  comment: string | null;
  status: ProofStatus;
  created_at: Date;
  updated_at: Date;
}

// Convert functions
function rowToCard(row: CardRow): BingoCard {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    gridSize: row.grid_size,
    createdAt: row.created_at,
  };
}

function rowToCell(row: CellRow): BingoCell {
  return {
    id: row.id,
    cardId: row.card_id,
    position: row.position,
    resolutionId: row.resolution_id,
    teamProvidedResolutionId: row.team_provided_resolution_id,
    resolutionType: row.resolution_type,
    resolutionText: row.resolution_text,
    resolutionTitle: row.resolution_title,
    // Spec: 05-bingo-card-generation.md - Joker is implicit and not stored in the DB.
    isJoker: false,
    isEmpty: Boolean(row.is_empty),
    sourceType: row.source_type,
    sourceUserId: row.source_user_id,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_CELL_WITH_RESOLVED_TEXT = `
  SELECT
    c.id,
    c.card_id,
    c.position,
    c.resolution_id,
    c.team_provided_resolution_id,
    c.resolution_type,
    CASE
      WHEN c.is_empty THEN 'Empty'
      WHEN c.source_type = 'team' THEN COALESCE(t.team_resolution_text, 'Team Goal')
      WHEN c.team_provided_resolution_id IS NOT NULL THEN tpr.text
      WHEN c.resolution_type = 'compound' THEN COALESCE(cr.description, '')
      WHEN c.resolution_type = 'iterative' THEN COALESCE(ir.description, '')
      WHEN c.resolution_id IS NOT NULL THEN r.text
      ELSE ''
    END AS resolution_text,
    CASE
      WHEN c.is_empty THEN 'Empty'
      WHEN c.source_type = 'team' THEN COALESCE(t.team_resolution_text, 'Team Goal')
      WHEN c.team_provided_resolution_id IS NOT NULL THEN tpr.title
      WHEN c.resolution_type = 'compound' THEN COALESCE(cr.title, '')
      WHEN c.resolution_type = 'iterative' THEN COALESCE(ir.title, '')
      WHEN c.resolution_id IS NOT NULL THEN r.title
      ELSE ''
    END AS resolution_title,
    c.is_empty,
    c.source_type,
    c.source_user_id,
    c.state,
    c.created_at,
    c.updated_at
  FROM bingo_cells c
  JOIN bingo_cards bc ON c.card_id = bc.id
  JOIN teams t ON bc.team_id = t.id
  LEFT JOIN resolutions r ON c.resolution_id = r.id AND c.resolution_type = 'base'
  LEFT JOIN team_provided_resolutions tpr ON c.team_provided_resolution_id = tpr.id
  LEFT JOIN compound_resolutions cr ON c.resolution_id = cr.id AND c.resolution_type = 'compound'
  LEFT JOIN iterative_resolutions ir ON c.resolution_id = ir.id AND c.resolution_type = 'iterative'
`;

async function getResolvedCellRowById(cellId: string): Promise<CellRow | null> {
  const rows = await query<CellRow[]>(
    `${SELECT_CELL_WITH_RESOLVED_TEXT}
     WHERE c.id = ?`,
    [cellId]
  );
  return rows.length > 0 ? rows[0] : null;
}

function rowToProof(row: ProofRow): CellProof {
  return {
    id: row.id,
    cellId: row.cell_id,
    fileUrl: row.file_url,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

  const members = await getTeamMembers(teamId);
  const cards: BingoCard[] = [];

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    for (const member of members) {
      const card = await generateCardForUser(
        connection,
        teamId,
        member.userId,
        team.teamResolutionText
      );
      cards.push(card);
    }

    await connection.commit();
    return cards;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Generate a single card for a user
 * Internal helper
 */
async function generateCardForUser(
  connection: Awaited<ReturnType<typeof getConnection>>,
  teamId: string,
  userId: string,
  teamResolutionText: string
): Promise<BingoCard> {
  const gridSize = 5;
  const totalCells = gridSize * gridSize;
  const centerPosition = 12; // Center of 5x5 grid (0-indexed)

  // Create the card
    const cardId = randomUUID();
    await connection.execute(
      `INSERT INTO bingo_cards (id, team_id, user_id, grid_size) VALUES (?, ?, ?, ?)`,
      [cardId, teamId, userId, gridSize]
    );

  // Get member-provided resolutions for this user
  // Spec: 05-bingo-card-generation.md - Step 3
  const providedResolutions = await getTeamProvidedResolutionsForUser(teamId, userId);
  
  // Collect resolution texts with source info
  const cellData: {
    text: string;
    resolutionId: string | null;
    teamProvidedResolutionId: string | null;
    sourceType: CellSourceType;
    sourceUserId: string | null;
    isJoker: boolean;
    isEmpty: boolean;
  }[] = [];

  const usedTexts = new Set<string>();
  usedTexts.add(teamResolutionText.toLowerCase());

  // Add member-provided resolutions (highest priority)
  // Spec: 05-bingo-card-generation.md - Step 3
  for (const res of providedResolutions) {
    if (cellData.length >= totalCells - 1) break; // Leave room for joker
    if (!usedTexts.has(res.text.toLowerCase())) {
      cellData.push({
        text: res.text,
        resolutionId: null,
        teamProvidedResolutionId: res.id,
        sourceType: CellSourceType.MEMBER_PROVIDED,
        sourceUserId: res.fromUserId,
        isJoker: false,
        isEmpty: false,
      });
      usedTexts.add(res.text.toLowerCase());
    }
  }

  // Add team resolution as a completable cell (second priority)
  if (cellData.length < totalCells - 1) {
    cellData.push({
      text: teamResolutionText,
      resolutionId: null,
      teamProvidedResolutionId: null,
      sourceType: CellSourceType.TEAM,
      sourceUserId: null,
      isJoker: false,
      isEmpty: false,
    });
  }

  // Fill remaining with personal resolutions
  // Spec: 05-bingo-card-generation.md - Step 4
  const neededPersonal = totalCells - 1 - cellData.length;
  if (neededPersonal > 0) {
    const personalResolutions = await getRandomResolutions(
      userId,
      neededPersonal * 2, // Get extra in case of duplicates
      Array.from(usedTexts)
    );

    for (const res of personalResolutions) {
      if (cellData.length >= totalCells - 1) break;
      if (!usedTexts.has(res.text.toLowerCase())) {
        cellData.push({
          text: res.text,
          resolutionId: res.id,
          teamProvidedResolutionId: null,
          sourceType: CellSourceType.PERSONAL,
          sourceUserId: userId,
          isJoker: false,
          isEmpty: false,
        });
        usedTexts.add(res.text.toLowerCase());
      }
    }
  }

  // Fill any remaining with empty cells
  // Spec: 05-bingo-card-generation.md - Step 5
  while (cellData.length < totalCells - 1) {
    cellData.push({
      text: 'Empty',
      resolutionId: null,
      teamProvidedResolutionId: null,
      sourceType: CellSourceType.EMPTY,
      sourceUserId: null,
      isJoker: false,
      isEmpty: true,
    });
  }

  // Shuffle the cells (excluding joker position)
  // Spec: 05-bingo-card-generation.md - randomize selection
  shuffleArray(cellData);

  // Insert cells into database
  // The Joker cell is implicit (always at center position) and is NOT stored in the database.
  // Spec (updated): 05-bingo-card-generation.md
  let dataIndex = 0;
  for (let position = 0; position < totalCells; position++) {
    if (position === centerPosition) continue;

    const cellId = randomUUID();
    const data = cellData[dataIndex];
    dataIndex += 1;

    await connection.execute(
      `INSERT INTO bingo_cells 
       (id, card_id, position, resolution_id, team_provided_resolution_id, resolution_type, source_type, source_user_id, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        cellId,
        cardId,
        position,
        data.resolutionId,
        data.teamProvidedResolutionId,
        data.sourceType === CellSourceType.TEAM ? ResolutionType.TEAM : ResolutionType.BASE,
        data.sourceType,
        data.sourceUserId,
      ]
    );
  }

  return {
    id: cardId,
    teamId,
    userId,
    gridSize,
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
 * Get bingo card for a user in a team
 */
export async function getBingoCard(
  teamId: string,
  userId: string
): Promise<BingoCardWithCells | null> {
  const cardRows = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE team_id = ? AND user_id = ?`,
    [teamId, userId]
  );

  if (cardRows.length === 0) return null;

  const card = rowToCard(cardRows[0]);
  const cells = await getCellsWithProofs(card.id);

  return {
    ...card,
    cells,
  };
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

  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const card = await generateCardForUser(connection, teamId, userId, team.teamResolutionText);
    await connection.commit();
    return { created: true, card };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get bingo card by ID
 */
export async function getBingoCardById(cardId: string): Promise<BingoCardWithCells | null> {
  const cardRows = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE id = ?`,
    [cardId]
  );

  if (cardRows.length === 0) return null;

  const card = rowToCard(cardRows[0]);
  const cells = await getCellsWithProofs(card.id);

  return {
    ...card,
    cells,
  };
}

/**
 * Get cells with proofs for a card
 */
async function getCellsWithProofs(cardId: string): Promise<BingoCellWithProof[]> {
  const cellRows = await query<CellRow[]>(
    `${SELECT_CELL_WITH_RESOLVED_TEXT}
     WHERE c.card_id = ?
     ORDER BY c.position ASC`,
    [cardId]
  );

  const cells: BingoCellWithProof[] = [];

  for (const row of cellRows) {
    const cell = rowToCell(row);

    // Get latest proof if any
    const proofRows = await query<ProofRow[]>(
      `SELECT * FROM cell_proofs WHERE cell_id = ? ORDER BY created_at DESC LIMIT 1`,
      [cell.id]
    );

    const threadRows = await query<{ id: string }[]>(
      `SELECT id FROM review_threads WHERE cell_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
      [cell.id]
    );

    cells.push({
      ...cell,
      proof: proofRows.length > 0 ? rowToProof(proofRows[0]) : null,
      reviewThreadId: threadRows.length > 0 ? threadRows[0].id : null,
    });
  }

  // Ensure the implicit Joker cell exists in the returned grid.
  // It is not stored in the DB; we synthesize it for the UI.
  const centerPosition = 12;
  const hasCenter = cells.some((c) => c.position === centerPosition);
  if (!hasCenter) {
    cells.push({
      id: `joker:${cardId}`,
      cardId,
      position: centerPosition,
      resolutionId: null,
      teamProvidedResolutionId: null,
      resolutionType: ResolutionType.TEAM,
      resolutionText: 'Joker',
      resolutionTitle: 'Joker',
      isJoker: true,
      isEmpty: false,
      sourceType: CellSourceType.TEAM,
      sourceUserId: null,
      state: CellState.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      proof: null,
      reviewThreadId: null,
    });
  }

  cells.sort((a, b) => a.position - b.position);

  return cells;
}

/**
 * Update cell state
 * Spec: 06-bingo-gameplay.md - Card State
 * Updated: Support new states for proof workflow
 */
export async function updateCellState(
  cellId: string,
  userId: string,
  newState: CellState
): Promise<{ success: boolean; error?: string; cell?: BingoCell }> {
  // Spec: 05-bingo-card-generation.md, 06-bingo-gameplay.md - Joker is implicit and not modifiable.
  if (cellId.startsWith('joker:')) {
    return { success: false, error: 'Joker cell cannot be modified' };
  }

  // Get the cell and verify ownership
  const cellRows = await query<Array<
    { id: string; is_empty: boolean | number; state: CellState; card_user_id: string; team_id: string }
  >>(
    `SELECT c.id, c.is_empty, c.state, bc.user_id as card_user_id, bc.team_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.id = ?`,
    [cellId]
  );

  if (cellRows.length === 0) {
    return { success: false, error: 'Cell not found' };
  }

  const cell = cellRows[0];

  // Spec: 06-bingo-gameplay.md - Only the card owner can change their card's cell states
  if (cell.card_user_id !== userId) {
    return { success: false, error: 'Only the card owner can update cell state' };
  }

  // Spec: 06-bingo-gameplay.md - "empty" filler cells cannot be marked completed
  if (cell.is_empty && (newState === 'completed' || newState === 'accomplished')) {
    return { success: false, error: 'Empty cells cannot be marked as completed' };
  }

  // Validate state transitions
  // pending -> completed (user marks as done)
  // completed -> pending (user undoes)
  // pending_review can only be changed by voting system, not directly
  // accomplished is final (can only be reset to pending via undo)
  if (newState === 'pending_review') {
    return { success: false, error: 'Cannot directly set pending_review state' };
  }

  // Determine which source states are valid for this transition.
  // Using a WHERE guard prevents races with concurrent proof requests.
  let validFromStates: string[];
  if (newState === 'completed') {
    validFromStates = ['pending'];
  } else if (newState === 'pending') {
    validFromStates = ['completed'];
  } else if (newState === 'accomplished') {
    validFromStates = ['pending_review'];
  } else {
    validFromStates = ['pending', 'completed', 'pending_review', 'accomplished'];
  }

  const placeholders = validFromStates.map(() => '?').join(', ');
  const updateResult = await query<{ affectedRows: number }>(
    `UPDATE bingo_cells SET state = ? WHERE id = ? AND state IN (${placeholders})`,
    [newState, cellId, ...validFromStates]
  );

  // For UPDATE queries, query<T>() returns the mysql2 ResultSetHeader
  // which has an affectedRows field.
  if (updateResult.affectedRows === 0) {
    return { success: false, error: 'Cell state has changed — please refresh and try again' };
  }

  // Refresh persisted leaderboard data after state change
  await refreshLeaderboardEntry(cell.team_id, userId);

  const updatedRow = await getResolvedCellRowById(cellId);
  if (!updatedRow) {
    return { success: false, error: 'Cell not found' };
  }

  return { success: true, cell: rowToCell(updatedRow) };
}

export async function updateCellContent(
  cellId: string,
  userId: string,
  update: {
    resolutionId: string | null;
    resolutionType?: ResolutionType;
    teamProvidedResolutionId: string | null;
    sourceType: CellSourceType;
    sourceUserId: string | null;
  }
): Promise<{ success: boolean; error?: string; cell?: BingoCell }> {

  // Spec: 05-bingo-card-generation.md, 09-bingo-card-editing.md - Joker is implicit and immutable.
  if (cellId.startsWith('joker:')) {
    return { success: false, error: 'Joker cell cannot be modified' };
  }

  if (update.sourceType === 'personal' && !update.resolutionId) {
    return { success: false, error: 'resolutionId is required for personal cells' };
  }

  if (update.sourceType === 'member_provided' && !update.teamProvidedResolutionId) {
    return { success: false, error: 'teamProvidedResolutionId is required for member_provided cells' };
  }

  // Get the cell (and card owner) for authorization and joker protection
  const cellRows = await query<Array<{ source_type: CellSourceType; card_user_id: string }>>(
    `SELECT c.source_type, bc.user_id as card_user_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.id = ?`,
    [cellId]
  );

  if (cellRows.length === 0) {
    return { success: false, error: 'Cell not found' };
  }

  const cell = cellRows[0];

  if (cell.card_user_id !== userId) {
    return { success: false, error: 'Only the card owner can edit cell content' };
  }

  // Team resolution cells are immutable (same as Joker for edit-card flow)
  if (cell.source_type === 'team') {
    return { success: false, error: 'Team resolution cell cannot be modified' };
  }

  // Prevent storing ids for types that shouldn't have them
  if (update.sourceType === 'team' || update.sourceType === 'empty') {
    if (update.resolutionId || update.teamProvidedResolutionId) {
      return { success: false, error: 'Team/empty cells cannot reference a resolution id' };
    }
  }

  const sourceUserId = update.sourceUserId ? update.sourceUserId : null;

  const resolutionId = update.sourceType === 'personal' ? update.resolutionId : null;
  const teamProvidedResolutionId =
    update.sourceType === 'member_provided' ? update.teamProvidedResolutionId : null;

  // Determine the resolution type for the cell.
  // Personal cells carry the type from the resolution; team/member_provided default to 'base'; empty has no resolution.
  let resolutionType: ResolutionType = ResolutionType.BASE;
  if (update.sourceType === 'team') {
    resolutionType = ResolutionType.TEAM;
  } else if (update.sourceType === 'empty') {
    resolutionType = ResolutionType.BASE;
  } else if (update.resolutionType) {
    resolutionType = update.resolutionType;
  }

  await query(
    `UPDATE bingo_cells
     SET resolution_id = ?,
         team_provided_resolution_id = ?,
         resolution_type = ?,
         source_type = ?,
         source_user_id = ?,
         state = 'pending'
     WHERE id = ?`,
    [resolutionId, teamProvidedResolutionId, resolutionType, update.sourceType, sourceUserId, cellId]
  );

  const updatedRow = await getResolvedCellRowById(cellId);
  if (!updatedRow) {
    return { success: false, error: 'Cell not found' };
  }

  return { success: true, cell: rowToCell(updatedRow) };
}
/**
 * Undo completion - revert cell to pending and close any open thread
 * Spec: Resolution Review & Proof Workflow - Undo Completion
 */
export async function undoCompletion(
  cellId: string,
  userId: string
): Promise<{ success: boolean; error?: string; cell?: BingoCell }> {
  const cellRows = await query<(CellRow & { card_user_id: string; team_id: string })[]>(
    `SELECT c.*, bc.user_id as card_user_id, bc.team_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.id = ?`,
    [cellId]
  );

  if (cellRows.length === 0) {
    return { success: false, error: 'Cell not found' };
  }

  const cell = cellRows[0];

  // Only the card owner can undo completion
  if (cell.card_user_id !== userId) {
    return { success: false, error: 'Only the card owner can undo completion' };
  }

  // Must be in completed, pending_review, or accomplished state
  if (!['completed', 'pending_review', 'accomplished'].includes(cell.state)) {
    return { success: false, error: 'Cell is not completed' };
  }

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Check for open review thread
    const [threadRowsUnknown] = await connection.execute(
      `SELECT id, status FROM review_threads WHERE cell_id = ? AND status = 'open'`,
      [cellId]
    );

    const threadRows = threadRowsUnknown as Array<{ id: string; status: string }>;

    if (threadRows.length > 0) {
      const threadId = threadRows[0].id;

      // Delete messages and files
      await connection.execute(
        `DELETE FROM review_messages WHERE thread_id = ?`,
        [threadId]
      );

      await connection.execute(
        `DELETE FROM review_files WHERE thread_id = ?`,
        [threadId]
      );

      // Close the thread
      await connection.execute(
        `UPDATE review_threads SET status = 'closed', closed_at = NOW() WHERE id = ?`,
        [threadId]
      );
    }

    // Optimistic lock: only transition if cell is still in a valid
    // "completable" state.  Owner actions prevail over concurrent
    // proof-request operations — if a team member moved the cell to
    // pending_review in the meantime, we still honour the owner's undo
    // because the thread closure above already handled that thread.
    const [undoResult] = await connection.execute(
      `UPDATE bingo_cells SET state = 'pending' WHERE id = ? AND state IN ('completed', 'pending_review', 'accomplished')`,
      [cellId]
    );
    const affectedRows = (undoResult as { affectedRows: number }).affectedRows;
    if (affectedRows === 0) {
      await connection.rollback();
      return { success: false, error: 'Cell is not in a completable state' };
    }

    await connection.commit();

    // Refresh persisted leaderboard data after undo
    await refreshLeaderboardEntry(cell.team_id, userId);

    const updatedRows = await query<CellRow[]>(
      `SELECT * FROM bingo_cells WHERE id = ?`,
      [cellId]
    );

    return { success: true, cell: rowToCell(updatedRows[0]) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all bingo cards for a team (for visibility)
 * Spec: 08-visibility-and-updates.md
 */
export async function getTeamBingoCards(
  teamId: string,
  requestingUserId: string
): Promise<BingoCardWithCells[]> {
  // Verify requesting user is a team member
  // Spec: 08-visibility-and-updates.md - Only team members can view team cards
  const isMember = await isTeamMember(teamId, requestingUserId);
  if (!isMember) {
    return [];
  }

  const cardRows = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE team_id = ?`,
    [teamId]
  );

  const cards: BingoCardWithCells[] = [];

  for (const row of cardRows) {
    const card = rowToCard(row);
    const cells = await getCellsWithProofs(card.id);
    cards.push({ ...card, cells });
  }

  return cards;
}

/**
 * Get a specific cell
 */
export async function getCellById(cellId: string): Promise<BingoCellWithProof | null> {
  const row = await getResolvedCellRowById(cellId);
  if (!row) return null;

  const cell = rowToCell(row);

  const proofRows = await query<ProofRow[]>(
    `SELECT * FROM cell_proofs WHERE cell_id = ? ORDER BY created_at DESC LIMIT 1`,
    [cell.id]
  );

  const threadRows = await query<{ id: string }[]>(
    `SELECT id FROM review_threads WHERE cell_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
    [cell.id]
  );

  return {
    ...cell,
    proof: proofRows.length > 0 ? rowToProof(proofRows[0]) : null,
    reviewThreadId: threadRows.length > 0 ? threadRows[0].id : null,
  };
}

/**
 * Report duplicate in card
 * Spec: 05-bingo-card-generation.md - Duplicate Handling
 */
export async function reportDuplicate(
  cellId: string,
  reporterUserId: string,
  replacementText?: string
): Promise<{ success: boolean; error?: string }> {
  // Get cell and card info
  const cellRows = await query<(CellRow & { card_user_id: string; team_id: string })[]>(
    `SELECT c.*, bc.user_id as card_user_id, bc.team_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.id = ?`,
    [cellId]
  );

  if (cellRows.length === 0) {
    return { success: false, error: 'Cell not found' };
  }

  const cell = cellRows[0];

  // Verify reporter is either the card owner or the source user
  // Spec: 05-bingo-card-generation.md - The card owner OR the member who provided the duplicated resolution can report
  if (cell.card_user_id !== reporterUserId && cell.source_user_id !== reporterUserId) {
    return { success: false, error: 'Only the card owner or resolution provider can report duplicates' };
  }

  // Create duplicate report
    const reportId = randomUUID();
    await query(
      `INSERT INTO duplicate_reports (id, cell_id, reporter_user_id, replacement_text, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [reportId, cellId, reporterUserId, replacementText || null]
    );

  // If replacement text provided, update the cell
  if (replacementText && replacementText.trim()) {
    const trimmed = replacementText.trim();

    const resolutionRows = await query<Array<{ id: string }>>(
      `SELECT id FROM resolutions WHERE text = ? LIMIT 1`,
      [trimmed]
    );
    const teamProvidedRows = await query<Array<{ id: string }>>(
      `SELECT id FROM team_provided_resolutions WHERE text = ? LIMIT 1`,
      [trimmed]
    );

    const resolutionId = resolutionRows.length > 0 ? resolutionRows[0].id : null;
    const teamProvidedResolutionId = teamProvidedRows.length > 0 ? teamProvidedRows[0].id : null;

    await query(
      `UPDATE bingo_cells
       SET resolution_id = ?, team_provided_resolution_id = ?
       WHERE id = ?`,
      [resolutionId, teamProvidedResolutionId, cellId]
    );

    await query(
      `UPDATE duplicate_reports SET status = 'resolved', resolved_at = NOW() WHERE id = ?`,
      [reportId]
    );
  }

  return { success: true };
}

/**
 * Auto-transition bingo cell state for compound/iterative resolutions.
 * When the resolution is fully completed (all subtasks done or counter reached),
 * the cell transitions from pending → completed.
 * When the resolution becomes incomplete again, the cell transitions from completed → pending.
 *
 * This skips cells in pending_review or accomplished states (controlled by voting system).
 *
 * @param resolutionId - The compound or iterative resolution ID
 * @param resolutionType - 'compound' or 'iterative'
 * @param isComplete - Whether the resolution is now fully completed
 * @returns Array of updated cells, or empty if no transitions occurred
 */
export async function autoTransitionCellState(
  resolutionId: string,
  resolutionType: ResolutionType,
  isComplete: boolean
): Promise<BingoCell[]> {
  // Find all bingo cells linked to this resolution
  const cellRows = await query<Array<{ id: string; state: CellState; team_id: string; user_id: string }>>(
    `SELECT c.id, c.state, bc.team_id, bc.user_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.resolution_id = ? AND c.resolution_type = ?`,
    [resolutionId, resolutionType]
  );

  if (cellRows.length === 0) {
    return [];
  }

  const updatedCells: BingoCell[] = [];

  for (const cellRow of cellRows) {
    let newState: CellState | null = null;

    if (isComplete && cellRow.state === CellState.PENDING) {
      // Auto-complete: pending → completed
      newState = CellState.COMPLETED;
    } else if (!isComplete && cellRow.state === CellState.COMPLETED) {
      // Auto-revert: completed → pending
      newState = CellState.PENDING;
    }

    if (newState) {
      await query(
        `UPDATE bingo_cells SET state = ? WHERE id = ? AND state = ?`,
        [newState, cellRow.id, cellRow.state]
      );

      // Refresh leaderboard for this user/team
      await refreshLeaderboardEntry(cellRow.team_id, cellRow.user_id);

      const updatedRow = await getResolvedCellRowById(cellRow.id);
      if (updatedRow) {
        updatedCells.push(rowToCell(updatedRow));
      }
    }
  }

  return updatedCells;
}
