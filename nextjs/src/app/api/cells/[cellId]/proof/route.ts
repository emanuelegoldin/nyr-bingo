/**
 * Cell Proof API
 * Spec Reference: 07-proof-and-approval.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { 
  uploadProof, 
  getProofsForCell, 
  reviewProof,
  getProofById,
} from '@/lib/db';
import type { ReviewDecision } from '@/lib/db/types';
import { convertToWebP, tryConvertToWebP } from '@/lib/image-processing';

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
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cellId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { cellId } = await params;

    const proofs = await getProofsForCell(cellId);
    
    return NextResponse.json({ proofs });
  } catch (error) {
    console.error('Get proofs error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cells/[cellId]/proof - Upload proof for a cell
 * Spec: 07-proof-and-approval.md - A user can attach proof to a specific resolution cell
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cellId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

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
          return NextResponse.json(
            { error: 'Unsupported file type' },
            { status: 400 }
          );
        }

        // If file.type is available, enforce it.
        if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
          return NextResponse.json(
            { error: 'Unsupported file type' },
            { status: 400 }
          );
        }

        if (file.size > MAX_PROOF_FILE_BYTES) {
          return NextResponse.json(
            { error: 'File too large (max 5MB)' },
            { status: 400 }
          );
        }

        const { buffer: convertedBuffer, ext: convertedExt, type: convertedType } = await tryConvertToWebP(file, ext);
            

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proofs');
        await mkdir(uploadDir, { recursive: true });

        const filename = `${randomUUID()}.${convertedExt}`;
        await writeFile(path.join(uploadDir, filename), convertedBuffer);
        fileUrl = `/uploads/proofs/${filename}`;
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
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ proof: result.proof }, { status: 201 });
  } catch (error) {
    console.error('Upload proof error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cells/[cellId]/proof - Review a proof (approve/decline)
 * Spec: 07-proof-and-approval.md - A reviewer can approve or decline with a comment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cellId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { cellId } = await params;
    const body = await request.json();
    const { proofId, decision, comment } = body;

    if (!proofId) {
      return NextResponse.json(
        { error: 'Proof ID is required' },
        { status: 400 }
      );
    }

    // Validate decision
    if (!decision || !['approved', 'declined'].includes(decision)) {
      return NextResponse.json(
        { error: 'Decision must be "approved" or "declined"' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    // Get updated proof
    const updatedProof = await getProofById(proofId);
    
    return NextResponse.json({ 
      review: result.review,
      proof: updatedProof,
    });
  } catch (error) {
    console.error('Review proof error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
