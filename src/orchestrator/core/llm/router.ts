// orchestrator/core/llm/router.ts
// Phase 170.3: Multi-Model Router - Smart model selection based on task type

import type {
  LLMTaskType,
  LLMModelId,
  LLMRouteDecision,
  LLMModelConfig,
  UserPlanTier,
} from './types';
import {
  LLM_MODELS,
  getModelConfig,
  getModelsForTask,
  getCheapestModelForTask,
} from './modelRegistry';

/**
 * Routing configuration for different user tiers
 */
interface TierRoutingConfig {
  /** Default models for general tasks */
  defaultModels: LLMModelId[];
  /** Models for code-critical tasks */
  codeModels: LLMModelId[];
  /** Models for planning/architecture */
  planningModels: LLMModelId[];
  /** Max cost per request (USD) - 0 means no limit */
  maxCostPerRequest: number;
  /** Allow premium models */
  allowPremium: boolean;
}

/**
 * Tier-based routing configurations
 */
const TIER_CONFIGS: Record<UserPlanTier, TierRoutingConfig> = {
  free: {
    defaultModels: ['mistral-small-latest', 'claude-3-haiku-20240307', 'gpt-4o-mini'],
    codeModels: ['mistral-small-latest', 'gpt-4o-mini'],
    planningModels: ['mistral-small-latest', 'claude-3-haiku-20240307'],
    maxCostPerRequest: 0.01, // $0.01 max
    allowPremium: false,
  },
  pro: {
    defaultModels: ['claude-3-haiku-20240307', 'gpt-4o-mini', 'mistral-medium-latest'],
    codeModels: ['devstral-small-2505', 'claude-3-5-sonnet-20241022', 'codestral-latest', 'gpt-4o'],
    planningModels: ['claude-3-haiku-20240307', 'gpt-4o-mini', 'mistral-medium-latest'],
    maxCostPerRequest: 0.10, // $0.10 max
    allowPremium: true,
  },
  ultimate: {
    defaultModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-haiku-20240307'],
    codeModels: ['claude-3-5-sonnet-20241022', 'codestral-latest', 'devstral-small-2505', 'gpt-4o'],
    planningModels: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'gpt-4o'],
    maxCostPerRequest: 1.00, // $1.00 max
    allowPremium: true,
  },
};

/**
 * Task type to model strength mapping
 */
const TASK_MODEL_PREFERENCES: Record<LLMTaskType, LLMModelId[]> = {
  // Code tasks: DevStral first (specialized), then Claude Sonnet (quality), then GPT-4o
  AUTO_FIX: ['devstral-small-2505', 'claude-3-5-sonnet-20241022', 'codestral-latest', 'gpt-4o'],
  CODE_REVIEW: ['claude-3-5-sonnet-20241022', 'codestral-latest', 'gpt-4o', 'claude-3-opus-20240229'],
  REFACTOR: ['claude-3-5-sonnet-20241022', 'devstral-small-2505', 'codestral-latest', 'gpt-4o'],
  CODE_GENERATION: ['devstral-small-2505', 'claude-3-5-sonnet-20241022', 'codestral-latest', 'gpt-4o'],
  TEST_GENERATION: ['devstral-small-2505', 'claude-3-5-sonnet-20241022', 'codestral-latest', 'gpt-4o-mini'],

  // Planning tasks: Claude Haiku (fast reasoning), then Mistral, then GPT-4o-mini
  PLANNING: ['claude-3-haiku-20240307', 'mistral-small-latest', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022'],
  AGENT_ROUTING: ['claude-3-haiku-20240307', 'mistral-small-latest', 'gpt-4o-mini'],

  // Chat/General: Mix of cheap fast models
  CHAT: ['claude-3-haiku-20240307', 'mistral-small-latest', 'gpt-4o-mini', 'gemini-1.5-flash'],
  DOC_SUMMARY: ['claude-3-haiku-20240307', 'gemini-1.5-flash', 'gpt-4o-mini', 'mistral-small-latest'],

  // Multimodal: Vision-capable models (Claude Sonnet, GPT-4o, Gemini)
  MULTIMODAL_ANALYSIS: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro', 'claude-3-opus-20240229'],
};

/**
 * Criticality levels for tasks
 */
export type TaskCriticality = 'low' | 'medium' | 'high' | 'critical';

/**
 * Routing context for decision making
 */
export interface RoutingContext {
  taskType: LLMTaskType;
  userTier: UserPlanTier;
  criticality?: TaskCriticality;
  /** Estimated input tokens for cost calculation */
  estimatedInputTokens?: number;
  /** Estimated output tokens for cost calculation */
  estimatedOutputTokens?: number;
  /** Force a specific model (override routing) */
  forceModel?: LLMModelId;
  /** Exclude certain providers */
  excludeProviders?: string[];
  /** Require vision capability */
  requireVision?: boolean;
  /** Require streaming */
  requireStreaming?: boolean;
}

/**
 * Multi-Model Router
 * Selects the best model based on task type, user tier, and other factors
 */
export class LLMRouter {
  /**
   * Route a task to the best model
   */
  static route(context: RoutingContext): LLMRouteDecision {
    const { taskType, userTier, criticality = 'medium', forceModel } = context;

    // If model is forced, use it directly
    if (forceModel) {
      const config = getModelConfig(forceModel);
      if (config) {
        return {
          taskType,
          preferredModel: forceModel,
          fallbackModels: this.getFallbacks(forceModel, context),
          reason: 'Model forced by request',
        };
      }
    }

    // Get tier configuration
    const tierConfig = TIER_CONFIGS[userTier];

    // Get task preferences
    const taskPreferences = TASK_MODEL_PREFERENCES[taskType] || tierConfig.defaultModels;

    // Filter models based on constraints
    const eligibleModels = this.filterEligibleModels(taskPreferences, context, tierConfig);

    if (eligibleModels.length === 0) {
      // Fall back to cheapest available model
      const cheapest = getCheapestModelForTask(taskType);
      return {
        taskType,
        preferredModel: cheapest?.id || 'mistral-small-latest',
        fallbackModels: ['gpt-4o-mini'],
        reason: 'No eligible models found, using cheapest fallback',
      };
    }

    // Select based on criticality
    const selectedModel = this.selectByCriticality(eligibleModels, criticality);

    return {
      taskType,
      preferredModel: selectedModel,
      fallbackModels: this.getFallbacks(selectedModel, context),
      reason: this.buildReason(taskType, userTier, criticality, selectedModel),
    };
  }

  /**
   * Filter models based on constraints
   */
  private static filterEligibleModels(
    preferredModels: LLMModelId[],
    context: RoutingContext,
    tierConfig: TierRoutingConfig
  ): LLMModelId[] {
    return preferredModels.filter(modelId => {
      const config = getModelConfig(modelId);
      if (!config) return false;

      // Check provider exclusions
      if (context.excludeProviders?.includes(config.provider)) {
        return false;
      }

      // Check vision requirement
      if (context.requireVision && !config.supportsVision) {
        return false;
      }

      // Check streaming requirement
      if (context.requireStreaming && !config.supportsStreaming) {
        return false;
      }

      // Check premium access
      if (!tierConfig.allowPremium && this.isPremiumModel(modelId)) {
        return false;
      }

      // Check cost limits
      if (context.estimatedInputTokens && context.estimatedOutputTokens) {
        const estimatedCost = this.estimateCost(
          config,
          context.estimatedInputTokens,
          context.estimatedOutputTokens
        );
        if (estimatedCost > tierConfig.maxCostPerRequest) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Select model based on task criticality
   */
  private static selectByCriticality(
    models: LLMModelId[],
    criticality: TaskCriticality
  ): LLMModelId {
    // For critical tasks, prefer the first (most capable) model
    // For low criticality, prefer cheaper models
    if (criticality === 'critical' || criticality === 'high') {
      return models[0];
    }

    if (criticality === 'low') {
      // Find cheapest among eligible
      const modelConfigs = models
        .map(id => getModelConfig(id))
        .filter((c): c is LLMModelConfig => c !== undefined);

      const cheapest = modelConfigs.reduce((min, current) => {
        const minCost = min.tokensPer1KCostUSD.input + min.tokensPer1KCostUSD.output;
        const currentCost = current.tokensPer1KCostUSD.input + current.tokensPer1KCostUSD.output;
        return currentCost < minCost ? current : min;
      });

      return cheapest.id;
    }

    // Medium criticality - use first preference
    return models[0];
  }

  /**
   * Get fallback models for a primary selection
   */
  private static getFallbacks(
    primaryModel: LLMModelId,
    context: RoutingContext
  ): LLMModelId[] {
    const primaryConfig = getModelConfig(primaryModel);
    if (!primaryConfig) return ['mistral-small-latest'];

    // Get models with similar strengths
    const similarModels = getModelsForTask(context.taskType)
      .filter(m => m.id !== primaryModel)
      .slice(0, 3);

    const fallbacks = similarModels.map(m => m.id);

    // Always include a cheap fallback
    if (!fallbacks.includes('mistral-small-latest')) {
      fallbacks.push('mistral-small-latest');
    }

    return fallbacks;
  }

  /**
   * Check if a model is premium tier
   */
  private static isPremiumModel(modelId: LLMModelId): boolean {
    const premiumModels: LLMModelId[] = [
      'gpt-4o',
      'gpt-4-turbo',
      'claude-3-opus-20240229',
      'claude-3-5-sonnet-20241022',
      'gemini-1.5-pro',
      'codestral-latest',
    ];
    return premiumModels.includes(modelId);
  }

  /**
   * Estimate cost for a request
   */
  private static estimateCost(
    config: LLMModelConfig,
    inputTokens: number,
    outputTokens: number
  ): number {
    return (
      (inputTokens / 1000) * config.tokensPer1KCostUSD.input +
      (outputTokens / 1000) * config.tokensPer1KCostUSD.output
    );
  }

  /**
   * Build human-readable reason for routing decision
   */
  private static buildReason(
    taskType: LLMTaskType,
    userTier: UserPlanTier,
    criticality: TaskCriticality,
    selectedModel: LLMModelId
  ): string {
    const config = getModelConfig(selectedModel);
    const providerLabel = config?.provider || 'unknown';

    return `Selected ${config?.label || selectedModel} (${providerLabel}) for ${taskType} task. ` +
      `User tier: ${userTier}, Criticality: ${criticality}.`;
  }

  /**
   * Get routing recommendation for code tasks
   */
  static routeCodeTask(
    taskType: 'AUTO_FIX' | 'CODE_REVIEW' | 'REFACTOR' | 'CODE_GENERATION' | 'TEST_GENERATION',
    userTier: UserPlanTier,
    criticality: TaskCriticality = 'medium'
  ): LLMRouteDecision {
    return this.route({
      taskType,
      userTier,
      criticality,
    });
  }

  /**
   * Get routing recommendation for chat/general tasks
   */
  static routeChatTask(
    userTier: UserPlanTier,
    requireVision: boolean = false
  ): LLMRouteDecision {
    return this.route({
      taskType: requireVision ? 'MULTIMODAL_ANALYSIS' : 'CHAT',
      userTier,
      requireVision,
    });
  }

  /**
   * Quick helper: Get the best model for Auto-Fix
   */
  static getBestAutoFixModel(userTier: UserPlanTier): LLMModelId {
    return this.route({
      taskType: 'AUTO_FIX',
      userTier,
      criticality: 'high',
    }).preferredModel;
  }

  /**
   * Quick helper: Get cheapest model for planning
   */
  static getCheapPlanningModel(): LLMModelId {
    return this.route({
      taskType: 'PLANNING',
      userTier: 'free',
      criticality: 'low',
    }).preferredModel;
  }
}

/**
 * Convenience function for routing
 */
export function routeToModel(context: RoutingContext): LLMRouteDecision {
  return LLMRouter.route(context);
}

export default LLMRouter;
