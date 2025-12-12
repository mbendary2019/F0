// src/app/api/attachments/file/[id]/route.ts
// =============================================================================
// Phase 158.2 – File Serving API
// GET: Serve file content by attachment ID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAttachmentStore } from '@/orchestrator/core/attachments/attachmentStore';

// Access in-memory file storage
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
// GET: Serve file
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[158.2][API] GET /api/attachments/file/', id);

  try {
    // Get attachment metadata
    const store = getAttachmentStore();
    const attachment = await store.get(id);

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Get file from storage
    const fileStorage = getFileStorage();
    const file = fileStorage.get(attachment.storagePath);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found in storage' },
        { status: 404 }
      );
    }

    // Return file with correct content type
    return new NextResponse(file.data, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': file.data.byteLength.toString(),
        'Content-Disposition': `inline; filename="${attachment.filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[158.2][API] File serving error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

console.log('[158.2][API] File serving route loaded');
