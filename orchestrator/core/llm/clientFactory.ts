// orchestrator/core/llm/clientFactory.ts
// Phase 170.1.3: LLM Client Factory - Unified access to all LLM clients

import type { ILLMClient, LLMProvider } from './types';
import { F0MistralClient, createMistralClient } from './clients/mistralClient';
import { F0DevStralClient, createDevStralClient } from './clients/devstralClient';
import { F0AnthropicClient as AnthropicSDKClient, getAnthropicClient } from './clients/anthropicClient';

/**
 * OpenAI Client (uses existing implementation pattern)
 */
class F0OpenAIClient implements ILLMClient {
  readonly provider: LLMProvider = 'openai';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(options: import('./types').LLMChatOptions): Promise<import('./types').LLMChatResponse> {
    // Force 429 rate limit for testing fallback behavior
    if (process.env.FORCE_OPENAI_429 === '1') {
      console.log('[OpenAIClient] ⚠️ FORCED 429 RATE LIMIT (FORCE_OPENAI_429=1)');
      const error = new Error('OpenAI API error: 429 - Rate limit exceeded');
      (error as any).status = 429;
      (error as any).statusCode = 429;
      throw error;
    }

    // Force general failure for testing
    if (process.env.FORCE_OPENAI_FAIL === '1') {
      console.log('[OpenAIClient] ⚠️ FORCED FAILURE (FORCE_OPENAI_FAIL=1)');
      throw new Error('FORCED_FAIL_OPENAI: Testing fallback behavior');
    }

    const body = {
      model: options.model,
      messages: options.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.responseFormat === 'json' && {
        response_format: { type: 'json_object' },
      }),
    };

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
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    console.log('[OpenAIClient] Response:', {
      model: data.model,
      latencyMs,
      tokens: data.usage?.total_tokens,
    });

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: options.model,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      finishReason: data.choices[0]?.finish_reason === 'stop' ? 'stop' : 'length',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Anthropic Client (Claude)
 */
class F0AnthropicClient implements ILLMClient {
  readonly provider: LLMProvider = 'anthropic';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.anthropic.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(options: import('./types').LLMChatOptions): Promise<import('./types').LLMChatResponse> {
    // Extract system message if present
    const systemMessage = options.messages.find(m => m.role === 'system');
    const nonSystemMessages = options.messages.filter(m => m.role !== 'system');

    const body = {
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(systemMessage && { system: systemMessage.content }),
      messages: nonSystemMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
    };

    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    console.log('[AnthropicClient] Response:', {
      model: data.model,
      latencyMs,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    });

    // Anthropic returns content as array of blocks
    const textContent = data.content
      ?.filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('') ?? '';

    return {
      content: textContent,
      model: options.model,
      usage: data.usage ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
    };
  }

  async isAvailable(): Promise<boolean> {
    // Anthropic doesn't have a simple health check endpoint
    // We'll assume it's available if we have an API key
    return !!this.apiKey;
  }
}

/**
 * Google Gemini Client
 */
class F0GeminiClient implements ILLMClient {
  readonly provider: LLMProvider = 'gemini';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Map our model IDs to Gemini API model names
   */
  private mapModelId(modelId: string): string {
    const modelMap: Record<string, string> = {
      'gemini-1.5-flash': 'gemini-1.5-flash-latest',
      'gemini-1.5-pro': 'gemini-1.5-pro-latest',
      'gemini-2.0-flash': 'gemini-2.0-flash-exp',
    };
    return modelMap[modelId] || modelId;
  }

  async chat(options: import('./types').LLMChatOptions): Promise<import('./types').LLMChatResponse> {
    // Convert messages to Gemini format
    const contents = options.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Add system instruction if present
    const systemMessage = options.messages.find(m => m.role === 'system');

    const body = {
      contents,
      ...(systemMessage && {
        systemInstruction: { parts: [{ text: systemMessage.content }] },
      }),
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 4096,
        ...(options.responseFormat === 'json' && {
          responseMimeType: 'application/json',
        }),
      },
    };

    const startTime = Date.now();
    const geminiModelId = this.mapModelId(options.model);

    const response = await fetch(
      `${this.baseUrl}/models/${geminiModelId}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    console.log('[GeminiClient] Response:', {
      model: options.model,
      latencyMs,
      promptTokens: data.usageMetadata?.promptTokenCount,
      candidateTokens: data.usageMetadata?.candidatesTokenCount,
    });

    const textContent = data.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('') ?? '';

    return {
      content: textContent,
      model: options.model,
      usage: data.usageMetadata ? {
        inputTokens: data.usageMetadata.promptTokenCount,
        outputTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
      } : undefined,
      finishReason: data.candidates?.[0]?.finishReason === 'STOP' ? 'stop' : 'length',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Client cache to avoid re-creating clients
 */
const clientCache: Map<string, ILLMClient> = new Map();

/**
 * LLM Client Factory
 * Creates and manages LLM clients for different providers
 */
export class LLMClientFactory {
  /**
   * Get OpenAI client
   */
  static getOpenAI(): F0OpenAIClient {
    const cacheKey = 'openai';
    if (!clientCache.has(cacheKey)) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      clientCache.set(cacheKey, new F0OpenAIClient(apiKey));
    }
    return clientCache.get(cacheKey) as F0OpenAIClient;
  }

  /**
   * Get Anthropic (Claude) client - uses official SDK
   */
  static getAnthropic(): AnthropicSDKClient {
    const cacheKey = 'anthropic';
    if (!clientCache.has(cacheKey)) {
      const client = getAnthropicClient();
      clientCache.set(cacheKey, client);
    }
    return clientCache.get(cacheKey) as AnthropicSDKClient;
  }

  /**
   * Get Mistral client
   */
  static getMistral(): F0MistralClient {
    const cacheKey = 'mistral';
    if (!clientCache.has(cacheKey)) {
      clientCache.set(cacheKey, createMistralClient());
    }
    return clientCache.get(cacheKey) as F0MistralClient;
  }

  /**
   * Get DevStral client (code-specialized)
   */
  static getDevStral(): F0DevStralClient {
    const cacheKey = 'devstral';
    if (!clientCache.has(cacheKey)) {
      clientCache.set(cacheKey, createDevStralClient());
    }
    return clientCache.get(cacheKey) as F0DevStralClient;
  }

  /**
   * Get Gemini client
   */
  static getGemini(): F0GeminiClient {
    const cacheKey = 'gemini';
    if (!clientCache.has(cacheKey)) {
      const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable is not set');
      }
      clientCache.set(cacheKey, new F0GeminiClient(apiKey));
    }
    return clientCache.get(cacheKey) as F0GeminiClient;
  }

  /**
   * Get client by provider name
   */
  static getByProvider(provider: LLMProvider): ILLMClient {
    switch (provider) {
      case 'openai':
        return this.getOpenAI();
      case 'anthropic':
        return this.getAnthropic();
      case 'mistral':
        return this.getMistral();
      case 'devstral':
        return this.getDevStral();
      case 'gemini':
        return this.getGemini();
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Check which providers are available (have valid API keys)
   */
  static async getAvailableProviders(): Promise<LLMProvider[]> {
    const providers: LLMProvider[] = ['openai', 'anthropic', 'mistral', 'devstral', 'gemini'];
    const available: LLMProvider[] = [];

    for (const provider of providers) {
      try {
        const client = this.getByProvider(provider);
        if (await client.isAvailable()) {
          available.push(provider);
        }
      } catch {
        // Provider not configured, skip
      }
    }

    return available;
  }

  /**
   * Clear client cache (useful for testing or key rotation)
   */
  static clearCache(): void {
    clientCache.clear();
  }
}

export default LLMClientFactory;
