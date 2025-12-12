// src/app/api/chat/completions/route.ts
// Simple wrapper around OpenAI-compatible endpoint for F0 Desktop IDE

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/completions
 * Simplified endpoint for F0 Desktop IDE
 * Accepts OpenAI-compatible requests and returns responses
 */
export async function POST(req: NextRequest) {
  try {
    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // Parse request body
    const body = await req.json();
    const { model, messages, stream, fz_context } = body;

    // Validate request
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build request for OpenAI-compatible endpoint
    const openaiCompatUrl = `${req.nextUrl.origin}/api/openai_compat/v1/chat/completions`;

    const openaiCompatBody = {
      model: model || 'f0-code-agent',
      messages,
      stream: stream ?? false,
      // Include fz_context if provided
      ...(fz_context && { fz_context }),
    };

    // Forward request to OpenAI-compatible endpoint
    const response = await fetch(openaiCompatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiCompatBody),
    });

    // Handle non-streaming response
    if (!stream) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle streaming response
    if (response.body) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    throw new Error('No response body for streaming');
  } catch (error: any) {
    console.error('[Chat Completions] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
