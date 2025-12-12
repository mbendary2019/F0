// orchestrator/core/llm/instrumentedCall.ts
// Phase 170: Instrumented LLM Call - Unified wrapper with routing, cost tracking, and benchmarking

import type {
  LLMTaskType,
  LLMModelId,
  LLMChatOptions,
  LLMChatResponse,
  LLMRunMetricsSimple,
  UserPlanTier,
  LLMMessage,
} from './types';
import { getModelConfig, estimateCost } from './modelRegistry';
import { LLMClientFactory } from './clientFactory';
import { LLMRouter, type RoutingContext } from './router';
import { CostOptimizer, createCostTracker, type CostTracker } from './costOptimizer';
import { BenchmarkEngine } from './benchmarks';

/**
 * Options for instrumented LLM call
 */
export interface InstrumentedCallOptions {
  /** Task type for routing */
  taskType: LLMTaskType;
  /** User plan tier */
  userTier: UserPlanTier;
  /** User ID for cost tracking */
  userId: string;
  /** Project ID (optional) */
  projectId?: string;
  /** Messages to send */
  messages: LLMMessage[];
  /** Force specific model (bypass routing) */
  forceModel?: LLMModelId;
  /** Temperature (0-1) */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Response format */
  responseFormat?: 'text' | 'json';
  /** Enable caching */
  enableCache?: boolean;
  /** Task criticality */
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  /** Exclude providers */
  excludeProviders?: string[];
  /** Require vision capability */
  requireVision?: boolean;
}

/**
 * Result of instrumented LLM call
 */
export interface InstrumentedCallResult {
  /** Success flag */
  success: boolean;
  /** Response content */
  content: string;
  /** Model that was used */
  model: LLMModelId;
  /** Provider that was used */
  provider: string;
  /** Run metrics */
  metrics: LLMRunMetricsSimple;
  /** Routing decision */
  routingDecision: {
    preferredModel: LLMModelId;
    fallbackModels: LLMModelId[];
    reason: string;
  };
  /** Cost optimization applied */
  optimization?: {
    strategy: string;
    originalModel: LLMModelId;
    suggestedModel: LLMModelId;
    estimatedSavings: number;
  };
  /** Cache status */
  fromCache: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Cost trackers cache (in production, load from Firestore)
 */
const costTrackers = new Map<string, CostTracker>();

function getOrCreateTracker(userId: string, tier: UserPlanTier): CostTracker {
  const key = userId;
  if (!costTrackers.has(key)) {
    costTrackers.set(key, createCostTracker(userId, tier));
  }
  return costTrackers.get(key)!;
}

/**
 * Instrumented LLM Call
 * The main entry point for all LLM requests in F0
 */
export async function instrumentedLLMCall(
  options: InstrumentedCallOptions
): Promise<InstrumentedCallResult> {
  const startTime = Date.now();

  // Get or create cost tracker
  const tracker = getOrCreateTracker(options.userId, options.userTier);
  const optimizer = new CostOptimizer(tracker);

  // Estimate tokens (rough calculation)
  const estimatedInputTokens = options.messages
    .map(m => Math.ceil(m.content.length / 4))
    .reduce((a, b) => a + b, 0);
  const estimatedOutputTokens = options.maxTokens || 2000;

  // Check cache first
  if (options.enableCache !== false) {
    const cacheKey = CostOptimizer.generateCacheKey(options.taskType, options.messages);
    const cached = CostOptimizer.getCachedResponse(cacheKey);

    if (cached) {
      console.log('[InstrumentedCall] Cache hit:', cacheKey);
      return {
        success: true,
        content: cached.response,
        model: cached.model,
        provider: getModelConfig(cached.model)?.provider || 'unknown',
        metrics: {
          modelId: cached.model,
          latencyMs: 0,
          inputTokens: cached.tokens.input,
          outputTokens: cached.tokens.output,
          estimatedCostUSD: 0,
          success: true,
        },
        routingDecision: {
          preferredModel: cached.model,
          fallbackModels: [],
          reason: 'Served from cache',
        },
        fromCache: true,
      };
    }
  }

  // Route to best model
  const routingContext: RoutingContext = {
    taskType: options.taskType,
    userTier: options.userTier,
    criticality: options.criticality || 'medium',
    estimatedInputTokens,
    estimatedOutputTokens,
    forceModel: options.forceModel,
    excludeProviders: options.excludeProviders,
    requireVision: options.requireVision,
  };

  const routingDecision = LLMRouter.route(routingContext);

  // Get optimization recommendation
  const optimization = optimizer.recommend(
    options.taskType,
    routingDecision.preferredModel,
    { input: estimatedInputTokens, output: estimatedOutputTokens }
  );

  // Apply optimization if suggested
  let selectedModel = routingDecision.preferredModel;
  if (optimization.strategy === 'DOWNGRADE') {
    selectedModel = optimization.suggestedModel;
    console.log('[InstrumentedCall] Applying optimization:', optimization);
  }

  // Check budget
  const estimatedCost = estimateCost(selectedModel, estimatedInputTokens, estimatedOutputTokens);
  const budgetCheck = optimizer.canProceed(estimatedCost);

  if (!budgetCheck.allowed) {
    console.warn('[InstrumentedCall] Budget exceeded:', budgetCheck.reason);
    return {
      success: false,
      content: '',
      model: selectedModel,
      provider: getModelConfig(selectedModel)?.provider || 'unknown',
      metrics: {
        modelId: selectedModel,
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUSD: 0,
        success: false,
      },
      routingDecision: {
        preferredModel: routingDecision.preferredModel,
        fallbackModels: routingDecision.fallbackModels,
        reason: routingDecision.reason,
      },
      fromCache: false,
      error: budgetCheck.reason,
    };
  }

  if (budgetCheck.warning) {
    console.warn('[InstrumentedCall] Budget warning:', budgetCheck.warning);
  }

  // Get client and make the call
  const modelConfig = getModelConfig(selectedModel);
  if (!modelConfig) {
    return {
      success: false,
      content: '',
      model: selectedModel,
      provider: 'unknown',
      metrics: {
        modelId: selectedModel,
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
      },
      routingDecision: {
        preferredModel: routingDecision.preferredModel,
        fallbackModels: routingDecision.fallbackModels,
        reason: routingDecision.reason,
      },
      fromCache: false,
      error: `Unknown model: ${selectedModel}`,
    };
  }

  // Try primary model, then fallbacks
  const modelsToTry = [selectedModel, ...routingDecision.fallbackModels];
  let lastError: string | undefined;
  let response: LLMChatResponse | null = null;
  let usedModel: LLMModelId = selectedModel;

  for (const modelId of modelsToTry) {
    const config = getModelConfig(modelId);
    if (!config) continue;

    try {
      console.log(`[InstrumentedCall] Trying ${modelId} (${config.provider})...`);

      const client = LLMClientFactory.getByProvider(config.provider);

      const chatOptions: LLMChatOptions = {
        model: modelId,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        responseFormat: options.responseFormat,
      };

      response = await client.chat(chatOptions);
      usedModel = modelId;
      break; // Success!
    } catch (err: any) {
      lastError = err.message || 'Unknown error';
      console.error(`[InstrumentedCall] ${modelId} failed:`, lastError);
      // Continue to next fallback
    }
  }

  const latencyMs = Date.now() - startTime;

  // Calculate actual cost
  const actualInputTokens = response?.usage?.inputTokens || estimatedInputTokens;
  const actualOutputTokens = response?.usage?.outputTokens || 0;
  const actualCost = estimateCost(usedModel, actualInputTokens, actualOutputTokens);

  // Create metrics
  const metrics: LLMRunMetricsSimple = {
    modelId: usedModel,
    latencyMs,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    estimatedCostUSD: actualCost,
    success: !!response,
  };

  // Record spending
  optimizer.recordSpending(metrics);

  // Record benchmark
  BenchmarkEngine.createRunFromMetrics(metrics, options.taskType, {
    error: lastError,
  });

  // Cache successful response
  if (response && options.enableCache !== false) {
    const cacheKey = CostOptimizer.generateCacheKey(options.taskType, options.messages);
    CostOptimizer.cacheResponse(cacheKey, response.content, usedModel, {
      input: actualInputTokens,
      output: actualOutputTokens,
    });
  }

  return {
    success: !!response,
    content: response?.content || '',
    model: usedModel,
    provider: getModelConfig(usedModel)?.provider || 'unknown',
    metrics,
    routingDecision: {
      preferredModel: routingDecision.preferredModel,
      fallbackModels: routingDecision.fallbackModels,
      reason: routingDecision.reason,
    },
    optimization:
      optimization.strategy !== 'NONE'
        ? {
            strategy: optimization.strategy,
            originalModel: optimization.originalModel,
            suggestedModel: optimization.suggestedModel,
            estimatedSavings: optimization.estimatedSavings,
          }
        : undefined,
    fromCache: false,
    error: lastError,
  };
}

/**
 * Quick helper for code-related tasks
 */
export async function codeCall(
  taskType: 'AUTO_FIX' | 'CODE_REVIEW' | 'REFACTOR' | 'CODE_GENERATION' | 'TEST_GENERATION',
  userTier: UserPlanTier,
  userId: string,
  systemPrompt: string,
  userMessage: string,
  options?: Partial<InstrumentedCallOptions>
): Promise<InstrumentedCallResult> {
  return instrumentedLLMCall({
    taskType,
    userTier,
    userId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    criticality: 'high',
    ...options,
  });
}

/**
 * Quick helper for chat/general tasks
 */
export async function chatCall(
  userTier: UserPlanTier,
  userId: string,
  messages: LLMMessage[],
  options?: Partial<InstrumentedCallOptions>
): Promise<InstrumentedCallResult> {
  return instrumentedLLMCall({
    taskType: 'CHAT',
    userTier,
    userId,
    messages,
    criticality: 'low',
    ...options,
  });
}

/**
 * Quick helper for planning tasks
 */
export async function planningCall(
  userTier: UserPlanTier,
  userId: string,
  systemPrompt: string,
  userMessage: string,
  options?: Partial<InstrumentedCallOptions>
): Promise<InstrumentedCallResult> {
  return instrumentedLLMCall({
    taskType: 'PLANNING',
    userTier,
    userId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    criticality: 'medium',
    ...options,
  });
}

export default instrumentedLLMCall;
