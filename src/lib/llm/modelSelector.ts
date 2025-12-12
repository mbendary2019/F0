/**
 * Phase 176: Model Selector - Intelligent Multi-Provider Routing
 *
 * Features:
 * - Context-aware model selection based on task type
 * - Configurable routing policies (codeHeavy, longContext, reasoning, chatLight)
 * - Load balancing with configurable weights
 * - Automatic fallback on provider failure
 * - Decision logging for observability
 * - Error handling (Rate Limit, Auth, Timeout)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderName = 'openai' | 'anthropic' | 'google';

export interface ModelConfig {
  provider: ProviderName;
  modelId: string;
  displayName: string;
  costPer1kTokens: number; // USD
  maxTokens: number;
  contextWindow: number;
  capabilities: ModelCapability[];
  priority: number; // Higher = preferred
}

export type ModelCapability =
  | 'code_generation'
  | 'code_analysis'
  | 'long_context'
  | 'reasoning'
  | 'chat'
  | 'vision'
  | 'function_calling'
  | 'json_mode';

export type RoutingProfile =
  | 'codeHeavy'      // Complex code tasks → GPT-4.1 / Claude
  | 'longContext'    // Large context → Claude 3.5 Sonnet
  | 'reasoning'      // Business/planning → Gemini Pro
  | 'chatLight'      // Quick responses → GPT-4.1-mini
  | 'default';       // Balanced routing

export interface SelectionContext {
  conversationId?: string;
  messageId?: string;
  taskType?: string;
  prompt: string;
  promptTokens?: number;
  preferredProvider?: ProviderName;
  requiredCapabilities?: ModelCapability[];
  maxLatencyMs?: number;
  maxCostPerRequest?: number;
}

export interface ModelCandidate {
  model: string;
  provider: ProviderName;
  score: number;
  reasons: string[];
}

export interface SelectionDecision {
  event: 'ModelSelector.decision';
  conversationId?: string;
  messageId?: string;
  chosenModel: string;
  chosenProvider: ProviderName;
  profile: RoutingProfile;
  candidates: ModelCandidate[];
  reason: string;
  contextLength: number;
  timestamp: string;
  previousModel?: string;
  mode?: string;
}

export interface FallbackEvent {
  event: 'ModelSelector.fallback';
  conversationId?: string;
  messageId?: string;
  from: string;
  to: string;
  fromProvider: ProviderName;
  toProvider: ProviderName;
  reason: FallbackReason;
  timestamp: string;
}

export type FallbackReason =
  | 'RATE_LIMIT'
  | 'AUTH_ERROR'
  | 'TIMEOUT'
  | 'PRIMARY_PROVIDER_ERROR'
  | 'MODEL_UNAVAILABLE'
  | 'CONTEXT_TOO_LONG';

export interface LLMError {
  event: 'LLM.error';
  model: string;
  provider: ProviderName;
  errorType: string;
  statusCode?: number;
  timeoutMs?: number;
  message: string;
  timestamp: string;
}

export interface LoadBalancingStats {
  event: 'ModelSelector.stats';
  window: string;
  totalRequests: number;
  byModel: Record<string, number>;
  byProvider: Record<ProviderName, number>;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // OpenAI Models
  'openai:gpt-4.1': {
    provider: 'openai',
    modelId: 'gpt-4.1',
    displayName: 'GPT-4.1 (Code Heavy)',
    costPer1kTokens: 0.01,
    maxTokens: 8192,
    contextWindow: 128000,
    capabilities: ['code_generation', 'code_analysis', 'function_calling', 'json_mode', 'reasoning'],
    priority: 90,
  },
  'openai:gpt-4.1-mini': {
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini (Fast)',
    costPer1kTokens: 0.0004,
    maxTokens: 16384,
    contextWindow: 128000,
    capabilities: ['code_generation', 'chat', 'function_calling', 'json_mode'],
    priority: 70,
  },
  'openai:gpt-4o': {
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o (Balanced)',
    costPer1kTokens: 0.005,
    maxTokens: 4096,
    contextWindow: 128000,
    capabilities: ['code_generation', 'code_analysis', 'vision', 'function_calling', 'json_mode', 'reasoning'],
    priority: 85,
  },
  'openai:gpt-4o-mini': {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini (Budget)',
    costPer1kTokens: 0.00015,
    maxTokens: 16384,
    contextWindow: 128000,
    capabilities: ['chat', 'code_generation', 'function_calling'],
    priority: 60,
  },

  // Anthropic Models
  'anthropic:claude-3.5-sonnet': {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet (Long Context)',
    costPer1kTokens: 0.003,
    maxTokens: 8192,
    contextWindow: 200000,
    capabilities: ['long_context', 'code_analysis', 'reasoning', 'code_generation'],
    priority: 88,
  },
  'anthropic:claude-3-haiku': {
    provider: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku (Fast)',
    costPer1kTokens: 0.00025,
    maxTokens: 4096,
    contextWindow: 200000,
    capabilities: ['chat', 'code_generation'],
    priority: 55,
  },

  // Google Models
  'google:gemini-2.0-pro': {
    provider: 'google',
    modelId: 'gemini-2.0-pro',
    displayName: 'Gemini 2.0 Pro (Reasoning)',
    costPer1kTokens: 0.00125,
    maxTokens: 8192,
    contextWindow: 1000000,
    capabilities: ['reasoning', 'long_context', 'code_generation', 'vision'],
    priority: 82,
  },
  'google:gemini-1.5-flash': {
    provider: 'google',
    modelId: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash (Budget)',
    costPer1kTokens: 0.000075,
    maxTokens: 8192,
    contextWindow: 1000000,
    capabilities: ['chat', 'code_generation', 'vision'],
    priority: 50,
  },
};

export interface RoutingConfig {
  enabledModels: string[];
  defaultModel: string;
  routingPolicy: {
    default: string;
    codeHeavy: string;
    longContext: string;
    reasoning: string;
    chatLight: string;
  };
  fallbackOrder: string[];
  loadBalancing: Record<string, number>; // model → weight (0-1)
  timeoutMs: number;
  maxRetries: number;
}

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  enabledModels: [
    'openai:gpt-4o',
    'openai:gpt-4o-mini',
    'anthropic:claude-3.5-sonnet',
    'google:gemini-2.0-pro',
  ],
  defaultModel: 'openai:gpt-4o-mini',
  routingPolicy: {
    default: 'openai:gpt-4o-mini',
    codeHeavy: 'openai:gpt-4o',
    longContext: 'anthropic:claude-3.5-sonnet',
    reasoning: 'google:gemini-2.0-pro',
    chatLight: 'openai:gpt-4o-mini',
  },
  fallbackOrder: [
    'openai:gpt-4o-mini',
    'anthropic:claude-3.5-sonnet',
    'google:gemini-2.0-pro',
  ],
  loadBalancing: {
    'openai:gpt-4o-mini': 0.5,
    'anthropic:claude-3.5-sonnet': 0.3,
    'google:gemini-2.0-pro': 0.2,
  },
  timeoutMs: 30000,
  maxRetries: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// State Management
// ─────────────────────────────────────────────────────────────────────────────

interface ModelSelectorState {
  requestCounts: Record<string, number>;
  lastWindowReset: number;
  conversationModels: Map<string, string>; // conversationId → lastModel
  circuitBreaker: Map<string, { failures: number; openUntil: number }>;
}

const state: ModelSelectorState = {
  requestCounts: {},
  lastWindowReset: Date.now(),
  conversationModels: new Map(),
  circuitBreaker: new Map(),
};

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000;

// ─────────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the routing profile based on prompt content
 */
export function classifyPromptProfile(prompt: string, tokenCount?: number): RoutingProfile {
  const lowerPrompt = prompt.toLowerCase();
  const promptLength = prompt.length;
  const tokens = tokenCount ?? Math.ceil(promptLength / 4);

  // Long context detection (>20k chars or >5k tokens)
  if (promptLength > 20000 || tokens > 5000) {
    return 'longContext';
  }

  // Code-heavy indicators
  const codeIndicators = [
    'refactor', 'typescript', 'implement', 'function', 'class', 'interface',
    'debug', 'fix bug', 'code review', 'architecture', 'component', 'api',
    'endpoint', 'database', 'schema', 'migration', 'test', 'unit test',
    'حلّل', 'كود', 'اكتب', 'برمج', 'ملف', 'typescript', 'react', 'nextjs',
  ];

  const codeScore = codeIndicators.filter(ind => lowerPrompt.includes(ind)).length;
  if (codeScore >= 2) {
    return 'codeHeavy';
  }

  // Reasoning/planning indicators
  const reasoningIndicators = [
    'plan', 'strategy', 'business', 'launch', 'marketing', 'gtm',
    'compete', 'roadmap', 'phases', 'architecture decision', 'trade-off',
    'خطة', 'استراتيجية', 'مراحل', 'تخطيط', 'منافسة', 'إطلاق',
  ];

  const reasoningScore = reasoningIndicators.filter(ind => lowerPrompt.includes(ind)).length;
  if (reasoningScore >= 2) {
    return 'reasoning';
  }

  // Light chat (short, simple questions)
  if (promptLength < 200 && !codeScore && !reasoningScore) {
    return 'chatLight';
  }

  return 'default';
}

/**
 * Score a model for a given context
 */
function scoreModel(
  modelKey: string,
  config: ModelConfig,
  context: SelectionContext,
  profile: RoutingProfile
): number {
  let score = config.priority;

  // Profile-based scoring
  switch (profile) {
    case 'codeHeavy':
      if (config.capabilities.includes('code_generation')) score += 20;
      if (config.capabilities.includes('code_analysis')) score += 15;
      if (config.capabilities.includes('function_calling')) score += 10;
      break;
    case 'longContext':
      if (config.capabilities.includes('long_context')) score += 25;
      if (config.contextWindow > 100000) score += 15;
      break;
    case 'reasoning':
      if (config.capabilities.includes('reasoning')) score += 20;
      break;
    case 'chatLight':
      // Prefer cheaper, faster models
      score += Math.max(0, 20 - config.costPer1kTokens * 1000);
      break;
  }

  // Required capabilities check
  if (context.requiredCapabilities) {
    const missingCaps = context.requiredCapabilities.filter(
      cap => !config.capabilities.includes(cap)
    );
    if (missingCaps.length > 0) {
      score -= missingCaps.length * 30; // Heavy penalty for missing capabilities
    }
  }

  // Preferred provider bonus
  if (context.preferredProvider && config.provider === context.preferredProvider) {
    score += 10;
  }

  // Cost constraint
  if (context.maxCostPerRequest) {
    const estimatedTokens = context.promptTokens ?? 1000;
    const estimatedCost = (estimatedTokens / 1000) * config.costPer1kTokens * 2; // input + output
    if (estimatedCost > context.maxCostPerRequest) {
      score -= 50;
    }
  }

  // Circuit breaker check
  const circuitState = state.circuitBreaker.get(modelKey);
  if (circuitState && Date.now() < circuitState.openUntil) {
    score -= 100; // Model is in circuit breaker
  }

  return score;
}

/**
 * Select the best model for the given context
 */
export function selectModel(
  context: SelectionContext,
  config: RoutingConfig = DEFAULT_ROUTING_CONFIG
): SelectionDecision {
  const profile = classifyPromptProfile(context.prompt, context.promptTokens);

  // Get policy model for this profile
  const policyModel = config.routingPolicy[profile] || config.defaultModel;

  // Score all enabled models
  const candidates: ModelCandidate[] = config.enabledModels
    .map(modelKey => {
      const modelConfig = MODEL_REGISTRY[modelKey];
      if (!modelConfig) return null;

      const score = scoreModel(modelKey, modelConfig, context, profile);
      const reasons: string[] = [];

      if (profile === 'codeHeavy' && modelConfig.capabilities.includes('code_generation')) {
        reasons.push('CODE_INTENT');
      }
      if (profile === 'longContext' && modelConfig.capabilities.includes('long_context')) {
        reasons.push('LONG_CONTEXT');
      }
      if (profile === 'reasoning' && modelConfig.capabilities.includes('reasoning')) {
        reasons.push('REASONING');
      }
      if (modelConfig.capabilities.includes('function_calling')) {
        reasons.push('TOOL_CALL_POSSIBLE');
      }

      return {
        model: modelKey,
        provider: modelConfig.provider,
        score,
        reasons,
      };
    })
    .filter((c): c is ModelCandidate => c !== null)
    .sort((a, b) => b.score - a.score);

  // Apply load balancing for top candidates with similar scores
  let chosenModel = candidates[0]?.model || config.defaultModel;
  const topScore = candidates[0]?.score ?? 0;
  const similarCandidates = candidates.filter(c => topScore - c.score < 15);

  if (similarCandidates.length > 1) {
    // Weighted random selection among similar candidates
    const totalWeight = similarCandidates.reduce(
      (sum, c) => sum + (config.loadBalancing[c.model] ?? 0.1),
      0
    );

    let random = Math.random() * totalWeight;
    for (const candidate of similarCandidates) {
      random -= config.loadBalancing[candidate.model] ?? 0.1;
      if (random <= 0) {
        chosenModel = candidate.model;
        break;
      }
    }
  }

  // Track conversation model for context switching detection
  const previousModel = context.conversationId
    ? state.conversationModels.get(context.conversationId)
    : undefined;

  if (context.conversationId) {
    state.conversationModels.set(context.conversationId, chosenModel);
  }

  // Track request count for stats
  resetWindowIfNeeded();
  state.requestCounts[chosenModel] = (state.requestCounts[chosenModel] || 0) + 1;

  const chosenConfig = MODEL_REGISTRY[chosenModel];
  const decision: SelectionDecision = {
    event: 'ModelSelector.decision',
    conversationId: context.conversationId,
    messageId: context.messageId,
    chosenModel,
    chosenProvider: chosenConfig?.provider || 'openai',
    profile,
    candidates: candidates.slice(0, 5), // Top 5 for logging
    reason: candidates[0]?.reasons.join(' + ') || 'DEFAULT',
    contextLength: context.prompt.length,
    timestamp: new Date().toISOString(),
    previousModel,
    mode: profile,
  };

  // Log decision
  console.log(JSON.stringify(decision));

  return decision;
}

/**
 * Get fallback model when primary fails
 */
export function getFallbackModel(
  failedModel: string,
  reason: FallbackReason,
  context: SelectionContext,
  config: RoutingConfig = DEFAULT_ROUTING_CONFIG
): { model: string; provider: ProviderName; fallbackEvent: FallbackEvent } | null {
  // Record circuit breaker
  recordFailure(failedModel);

  // Find next available model in fallback order
  const failedIndex = config.fallbackOrder.indexOf(failedModel);
  const fallbackCandidates = config.fallbackOrder
    .slice(failedIndex + 1)
    .filter(m => {
      const circuitState = state.circuitBreaker.get(m);
      return !circuitState || Date.now() >= circuitState.openUntil;
    });

  if (fallbackCandidates.length === 0) {
    // All models in circuit breaker, try any enabled model
    const anyAvailable = config.enabledModels.find(m => {
      const circuitState = state.circuitBreaker.get(m);
      return m !== failedModel && (!circuitState || Date.now() >= circuitState.openUntil);
    });

    if (!anyAvailable) return null;
    fallbackCandidates.push(anyAvailable);
  }

  const fallbackModel = fallbackCandidates[0];
  const fallbackConfig = MODEL_REGISTRY[fallbackModel];
  const failedConfig = MODEL_REGISTRY[failedModel];

  const fallbackEvent: FallbackEvent = {
    event: 'ModelSelector.fallback',
    conversationId: context.conversationId,
    messageId: context.messageId,
    from: failedModel,
    to: fallbackModel,
    fromProvider: failedConfig?.provider || 'openai',
    toProvider: fallbackConfig?.provider || 'openai',
    reason,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(fallbackEvent));

  return {
    model: fallbackModel,
    provider: fallbackConfig?.provider || 'openai',
    fallbackEvent,
  };
}

/**
 * Log an LLM error
 */
export function logLLMError(
  model: string,
  provider: ProviderName,
  error: { type: string; statusCode?: number; timeoutMs?: number; message: string }
): LLMError {
  const errorEvent: LLMError = {
    event: 'LLM.error',
    model,
    provider,
    errorType: error.type,
    statusCode: error.statusCode,
    timeoutMs: error.timeoutMs,
    message: error.message,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(errorEvent));
  return errorEvent;
}

/**
 * Get load balancing stats for the current window
 */
export function getLoadBalancingStats(): LoadBalancingStats {
  resetWindowIfNeeded();

  const totalRequests = Object.values(state.requestCounts).reduce((a, b) => a + b, 0);

  const byProvider: Record<ProviderName, number> = {
    openai: 0,
    anthropic: 0,
    google: 0,
  };

  for (const [model, count] of Object.entries(state.requestCounts)) {
    const config = MODEL_REGISTRY[model];
    if (config) {
      byProvider[config.provider] += count;
    }
  }

  const stats: LoadBalancingStats = {
    event: 'ModelSelector.stats',
    window: 'last_5_min',
    totalRequests,
    byModel: { ...state.requestCounts },
    byProvider,
    timestamp: new Date().toISOString(),
  };

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function resetWindowIfNeeded(): void {
  const now = Date.now();
  if (now - state.lastWindowReset > WINDOW_MS) {
    state.requestCounts = {};
    state.lastWindowReset = now;
  }
}

function recordFailure(model: string): void {
  const current = state.circuitBreaker.get(model) || { failures: 0, openUntil: 0 };
  current.failures++;

  if (current.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    current.openUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT_MS;
    console.log(`[ModelSelector] Circuit breaker OPEN for ${model} until ${new Date(current.openUntil).toISOString()}`);
  }

  state.circuitBreaker.set(model, current);
}

/**
 * Reset circuit breaker for a model (after successful recovery)
 */
export function resetCircuitBreaker(model: string): void {
  state.circuitBreaker.delete(model);
}

/**
 * Check if a model is available (not in circuit breaker)
 */
export function isModelAvailable(model: string): boolean {
  const circuitState = state.circuitBreaker.get(model);
  return !circuitState || Date.now() >= circuitState.openUntil;
}

/**
 * Detect error type from HTTP status code or error message
 */
export function detectErrorType(
  statusCode?: number,
  errorMessage?: string
): FallbackReason {
  if (statusCode === 429) return 'RATE_LIMIT';
  if (statusCode === 401 || statusCode === 403) return 'AUTH_ERROR';
  if (errorMessage?.toLowerCase().includes('timeout')) return 'TIMEOUT';
  if (statusCode === 400 && errorMessage?.toLowerCase().includes('context')) {
    return 'CONTEXT_TOO_LONG';
  }
  return 'PRIMARY_PROVIDER_ERROR';
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export default {
  selectModel,
  getFallbackModel,
  logLLMError,
  getLoadBalancingStats,
  classifyPromptProfile,
  resetCircuitBreaker,
  isModelAvailable,
  detectErrorType,
  MODEL_REGISTRY,
  DEFAULT_ROUTING_CONFIG,
};
