// src/app/api/agents/chat/route.ts
// =============================================================================
// Phase 157.3 – Chat API Endpoint
// POST: Send message to project chat
// GET: Get conversation history for a thread
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOrchestratorBus } from '@/lib/agents/orchestratorBus';
import { getConversationStore } from '@/orchestrator/core/conversation/conversationStore';
import type { AgentMessage } from '@/orchestrator/core/multiAgent/types';

export const dynamic = 'force-dynamic';

function generateId(prefix = 'msg'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// =============================================================================
// POST: Send a chat message
// =============================================================================

export async function POST(request: NextRequest) {
  console.log('[157.3][API] POST /api/agents/chat');

  try {
    const body = await request.json();
    const {
      projectId,
      userId,
      threadId,
      content,
      userMode = 'pro',
    } = body;

    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }

    // Get bus and publish CHAT_MESSAGE
    const bus = getOrchestratorBus();
    const messageId = generateId('chat');
    const now = new Date().toISOString();

    const message: AgentMessage = {
      id: messageId,
      timestamp: now,
      from: 'user',
      to: 'conversation',
      kind: 'CHAT_MESSAGE',
      context: {
        projectId,
        userId: userId ?? 'anonymous',
        conversationId: threadId,
        userMode: userMode as 'beginner' | 'pro' | 'expert',
      },
      safety: { level: 'low' },
      payload: {
        threadId,
        content: content.trim(),
      },
    };

    // Publish to bus - ConversationAgent will handle it
    await bus.publish(message);

    console.log('[157.3][API] Published CHAT_MESSAGE:', messageId);

    // Wait a bit for the ConversationAgent to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get the conversation store to return updated data
    const convStore = getConversationStore();

    // If no threadId was provided, find the latest thread
    let actualThreadId = threadId;
    if (!actualThreadId) {
      const latestThread = await convStore.getLatestThread(projectId);
      actualThreadId = latestThread?.id;
    }

    // Get the turns for response
    const turns = actualThreadId
      ? await convStore.listTurns(actualThreadId, 50)
      : [];

    return NextResponse.json({
      success: true,
      messageId,
      threadId: actualThreadId,
      turns,
    });
  } catch (error) {
    console.error('[157.3][API] POST Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET: Get conversation history
// =============================================================================

export async function GET(request: NextRequest) {
  console.log('[157.3][API] GET /api/agents/chat');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const threadId = searchParams.get('threadId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    const convStore = getConversationStore();

    // If threadId specified, get that thread's turns
    if (threadId) {
      const thread = await convStore.getThread(threadId);
      const turns = await convStore.listTurns(threadId, limit);

      return NextResponse.json({
        success: true,
        thread,
        turns,
      });
    }

    // Otherwise, list all threads for the project
    const threads = await convStore.listThreads(projectId, limit);

    // Get the latest thread's turns for convenience
    const latestThread = threads[0];
    const latestTurns = latestThread
      ? await convStore.listTurns(latestThread.id, limit)
      : [];

    return NextResponse.json({
      success: true,
      threads,
      latestThread,
      latestTurns,
    });
  } catch (error) {
    console.error('[157.3][API] GET Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

console.log('[157.3][API] Chat route loaded');
