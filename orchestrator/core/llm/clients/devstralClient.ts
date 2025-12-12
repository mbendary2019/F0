// orchestrator/core/llm/clients/devstralClient.ts
// Phase 170.2: DevStral Client for Code-Specialized Tasks

import type {
  ILLMClient,
  LLMChatOptions,
  LLMChatResponse,
  LLMProvider,
} from '../types';

/**
 * DevStral API message format (same as Mistral)
 */
interface DevStralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * DevStral API response format
 */
interface DevStralChatResponse {
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
 * DevStral-specific system prompts for code tasks
 */
export const DEVSTRAL_SYSTEM_PROMPTS = {
  AUTO_FIX: `You are DevStral, a code-specialized AI assistant integrated inside F0 IDE.
Your job is to analyze code and apply minimal, safe fixes.

Rules:
1. Read the provided code carefully
2. Identify the issue based on error context
3. Apply the MINIMUM change needed to fix it
4. Preserve existing code style and patterns
5. Return ONLY the fixed code, no explanations
6. If multiple files need changes, clearly separate them with file paths

Format your response as:
\`\`\`filepath:/path/to/file.ts
// fixed code here
\`\`\``,

  REFACTOR: `You are DevStral, a code-specialized AI assistant.
Your task is to refactor code while preserving behavior.

Rules:
1. Maintain all existing functionality
2. Improve code readability and maintainability
3. Apply TypeScript/React best practices
4. Keep the same API/interface if possible
5. Add appropriate types where missing
6. Split large functions if needed`,

  CODE_REVIEW: `You are DevStral, a senior code reviewer.
Analyze the code and provide actionable feedback.

Focus on:
1. Potential bugs or edge cases
2. Performance issues
3. Security concerns
4. Type safety issues
5. Code organization
6. Best practices violations

Format: Use bullet points, be specific, suggest fixes.`,

  TEST_GENERATION: `You are DevStral, a test generation specialist.
Generate comprehensive tests for the provided code.

Rules:
1. Use Jest/Vitest syntax
2. Cover happy paths and edge cases
3. Test error handling
4. Use meaningful test names
5. Mock external dependencies
6. Aim for high coverage`,
};

/**
 * F0 DevStral Client
 * Specialized for code-related tasks
 */
export class F0DevStralClient implements ILLMClient {
  readonly provider: LLMProvider = 'devstral';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.mistral.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Send a chat completion request to DevStral
   */
  async chat(options: LLMChatOptions): Promise<LLMChatResponse> {
    // Force failure for testing fallback behavior
    if (process.env.FORCE_DEVSTRAL_FAIL === '1') {
      console.log('[DevStralClient] ⚠️ FORCED FAILURE (FORCE_DEVSTRAL_FAIL=1)');
      throw new Error('FORCED_FAIL_DEVSTRAL: Testing fallback behavior');
    }

    // Force timeout for testing fallback behavior
    if (process.env.FORCE_DEVSTRAL_TIMEOUT === '1') {
      console.log('[DevStralClient] ⚠️ FORCED TIMEOUT (FORCE_DEVSTRAL_TIMEOUT=1)');
      throw new Error('Request timed out after 30000ms');
    }

    const messages: DevStralMessage[] = options.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Map DevStral model names to Mistral API model names
    const apiModel = this.mapModelName(options.model);

    const body = {
      model: apiModel,
      messages,
      temperature: options.temperature ?? 0.1, // Lower temp for code
      max_tokens: options.maxTokens ?? 8192,
      ...(options.responseFormat === 'json' && {
        response_format: { type: 'json_object' },
      }),
    };

    console.log('[DevStralClient] Sending request:', {
      model: apiModel,
      originalModel: options.model,
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
      console.error('[DevStralClient] API Error:', response.status, errorText);
      throw new Error(`DevStral API error: ${response.status} - ${errorText}`);
    }

    const data: DevStralChatResponse = await response.json();
    const latencyMs = Date.now() - startTime;

    console.log('[DevStralClient] Response received:', {
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
   * Code-specific chat with appropriate system prompt
   */
  async codeChat(options: {
    taskType: 'AUTO_FIX' | 'REFACTOR' | 'CODE_REVIEW' | 'TEST_GENERATION';
    model?: string;
    userMessage: string;
    codeContext: string;
    errorContext?: string;
    temperature?: number;
  }): Promise<LLMChatResponse> {
    const systemPrompt = DEVSTRAL_SYSTEM_PROMPTS[options.taskType];

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: this.buildCodePrompt(options),
      },
    ];

    return this.chat({
      model: (options.model || 'devstral-small-2505') as any,
      messages,
      temperature: options.temperature ?? 0.1,
    });
  }

  /**
   * Build a code-focused prompt
   */
  private buildCodePrompt(options: {
    userMessage: string;
    codeContext: string;
    errorContext?: string;
  }): string {
    let prompt = `## Request\n${options.userMessage}\n\n`;
    prompt += `## Code\n\`\`\`\n${options.codeContext}\n\`\`\`\n`;

    if (options.errorContext) {
      prompt += `\n## Error Context\n\`\`\`\n${options.errorContext}\n\`\`\`\n`;
    }

    return prompt;
  }

  /**
   * Check if DevStral API is available
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
   * Map internal model names to API model names
   */
  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'devstral-small-2505': 'devstral-small-2505',
      'codestral-latest': 'codestral-latest',
    };
    return modelMap[model] || model;
  }

  /**
   * Map finish reason to standard format
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
 * Create a DevStral client from environment variables
 */
export function createDevStralClient(): F0DevStralClient {
  // DevStral uses the same API key as Mistral (it's a Mistral model)
  const apiKey = process.env.DEVSTRAL_API_KEY || process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('DEVSTRAL_API_KEY or MISTRAL_API_KEY environment variable is not set');
  }
  return new F0DevStralClient(apiKey);
}

export default F0DevStralClient;
