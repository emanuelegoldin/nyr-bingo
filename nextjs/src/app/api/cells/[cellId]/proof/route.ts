/**
 * Cell Proof API
 * Spec Reference: 07-proof-and-approval.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  uploadProof,
  getProofsForCell,
  reviewProof,
  getProofById,
} from '@/lib/db';
import type { ReviewDecision } from '@/lib/db/types';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';
import { tryConvertToWebP } from '@/lib/uploads-processing';

const MAX_PROOF_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function getSafeExtension(file: File): string | null {
  // Prefer MIME type, fallback to original filename.
  switch (file.type) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default: {
      const name = file.name || '';
      const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
      if (['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
      return null;
    }
  }
}

/**
 * GET /api/cells/[cellId]/proof - Get proofs for a cell
 */
export const GET = withAuth(async (_request: NextRequest, { params, currentUser }: AuthContext<{ cellId: string }>) => {
  const { cellId } = await params;
  const proofs = await getProofsForCell(cellId);
  return NextResponse.json({ proofs });
});

/**
 * POST /api/cells/[cellId]/proof - Upload proof for a cell
 * Spec: 07-proof-and-approval.md - A user can attach proof to a specific resolution cell
 */
export const POST = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ cellId: string }>) => {
  const { cellId } = await params;
  const contentType = request.headers.get('content-type') || '';

  let fileUrl: string | undefined;
  let comment: string | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const formComment = form.get('comment');
    comment = typeof formComment === 'string' ? formComment : undefined;

    const file = form.get('file');
    if (file instanceof File) {
      const ext = getSafeExtension(file);
      if (!ext) {
        return errorResponse('Unsupported file type', 400);
      }

      // If file.type is available, enforce it.
      if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
        return errorResponse('Unsupported file type', 400);
      }

      if (file.size > MAX_PROOF_FILE_BYTES) {
        return errorResponse('File too large (max 5MB)', 400);
      }

        const { buffer: convertedBuffer, type: convertedType, cadKey } = await tryConvertToWebP(file);
            

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proofs');
        await mkdir(uploadDir, { recursive: true });

        await writeFile(path.join(uploadDir, cadKey), convertedBuffer);
        fileUrl = `/uploads/proofs/${cadKey}`;
      } else {
        const formFileUrl = form.get('fileUrl');
        fileUrl = typeof formFileUrl === 'string' ? formFileUrl : undefined;
      }
    } else {
      const body = await request.json();
      fileUrl = body?.fileUrl;
      comment = body?.comment;
    }

  // Upload proof
  // Spec: 07-proof-and-approval.md - Only the card owner can upload proof
  const result = await uploadProof(cellId, currentUser.id, fileUrl, comment);

  if (!result.success) {
    return errorResponse(result.error, 400);
  }

  return NextResponse.json({ proof: result.proof }, { status: 201 });
});

/**
 * PUT /api/cells/[cellId]/proof - Review a proof (approve/decline)
 * Spec: 07-proof-and-approval.md - A reviewer can approve or decline with a comment
 */
export const PUT = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ cellId: string }>) => {
  const { cellId } = await params;
  const body = await request.json();
  const { proofId, decision, comment } = body;

  if (!proofId) {
    return errorResponse('Proof ID is required', 400);
  }

  // Validate decision
  if (!decision || !['approved', 'declined'].includes(decision)) {
    return errorResponse('Decision must be "approved" or "declined"', 400);
  }

  // Review proof
  // Spec: 07-proof-and-approval.md - Only team members (excluding owner) can approve/decline
  const result = await reviewProof(
    proofId,
    currentUser.id,
    decision as ReviewDecision,
    comment
  );

  if (!result.success) {
    return errorResponse(result.error, 400);
  }

  // Get updated proof
  const updatedProof = await getProofById(proofId);

  return NextResponse.json({
    review: result.review,
    proof: updatedProof,
  });
});
