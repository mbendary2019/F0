// src/app/api/attachments/route.ts
// =============================================================================
// Phase 158.2 – Attachments List API
// GET: List attachments for a project or conversation
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAttachmentStore } from '@/orchestrator/core/attachments/attachmentStore';

export const dynamic = 'force-dynamic';

// =============================================================================
// GET: List attachments
// =============================================================================

export async function GET(request: NextRequest) {
  console.log('[158.2][API] GET /api/attachments');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!projectId && !conversationId) {
      return NextResponse.json(
        { success: false, error: 'projectId or conversationId is required' },
        { status: 400 }
      );
    }

    const store = getAttachmentStore();

    let attachments;
    if (conversationId) {
      attachments = await store.listForConversation(conversationId);
    } else if (projectId) {
      attachments = await store.listForProject(projectId, limit);
    } else {
      attachments = [];
    }

    return NextResponse.json({
      success: true,
      attachments,
      count: attachments.length,
    });
  } catch (error) {
    console.error('[158.2][API] List error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

console.log('[158.2][API] Attachments list route loaded');
