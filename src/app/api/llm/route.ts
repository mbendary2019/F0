/**
 * Phase 176: LLM API Route - Chat with Smart Model Routing
 *
 * POST /api/llm - Chat completion with automatic model selection
 * GET /api/llm - Get model selector stats and health
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM, type LLMMessage } from '@/lib/llm/unifiedLLMClient';
import {

export const dynamic = 'force-dynamic';
  getLoadBalancingStats,
  selectModel,
  MODEL_REGISTRY,
  DEFAULT_ROUTING_CONFIG,
} from '@/lib/llm/modelSelector';

interface ChatRequest {
  messages: LLMMessage[];
  conversationId?: string;
  messageId?: string;
  projectId?: string;
  preferredProvider?: 'openai' | 'anthropic' | 'google';
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    const response = await callLLM({
      messages: body.messages,
      conversationId: body.conversationId,
      messageId: body.messageId,
      projectId: body.projectId,
      preferredProvider: body.preferredProvider,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      jsonMode: body.jsonMode,
    });

    return NextResponse.json({
      success: true,
      content: response.content,
      model: response.model,
      provider: response.provider,
      usage: response.usage,
      latencyMs: response.latencyMs,
      fallbackUsed: response.fallbackUsed,
      fallbackFrom: response.fallbackFrom,
    });
  } catch (error) {
    console.error('[LLM API] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'stats': {
        const stats = getLoadBalancingStats();
        return NextResponse.json({
          success: true,
          stats,
        });
      }

      case 'test-selection': {
        const prompt = searchParams.get('prompt') || 'Hello, how are you?';
        const decision = selectModel({ prompt });
        return NextResponse.json({
          success: true,
          decision,
        });
      }

      case 'models': {
        const models = Object.entries(MODEL_REGISTRY).map(([key, config]) => ({
          key,
          ...config,
        }));
        return NextResponse.json({
          success: true,
          models,
          enabledModels: DEFAULT_ROUTING_CONFIG.enabledModels,
        });
      }

      case 'health':
      default: {
        // Check API keys availability
        const providers = {
          openai: !!process.env.OPENAI_API_KEY,
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          google: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
        };

        const stats = getLoadBalancingStats();

        return NextResponse.json({
          success: true,
          health: {
            status: 'healthy',
            providers,
            enabledModels: DEFAULT_ROUTING_CONFIG.enabledModels,
            defaultModel: DEFAULT_ROUTING_CONFIG.defaultModel,
            routingPolicy: DEFAULT_ROUTING_CONFIG.routingPolicy,
            recentStats: stats,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  } catch (error) {
    console.error('[LLM API] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
