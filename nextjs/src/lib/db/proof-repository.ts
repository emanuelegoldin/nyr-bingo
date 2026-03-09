/**
 * Proof Repository - Database operations for proof submissions and reviews
 * Spec Reference: 07-proof-and-approval.md
 */

import { query, getConnection } from './connection';
import type { CellProof, ProofReview } from './types';
import { v4 as uuidv4 } from 'uuid';
import { isTeamMember } from './team-repository';
import { ProofStatus, ReviewDecision } from '../shared/types';

// Row types from database
interface ProofRow {
  id: string;
  cell_id: string;
  file_url: string | null;
  comment: string | null;
  status: ProofStatus;
  created_at: Date;
  updated_at: Date;
}

interface ReviewRow {
  id: string;
  proof_id: string;
  reviewer_user_id: string;
  decision: ReviewDecision;
  comment: string | null;
  created_at: Date;
}

interface CellOwnershipInfo {
  cell_id: string;
  card_user_id: string;
  team_id: string;
}

// Convert functions
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

function rowToReview(row: ReviewRow): ProofReview {
  return {
    id: row.id,
    proofId: row.proof_id,
    reviewerUserId: row.reviewer_user_id,
    decision: row.decision,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

/**
 * Upload proof for a cell
 * Spec: 07-proof-and-approval.md - Proof Upload
 */
export async function uploadProof(
  cellId: string,
  userId: string,
  fileUrl?: string,
  comment?: string
): Promise<{ success: boolean; proof?: CellProof; error?: string }> {
  // Get cell ownership info
  const ownershipRows = await query<CellOwnershipInfo[]>(
    `SELECT c.id as cell_id, bc.user_id as card_user_id, bc.team_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.id = ?`,
    [cellId]
  );

  if (ownershipRows.length === 0) {
    return { success: false, error: 'Cell not found' };
  }

  const ownership = ownershipRows[0];

  // Spec: 07-proof-and-approval.md - Only the card owner can upload proof
  if (ownership.card_user_id !== userId) {
    return { success: false, error: 'Only the card owner can upload proof' };
  }

  // Create the proof
  const proofId = uuidv4();
  await query(
    `INSERT INTO cell_proofs (id, cell_id, file_url, comment, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [proofId, cellId, fileUrl || null, comment || null]
  );

  const rows = await query<ProofRow[]>(
    `SELECT * FROM cell_proofs WHERE id = ?`,
    [proofId]
  );

  return { success: true, proof: rowToProof(rows[0]) };
}

/**
 * Get proof by ID
 */
export async function getProofById(proofId: string): Promise<CellProof | null> {
  const rows = await query<ProofRow[]>(
    `SELECT * FROM cell_proofs WHERE id = ?`,
    [proofId]
  );
  return rows.length > 0 ? rowToProof(rows[0]) : null;
}

/**
 * Get proofs for a cell
 */
export async function getProofsForCell(cellId: string): Promise<CellProof[]> {
  const rows = await query<ProofRow[]>(
    `SELECT * FROM cell_proofs WHERE cell_id = ? ORDER BY created_at DESC`,
    [cellId]
  );
  return rows.map(rowToProof);
}

/**
 * Review a proof (approve/decline)
 * Spec: 07-proof-and-approval.md - Review
 */
export async function reviewProof(
  proofId: string,
  reviewerUserId: string,
  decision: ReviewDecision,
  comment?: string
): Promise<{ success: boolean; review?: ProofReview; error?: string }> {
  // Spec: 07-proof-and-approval.md - Decline requires a comment
  if (decision === 'declined' && (!comment || comment.trim().length === 0)) {
    return { success: false, error: 'Decline requires a comment' };
  }

  // Get proof and cell info
  const proofInfo = await query<(ProofRow & { card_user_id: string; team_id: string })[]>(
    `SELECT p.*, bc.user_id as card_user_id, bc.team_id
     FROM cell_proofs p
     JOIN bingo_cells c ON p.cell_id = c.id
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE p.id = ?`,
    [proofId]
  );

  if (proofInfo.length === 0) {
    return { success: false, error: 'Proof not found' };
  }

  const info = proofInfo[0];

  // Spec: 07-proof-and-approval.md - Only team members (excluding the owner) can approve/decline
  if (info.card_user_id === reviewerUserId) {
    return { success: false, error: 'Card owner cannot review their own proof' };
  }

  const isMember = await isTeamMember(info.team_id, reviewerUserId);
  if (!isMember) {
    return { success: false, error: 'Only team members can review proofs' };
  }

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Create review
    const reviewId = uuidv4();
    await connection.execute(
      `INSERT INTO proof_reviews (id, proof_id, reviewer_user_id, decision, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [reviewId, proofId, reviewerUserId, decision, comment || null]
    );

    // Update proof status
    // Spec: 07-proof-and-approval.md - State Model
    await connection.execute(
      `UPDATE cell_proofs SET status = ? WHERE id = ?`,
      [decision, proofId]
    );

    await connection.commit();

    const reviewRows = await query<ReviewRow[]>(
      `SELECT * FROM proof_reviews WHERE id = ?`,
      [reviewId]
    );

    return { success: true, review: rowToReview(reviewRows[0]) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get reviews for a proof
 */
export async function getReviewsForProof(proofId: string): Promise<ProofReview[]> {
  const rows = await query<ReviewRow[]>(
    `SELECT * FROM proof_reviews WHERE proof_id = ? ORDER BY created_at DESC`,
    [proofId]
  );
  return rows.map(rowToReview);
}

/**
 * Get pending proofs for a team (for team members to review)
 */
export async function getPendingProofsForTeam(
  teamId: string,
  excludeUserId?: string
): Promise<(CellProof & { cardUserId: string; cellResolutionText: string })[]> {
  let sql = `
    SELECT
      p.*,
      bc.user_id as card_user_id,
      CASE
        WHEN c.is_empty THEN 'Empty'
        WHEN c.resolution_id IS NOT NULL THEN COALESCE(r.description, r.title, '')
        ELSE ''
      END as cell_resolution_text
    FROM cell_proofs p
    JOIN bingo_cells c ON p.cell_id = c.id
    JOIN bingo_cards bc ON c.card_id = bc.id
    LEFT JOIN resolutions r ON c.resolution_id = r.id
    WHERE bc.team_id = ? AND p.status = 'pending'
  `;
  const params: unknown[] = [teamId];

  if (excludeUserId) {
    sql += ` AND bc.user_id != ?`;
    params.push(excludeUserId);
  }

  sql += ` ORDER BY p.created_at DESC`;

  const rows = await query<(ProofRow & { card_user_id: string; cell_resolution_text: string })[]>(
    sql,
    params
  );

  return rows.map(row => ({
    ...rowToProof(row),
    cardUserId: row.card_user_id,
    cellResolutionText: row.cell_resolution_text,
  }));
}
