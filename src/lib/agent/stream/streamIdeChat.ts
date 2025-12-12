/**
 * Phase 108: Streaming Support (SSE)
 *
 * Converts F0 IDE chat responses to OpenAI-compatible Server-Sent Events (SSE) format.
 * Supports real-time streaming of code generation responses to IDE extensions like Continue.
 */

import type { IdeChatRequest } from '@/types/ideBridge';
import { runIdeChat } from '@/lib/agent/code/runIdeChat';
import type { F0ChatCompletionChunk } from '@/types/openaiCompat';

/**
 * Stream IDE chat response as OpenAI-compatible SSE chunks
 *
 * Currently simulates streaming by chunking the complete response.
 * In future versions, this can be connected to real-time LLM streaming.
 *
 * @param req - IDE chat request
 * @param chunkSize - Size of each chunk in characters (default: 80)
 */
export async function* streamIdeChatAsChunks(
  req: IdeChatRequest,
  chunkSize: number = 80
): AsyncGenerator<string, void, unknown> {
  // Phase 108: Run the normal IDE chat to get the complete response
  // Future: This could be replaced with real-time LLM streaming
  const res = await runIdeChat(req);

  const fullText = res.replyText ?? '';
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = 'f0-code-agent';

  // Phase 108: Send role at the start (OpenAI format)
  const firstChunk: F0ChatCompletionChunk = {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
        },
        finish_reason: null,
      },
    ],
  };

  yield `data: ${JSON.stringify(firstChunk)}\n\n`;

  // Phase 108: Stream content in chunks
  for (let i = 0; i < fullText.length; i += chunkSize) {
    const piece = fullText.slice(i, i + chunkSize);

    const contentChunk: F0ChatCompletionChunk = {
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {
            content: piece,
          },
          finish_reason: null,
        },
      ],
    };

    yield `data: ${JSON.stringify(contentChunk)}\n\n`;
  }

  // Phase 108: Send final chunk with finish_reason
  const finalChunk: F0ChatCompletionChunk = {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  };

  yield `data: ${JSON.stringify(finalChunk)}\n\n`;

  // Phase 108: Send [DONE] marker (OpenAI standard)
  yield `data: [DONE]\n\n`;
}
