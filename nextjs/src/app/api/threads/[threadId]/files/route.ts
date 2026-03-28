/**
 * Review Files API
 * Spec Reference: Resolution Review & Proof Workflow - Thread Capabilities (max 5MB per file)
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, User } from '@/lib/db';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';
import { randomUUID } from 'node:crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
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
    case 'image/gif':
      return 'gif';
    case 'application/pdf':
      return 'pdf';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    default: {
      const name = file.name || '';
      if (!name.includes('.')) return null;
      const parts = name.split('.');
      const ext = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : '';
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'mp4', 'mov'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
      return null;
    }
  }
}

/**
 * POST /api/threads/[threadId]/files - Upload a proof file to a thread
 * Only the completing user can upload files
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: { params: Promise<{ threadId: string }>; currentUser: User }
) => {
  const { threadId } = await params;
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return errorResponse('Content-Type must be multipart/form-data', 400);
  }

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return errorResponse('File is required', 400);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return errorResponse('File size exceeds 5MB limit', 400);
  }

  // Validate file type
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return errorResponse('Unsupported file type', 400);
  }

  const ext = getSafeExtension(file);
  if (!ext) {
    return errorResponse('Unsupported file type', 400);
  }

    // Save file to disk
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), 'uploads', 'review-files');
    await mkdir(uploadDir, { recursive: true });

    const filename = `${randomUUID()}.${ext}`;
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, bytes);

    const fileUrl = `/review-files/${filename}`;

    // Save to database
    const result = await uploadFile(
      threadId,
      currentUser.id,
      fileUrl,
      file.size,
      file.name,
      file.type
    );
    
    if (!result.success) {
      return errorResponse(result.error, 400);
    }
    
    return NextResponse.json({ file: result.file }, { status: 201 });
  });
