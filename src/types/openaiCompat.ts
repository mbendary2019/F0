/**
 * Phase 106: OpenAI-Compatible API Types
 * Phase 107: Context-Aware Code Generation
 * Phase 108: Streaming Support (SSE)
 *
 * Types for OpenAI-compatible endpoint to allow Continue extension
 * to use F0 Code Agent as a model provider.
 */

import type { F0WorkspaceContext } from './context';

export type OpenAIChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface OpenAIChatMessage {
  role: OpenAIChatRole;
  content: string;
  name?: string;
}

/**
 * F0 Chat Completion Request
 * Compatible with OpenAI's /v1/chat/completions but with F0 extensions
 */
export interface F0ChatCompletionRequest {
  // Standard OpenAI fields
  model?: string; // "f0-code-agent"
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;

  // F0 Extensions (optional)
  projectId?: string;
  workspaceId?: string;
  // Phase 109: Desktop IDE support
  ideType?: 'continue' | 'vscode' | 'web' | 'desktop';

  // Legacy file context from Continue (Phase 106)
  files?: {
    path: string;
    content: string;
    languageId?: string;
    isOpen?: boolean;
  }[];

  /**
   * Phase 107: Workspace context for context-aware code generation
   * Supports refactoring existing code vs generating new code
   * Based on current file selection state
   */
  fz_context?: F0WorkspaceContext;
}

export interface F0ChatCompletionChoice {
  index: number;
  message: OpenAIChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | null;
}

/**
 * F0 Chat Completion Response
 * Compatible with OpenAI's chat completion response format
 */
export interface F0ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: F0ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Model info for /v1/models endpoint
 */
export interface F0ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface F0ModelsListResponse {
  object: 'list';
  data: F0ModelInfo[];
}

/**
 * Phase 108: Streaming chunk types
 * OpenAI-compatible Server-Sent Events format
 */
export interface F0ChatCompletionChunkDelta {
  role?: OpenAIChatRole;
  content?: string;
}

export interface F0ChatCompletionChunkChoice {
  index: number;
  delta: F0ChatCompletionChunkDelta;
  finish_reason: 'stop' | 'length' | null;
}

export interface F0ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: F0ChatCompletionChunkChoice[];
}
