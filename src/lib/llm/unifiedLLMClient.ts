/**
 * Phase 176: Unified LLM Client - Multi-Provider with Smart Routing
 *
 * Features:
 * - Single interface for OpenAI, Anthropic, Google
 * - Automatic model selection via ModelSelector
 * - Fallback on provider failure
 * - Retry with exponential backoff
 * - Timeout handling
 * - Token usage tracking
 * - Request/Response logging
 */

import {
  selectModel,
  getFallbackModel,
  logLLMError,
  resetCircuitBreaker,
  detectErrorType,
  MODEL_REGISTRY,
  DEFAULT_ROUTING_CONFIG,
  type ProviderName,
  type SelectionContext,
  type RoutingConfig,
  type FallbackReason,
} from './modelSelector';
import { recordTokenUsage } from '../agents/tokenUsage';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequestOptions {
  messages: LLMMessage[];
  conversationId?: string;
  messageId?: string;
  projectId?: string;
  preferredProvider?: ProviderName;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: ProviderName;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackFrom?: string;
}

interface ProviderConfig {
  apiKey: string | undefined;
  baseUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Configurations
// ─────────────────────────────────────────────────────────────────────────────

function getProviderConfig(provider: ProviderName): ProviderConfig {
  switch (provider) {
    case 'openai':
      return {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: 'https://api.openai.com/v1/chat/completions',
      };
    case 'anthropic':
      return {
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: 'https://api.anthropic.com/v1/messages',
      };
    case 'google':
      return {
        apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider-Specific Call Functions
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAI(
  modelId: string,
  messages: LLMMessage[],
  options: { temperature?: number; maxTokens?: number; jsonMode?: boolean; timeoutMs: number }
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
  const config = getProviderConfig('openai');

  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4000,
    };

    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(
  modelId: string,
  messages: LLMMessage[],
  options: { temperature?: number; maxTokens?: number; timeoutMs: number }
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
  const config = getProviderConfig('anthropic');

  if (!config.apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    // Extract system message and convert to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const nonSystemMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: modelId,
      messages: nonSystemMessages,
      max_tokens: options.maxTokens ?? 4000,
      temperature: options.temperature ?? 0.7,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return {
      content: data.content?.[0]?.text ?? '',
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(
  modelId: string,
  messages: LLMMessage[],
  options: { temperature?: number; maxTokens?: number; timeoutMs: number }
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
  const config = getProviderConfig('google');

  if (!config.apiKey) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    // Convert to Gemini format
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 4000,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const url = `${config.baseUrl}/${modelId}:generateContent?key=${config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Client Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call LLM with automatic model selection, fallback, and retry
 */
export async function callLLM(
  options: LLMRequestOptions,
  routingConfig: RoutingConfig = DEFAULT_ROUTING_CONFIG
): Promise<LLMResponse> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs ?? routingConfig.timeoutMs;
  const maxRetries = options.maxRetries ?? routingConfig.maxRetries;

  // Build prompt for model selection
  const fullPrompt = options.messages.map(m => m.content).join('\n');

  // Select model
  const selectionContext: SelectionContext = {
    conversationId: options.conversationId,
    messageId: options.messageId,
    prompt: fullPrompt,
    preferredProvider: options.preferredProvider,
  };

  const decision = selectModel(selectionContext, routingConfig);
  let currentModel = decision.chosenModel;
  let currentProvider = decision.chosenProvider;
  let fallbackUsed = false;
  let fallbackFrom: string | undefined;
  let lastError: Error | undefined;

  // Try with retries and fallback
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(JSON.stringify({
        event: 'LLM.request',
        model: currentModel,
        provider: currentProvider,
        messageId: options.messageId,
        attempt: attempt + 1,
        timestamp: new Date().toISOString(),
      }));

      const modelConfig = MODEL_REGISTRY[currentModel];
      const modelId = modelConfig?.modelId ?? currentModel.split(':')[1];

      let result: { content: string; usage: { promptTokens: number; completionTokens: number } };

      switch (currentProvider) {
        case 'openai':
          result = await callOpenAI(modelId, options.messages, {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            jsonMode: options.jsonMode,
            timeoutMs,
          });
          break;
        case 'anthropic':
          result = await callAnthropic(modelId, options.messages, {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            timeoutMs,
          });
          break;
        case 'google':
          result = await callGemini(modelId, options.messages, {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            timeoutMs,
          });
          break;
        default:
          throw new Error(`Unknown provider: ${currentProvider}`);
      }

      // Success! Reset circuit breaker for this model
      resetCircuitBreaker(currentModel);

      const latencyMs = Date.now() - startTime;

      // Log response
      console.log(JSON.stringify({
        event: 'LLM.response',
        model: currentModel,
        provider: currentProvider,
        messageId: options.messageId,
        latencyMs,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        timestamp: new Date().toISOString(),
      }));

      // Record token usage
      if (options.projectId) {
        try {
          await recordTokenUsage({
            projectId: options.projectId,
            model: currentModel,
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
            provider: currentProvider,
          });
        } catch (e) {
          console.error('[LLM Client] Failed to record token usage:', e);
        }
      }

      return {
        content: result.content,
        model: currentModel,
        provider: currentProvider,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.promptTokens + result.usage.completionTokens,
        },
        latencyMs,
        fallbackUsed,
        fallbackFrom,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Parse error type
      const statusMatch = lastError.message.match(/\((\d+)\)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : undefined;
      const isTimeout = lastError.name === 'AbortError' || lastError.message.includes('timeout');
      const errorType = isTimeout ? 'TIMEOUT' : detectErrorType(statusCode, lastError.message);

      // Log error
      logLLMError(currentModel, currentProvider, {
        type: errorType,
        statusCode,
        timeoutMs: isTimeout ? timeoutMs : undefined,
        message: lastError.message,
      });

      // Try fallback
      const fallback = getFallbackModel(currentModel, errorType as FallbackReason, selectionContext, routingConfig);

      if (fallback) {
        fallbackFrom = fallbackFrom || currentModel;
        currentModel = fallback.model;
        currentProvider = fallback.provider;
        fallbackUsed = true;
        continue; // Try with fallback
      }

      // No fallback available
      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[LLM Client] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }

  // All attempts failed
  throw lastError || new Error('LLM request failed after all retries');
}

/**
 * Simple wrapper for basic chat completion
 */
export async function chat(
  messages: LLMMessage[],
  projectId?: string
): Promise<string> {
  const response = await callLLM({
    messages,
    projectId,
  });
  return response.content;
}

/**
 * Chat with JSON mode enabled
 */
export async function chatJSON<T = unknown>(
  messages: LLMMessage[],
  projectId?: string
): Promise<T> {
  const response = await callLLM({
    messages,
    projectId,
    jsonMode: true,
    preferredProvider: 'openai', // JSON mode works best with OpenAI
  });

  try {
    return JSON.parse(response.content) as T;
  } catch (e) {
    console.error('[LLM Client] Failed to parse JSON response:', response.content);
    throw new Error('LLM response is not valid JSON');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export default {
  callLLM,
  chat,
  chatJSON,
};
