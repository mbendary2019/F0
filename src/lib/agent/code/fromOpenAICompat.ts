/**
 * Phase 106: OpenAI Compatibility Bridge
 * Phase 107: Context-Aware Code Generation
 *
 * Converts OpenAI-style requests from Continue extension
 * to F0's internal IdeChatRequest format.
 */

import type { F0ChatCompletionRequest } from '@/types/openaiCompat';
import type { IdeChatRequest } from '@/types/ideBridge';
import { buildFileContextFromOpenAIRequest } from '../context/normalizeContext';

/**
 * Maps OpenAI chat completion request to F0 IDE chat request
 */
export function mapOpenAIRequestToIdeChat(body: F0ChatCompletionRequest): IdeChatRequest {
  // Find the last user message as the main prompt
  const lastUserMessage = [...body.messages]
    .reverse()
    .find((m) => m.role === 'user');

  // Extract system messages for context
  const systemMessages = body.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  // Build the prompt with system context if available
  let prompt = lastUserMessage?.content ?? '';
  if (systemMessages && !prompt.includes(systemMessages)) {
    prompt = `${systemMessages}\n\n${prompt}`;
  }

  // Phase 107: Extract context using normalization layer
  const { contextFiles, primaryFilePath, workspaceContext } =
    buildFileContextFromOpenAIRequest(body);

  // Extract selection from workspace context (if any)
  const selection = workspaceContext?.currentFile?.selection ?? undefined;

  return {
    projectId: body.projectId ?? 'default',
    sessionId: body.workspaceId ?? `continue-${Date.now()}`,
    ideType: body.ideType ?? 'continue',

    // Provide message in multiple formats for compatibility
    message: prompt,      // Standard IdeChatRequest field
    prompt,              // Phase 106 field
    input: prompt,       // Agent input field (prevents trim() on undefined)

    // Phase 107: New context format (preferred)
    contextFiles: contextFiles.length > 0 ? contextFiles : undefined,
    primaryFilePath,
    selection,

    // Phase 106: Legacy file context (for backward compatibility)
    fileContext: (body.files ?? []).map((f) => ({
      path: f.path,
      filePath: f.path,  // Also set filePath for backward compat
      content: f.content,
      languageId: f.languageId ?? 'typescript',
      selection: null,
      isOpen: f.isOpen ?? true,
    })),

    // Store original request for debugging
    metadata: {
      source: 'openai_compat',
      originalMessages: body.messages,
      temperature: body.temperature,
      maxTokens: body.max_tokens,
      workspaceContext, // Phase 107: Store workspace context
    },
  };
}
