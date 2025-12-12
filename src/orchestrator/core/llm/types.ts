// orchestrator/core/llm/types.ts
// Phase 170: Multi-Model Orchestrator Types

/**
 * Supported LLM Providers
 */
export type LLMProvider = 'openai' | 'anthropic' | 'mistral' | 'devstral' | 'gemini';

/**
 * Supported Model IDs
 */
export type LLMModelId =
  // OpenAI Models
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  // Anthropic Models
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-haiku-20240307'
  // Mistral Models
  | 'mistral-small-latest'
  | 'mistral-medium-latest'
  | 'mistral-large-latest'
  // DevStral (Code-specialized Mistral)
  | 'devstral-small-2505'
  | 'codestral-latest'
  // Google Gemini
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash';

/**
 * Task types that determine routing
 */
export type LLMTaskType =
  | 'AUTO_FIX'           // ACE Auto-Fix
  | 'CODE_REVIEW'        // Code review and analysis
  | 'REFACTOR'           // Code refactoring
  | 'PLANNING'           // Project/task planning
  | 'AGENT_ROUTING'      // Orchestrator routing decisions
  | 'DOC_SUMMARY'        // Documentation summarization
  | 'MULTIMODAL_ANALYSIS'// Image/audio analysis
  | 'CHAT'               // General chat
  | 'TEST_GENERATION'    // ITG test generation
  | 'CODE_GENERATION';   // New code generation

/**
 * Model configuration
 */
export interface LLMModelConfig {
  id: LLMModelId;
  provider: LLMProvider;
  label: string;
  contextWindow: number;
  tokensPer1KCostUSD: {
    input: number;
    output: number;
  };
  strengths: LLMTaskType[];
  maxOutputTokens?: number;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  isDefault?: boolean;
}

/**
 * Routing decision result
 */
export interface LLMRouteDecision {
  taskType: LLMTaskType;
  preferredModel: LLMModelId;
  fallbackModels: LLMModelId[];
  reason: string;
  estimatedCostPer1K?: number;
}

/**
 * Input for routing decisions
 */
export interface RouteLLMTaskInput {
  type: LLMTaskType;
  planTier: 'free' | 'starter' | 'pro' | 'ultimate';
  language?: string;       // Programming language
  fileSize?: number;       // Context size in characters
  isCritical?: boolean;    // Production/deploy related
  hasImages?: boolean;     // Multimodal
  preferQuality?: boolean; // Prefer quality over cost
}

/**
 * Run metrics for benchmarking
 */
export interface LLMRunMetrics {
  id?: string;
  modelId: LLMModelId;
  provider: LLMProvider;
  taskType: LLMTaskType;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  success: boolean;
  errorType?: string;
  qualityScore?: number; // 0-1, optional manual/auto scoring
  projectId?: string;
  userId?: string;
  createdAt: number;
}

/**
 * Benchmark summary for a model
 */
export interface LLMBenchmarkSummary {
  modelId: LLMModelId;
  provider: LLMProvider;
  totalRuns: number;
  avgLatencyMs: number;
  avgCostPer1KTokens: number;
  successRate: number;
  avgQualityScore?: number;
  lastUpdated: number;
}

/**
 * Chat message format (unified across providers)
 */
export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64 encoded images for multimodal
}

/**
 * Chat completion options
 */
export interface LLMChatOptions {
  model: LLMModelId;
  messages: LLMChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  responseFormat?: 'text' | 'json';
}

/**
 * Chat completion response
 */
export interface LLMChatResponse {
  content: string;
  model: LLMModelId;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}

/**
 * Client interface all providers must implement
 */
export interface ILLMClient {
  provider: LLMProvider;
  chat(options: LLMChatOptions): Promise<LLMChatResponse>;
  isAvailable(): Promise<boolean>;
}

/**
 * User plan tiers for routing and cost control
 */
export type UserPlanTier = 'free' | 'pro' | 'ultimate';

/**
 * Simplified message type for convenience
 */
export type LLMMessage = LLMChatMessage;

/**
 * Run metrics (simplified for instrumentedCall)
 */
export interface LLMRunMetricsSimple {
  modelId: LLMModelId;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD?: number;
  success: boolean;
}
