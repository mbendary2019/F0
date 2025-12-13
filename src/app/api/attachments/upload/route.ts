// src/app/api/attachments/upload/route.ts
// =============================================================================
// Phase 158.2 – File Upload API
// POST: Upload a file as project attachment
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAttachmentStore,
  createAttachmentId,
} from '@/orchestrator/core/attachments/attachmentStore';
import {
  ProjectAttachment,
  guessAttachmentKind,
  isAllowedMimeType,
  ATTACHMENT_LIMITS,
} from '@/orchestrator/core/attachments/types';

export const dynamic = 'force-dynamic';

// =============================================================================
// In-memory file storage for development
// In production, this would use Firebase Storage or S3
// =============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __fileStorage: Map<string, { data: Buffer; mimeType: string }> | undefined;
}

function getFileStorage(): Map<string, { data: Buffer; mimeType: string }> {
  if (!global.__fileStorage) {
    global.__fileStorage = new Map();
  }
  return global.__fileStorage;
}

// =============================================================================
// POST: Upload file
// =============================================================================

export async function POST(request: NextRequest) {
  console.log('[158.2][API] POST /api/attachments/upload');

  try {
    const formData = await request.formData();

    const projectId = formData.get('projectId') as string | null;
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const turnId = formData.get('turnId') as string | null;
    const planId = formData.get('planId') as string | null;
    const userId = formData.get('userId') as string | null;

    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'file is required' },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        { success: false, error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > ATTACHMENT_LIMITS.maxFileSize) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Max size: ${ATTACHMENT_LIMITS.maxFileSize / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // Generate attachment ID and storage path
    const attId = createAttachmentId();
    const ext = file.name.split('.').pop() ?? '';
    const storagePath = `projects/${projectId}/attachments/${attId}.${ext}`;

    // Read file data
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store file in memory (dev) - in production would upload to Storage
    const fileStorage = getFileStorage();
    fileStorage.set(storagePath, { data: buffer, mimeType: file.type });

    // Create attachment record
    const kind = guessAttachmentKind(file.type);
    const now = new Date().toISOString();

    const attachment: ProjectAttachment = {
      id: attId,
      projectId,
      storagePath,
      downloadUrl: `/api/attachments/file/${attId}`,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: buffer.byteLength,
      kind,
      createdBy: userId ?? 'anonymous',
      createdAt: now,
      conversationId: conversationId ?? undefined,
      turnId: turnId ?? undefined,
      planId: planId ?? undefined,
      status: 'raw',
    };

    // Save to store
    const store = getAttachmentStore();
    await store.create(attachment);

    console.log('[158.2][API] Uploaded:', attId, file.name, `${buffer.byteLength} bytes`);

    return NextResponse.json({
      success: true,
      attachment,
    });
  } catch (error) {
    console.error('[158.2][API] Upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

console.log('[158.2][API] Upload route loaded');
