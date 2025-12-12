// orchestrator/core/llm/clients/anthropicClient.ts
// Phase 170: Anthropic (Claude) Client

import Anthropic from '@anthropic-ai/sdk';
import type {
  ILLMClient,
  LLMChatOptions,
  LLMChatResponse,
  LLMProvider,
  LLMModelId,
} from '../types';

/**
 * Anthropic Claude Client
 */
export class F0AnthropicClient implements ILLMClient {
  provider: LLMProvider = 'anthropic';
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  async chat(options: LLMChatOptions): Promise<LLMChatResponse> {
    // Force failure for testing fallback behavior
    if (process.env.FORCE_ANTHROPIC_FAIL === '1') {
      console.log('[AnthropicClient] ⚠️ FORCED FAILURE (FORCE_ANTHROPIC_FAIL=1)');
      throw new Error('FORCED_FAIL_ANTHROPIC: Testing fallback behavior');
    }

    if (!this.client) {
      throw new Error('Anthropic client not initialized - missing ANTHROPIC_API_KEY');
    }

    const { model, messages, temperature = 0.7, maxTokens = 2048 } = options;

    // Convert messages to Anthropic format
    // Anthropic requires system message to be separate
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Map our model IDs to Anthropic model IDs
    const anthropicModel = this.mapModelId(model);

    const response = await this.client.messages.create({
      model: anthropicModel,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage?.content,
      messages: chatMessages,
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    return {
      content,
      model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'stop',
    };
  }

  /**
   * Map our model IDs to Anthropic's actual model IDs
   */
  private mapModelId(model: LLMModelId): string {
    const modelMap: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229': 'claude-3-opus-20240229',
      'claude-3-haiku-20240307': 'claude-3-haiku-20240307',
    };
    return modelMap[model] || model;
  }

  /**
   * Chat with vision support (Claude 3 supports images)
   */
  async chatWithVision(
    options: LLMChatOptions & { images?: { base64: string; mediaType: string }[] }
  ): Promise<LLMChatResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const { model, messages, temperature = 0.7, maxTokens = 2048, images } = options;

    const systemMessage = messages.find((m) => m.role === 'system');

    // Build messages with images
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m, idx) => {
        // Add images to the first user message
        if (m.role === 'user' && idx === 0 && images && images.length > 0) {
          return {
            role: 'user' as const,
            content: [
              ...images.map((img) => ({
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: img.base64,
                },
              })),
              { type: 'text' as const, text: m.content },
            ],
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      });

    const anthropicModel = this.mapModelId(model);

    const response = await this.client.messages.create({
      model: anthropicModel,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage?.content,
      messages: chatMessages,
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    return {
      content,
      model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: 'stop',
    };
  }
}

/**
 * Create Anthropic client instance
 */
export function createAnthropicClient(): F0AnthropicClient {
  return new F0AnthropicClient();
}

// Singleton instance
let anthropicInstance: F0AnthropicClient | null = null;

export function getAnthropicClient(): F0AnthropicClient {
  if (!anthropicInstance) {
    anthropicInstance = new F0AnthropicClient();
  }
  return anthropicInstance;
}
