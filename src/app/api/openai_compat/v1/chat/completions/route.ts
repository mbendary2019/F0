/**
 * Phase 106: OpenAI-Compatible Chat Completions Endpoint
 * Phase 108: Streaming Support (SSE)
 * POST /api/openai_compat/v1/chat/completions
 *
 * Allows Continue extension to use F0 Code Agent as an OpenAI-compatible model.
 * Supports both regular JSON responses and Server-Sent Events (SSE) streaming.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mapOpenAIRequestToIdeChat } from '@/lib/agent/code/fromOpenAICompat';
import { runIdeChat } from '@/lib/agent/code/runIdeChat';
import { streamIdeChatAsChunks } from '@/lib/agent/stream/streamIdeChat';
import type { F0ChatCompletionRequest, F0ChatCompletionResponse } from '@/types/openaiCompat';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for code generation

/**
 * CORS Headers for Desktop IDE
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Check API key authentication
 */
function checkApiKey(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;

  // Check against F0_EXT_API_KEY environment variable
  const validKey = process.env.F0_EXT_API_KEY;
  if (!validKey) {
    console.warn('[OpenAI Compat] F0_EXT_API_KEY not configured');
    return false;
  }

  return token === validKey;
}

/**
 * POST /api/openai_compat/v1/chat/completions
 */
export async function POST(req: NextRequest) {
  console.log('[OpenAI Compat] Chat completion request received');

  // 1. Authenticate
  if (!checkApiKey(req)) {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid API key. Please set F0_EXT_API_KEY environment variable.',
          type: 'auth_error',
          code: 'invalid_api_key',
        },
      },
      { status: 401, headers: corsHeaders }
    );
  }

  // 2. Parse request body
  let body: F0ChatCompletionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid JSON body',
          type: 'invalid_request_error',
          code: 'parse_error',
        },
      },
      { status: 400, headers: corsHeaders }
    );
  }

  // 3. Validate required fields
  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json(
      {
        error: {
          message: 'messages field is required and must not be empty',
          type: 'invalid_request_error',
          code: 'missing_messages',
        },
      },
      { status: 400, headers: corsHeaders }
    );
  }

  console.log('[OpenAI Compat] Request:', {
    model: body.model,
    messagesCount: body.messages.length,
    projectId: body.projectId,
    hasFiles: body.files && body.files.length > 0,
    stream: body.stream, // Phase 108: Log streaming mode
  });

  // 4. Convert to IDE chat request
  const ideChatReq = mapOpenAIRequestToIdeChat(body);

  // Phase 108: Branch 1 - Streaming Mode (SSE)
  if (body.stream) {
    console.log('[OpenAI Compat] Streaming mode enabled');

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamIdeChatAsChunks(ideChatReq)) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        } catch (err) {
          console.error('[OpenAI Compat] Streaming error:', err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering for reverse proxies
      },
    });
  }

  // Phase 106: Branch 2 - Normal JSON Mode
  // 5. Run through F0 Code Agent pipeline
  let ideChatRes;
  try {
    ideChatRes = await runIdeChat(ideChatReq);
  } catch (error) {
    console.error('[OpenAI Compat] Code generation error:', error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          type: 'server_error',
          code: 'code_generation_failed',
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }

  // 6. Format patches in the message
  let messageContent = ideChatRes.replyText;

  if (ideChatRes.patches && ideChatRes.patches.length > 0) {
    messageContent += '\n\n## Generated Files:\n\n';
    for (const patch of ideChatRes.patches) {
      messageContent += `### ${patch.filePath}\n\n`;
      messageContent += '```typescript\n';
      messageContent += patch.diff;
      messageContent += '\n```\n\n';
    }
  }

  // 7. Build OpenAI-compatible response
  const response: F0ChatCompletionResponse = {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model ?? 'f0-code-agent',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: messageContent,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: body.messages.reduce((sum, m) => sum + m.content.length / 4, 0) | 0,
      completion_tokens: messageContent.length / 4 | 0,
      total_tokens: 0,
    },
  };

  response.usage!.total_tokens = response.usage!.prompt_tokens + response.usage!.completion_tokens;

  console.log('[OpenAI Compat] Success:', {
    patchesCount: ideChatRes.patches?.length || 0,
    responseLength: messageContent.length,
  });

  return NextResponse.json(response, { headers: corsHeaders });
}
