// orchestrator/core/llm/clients/mistralClient.ts
// Phase 170.1: Mistral Client for F0 Orchestrator

import type {
  ILLMClient,
  LLMChatOptions,
  LLMChatResponse,
  LLMProvider,
} from '../types';

/**
 * Mistral API message format
 */
interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Mistral API response format
 */
interface MistralChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * F0 Mistral Client
 * Handles communication with Mistral AI API
 */
export class F0MistralClient implements ILLMClient {
  readonly provider: LLMProvider = 'mistral';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.mistral.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Send a chat completion request to Mistral
   */
  async chat(options: LLMChatOptions): Promise<LLMChatResponse> {
    // Force failure for testing fallback behavior
    if (process.env.FORCE_MISTRAL_FAIL === '1') {
      console.log('[MistralClient] ⚠️ FORCED FAILURE (FORCE_MISTRAL_FAIL=1)');
      throw new Error('FORCED_FAIL_MISTRAL: Testing fallback behavior');
    }

    const messages: MistralMessage[] = options.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const body = {
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.responseFormat === 'json' && {
        response_format: { type: 'json_object' },
      }),
    };

    console.log('[MistralClient] Sending request:', {
      model: options.model,
      messagesCount: messages.length,
      temperature: body.temperature,
    });

    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MistralClient] API Error:', response.status, errorText);
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const data: MistralChatResponse = await response.json();
    const latencyMs = Date.now() - startTime;

    console.log('[MistralClient] Response received:', {
      model: data.model,
      latencyMs,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      finishReason: data.choices[0]?.finish_reason,
    });

    const content = data.choices[0]?.message?.content ?? '';

    return {
      content,
      model: options.model,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      finishReason: this.mapFinishReason(data.choices[0]?.finish_reason),
    };
  }

  /**
   * Check if the Mistral API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Map Mistral finish reason to standard format
   */
  private mapFinishReason(reason?: string): 'stop' | 'length' | 'tool_calls' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }
}

/**
 * Create a Mistral client from environment variables
 */
export function createMistralClient(): F0MistralClient {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is not set');
  }
  return new F0MistralClient(apiKey);
}

export default F0MistralClient;
