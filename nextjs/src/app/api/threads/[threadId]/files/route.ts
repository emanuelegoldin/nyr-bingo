/**
 * Review Files API
 * Spec Reference: Resolution Review & Proof Workflow - Thread Capabilities (max 5MB per file)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadFile } from '@/lib/db';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { convertToWebP, tryConvertToWebP } from '@/lib/image-processing';

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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { threadId } = await params;
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    const ext = getSafeExtension(file);
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    // Save file to disk
    const { buffer: convertedBuffer, ext: convertedExt, type: convertedType } = await tryConvertToWebP(file, ext);
    const uploadDir = path.join(process.cwd(), 'uploads', 'review-files');
    await mkdir(uploadDir, { recursive: true });

    const filename = `${randomUUID()}.${convertedExt}`;
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, convertedBuffer);

    const fileUrl = `/review-files/${filename}`;

    // Save to database
    const result = await uploadFile(
      threadId,
      currentUser.id,
      fileUrl,
      convertedBuffer.byteLength,
      file.name,
      convertedType
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ file: result.file }, { status: 201 });
  } catch (error) {
    console.error('Upload file error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
