// orchestrator/core/llm/costOptimizer.ts
// Phase 170.5: Cost Optimizer - Reduce LLM costs without sacrificing quality

import type {
  LLMTaskType,
  LLMModelId,
  LLMModelConfig,
  UserPlanTier,
  LLMRunMetricsSimple,
} from './types';
import { getModelConfig, LLM_MODELS, estimateCost } from './modelRegistry';
import { LLMRouter } from './router';

/**
 * Cost optimization strategies
 */
export type OptimizationStrategy =
  | 'NONE'           // No optimization
  | 'DOWNGRADE'      // Use cheaper model
  | 'CACHE'          // Use cached response
  | 'TRUNCATE'       // Reduce input tokens
  | 'BATCH'          // Batch multiple requests
  | 'SKIP';          // Skip non-essential calls

/**
 * Cost budget configuration
 */
export interface CostBudget {
  /** Daily budget in USD */
  dailyBudgetUSD: number;
  /** Monthly budget in USD */
  monthlyBudgetUSD: number;
  /** Per-request max in USD */
  perRequestMaxUSD: number;
  /** Warning threshold (0-1) */
  warningThreshold: number;
}

/**
 * Default budgets per tier
 */
const DEFAULT_BUDGETS: Record<UserPlanTier, CostBudget> = {
  free: {
    dailyBudgetUSD: 0.50,
    monthlyBudgetUSD: 5.00,
    perRequestMaxUSD: 0.02,
    warningThreshold: 0.8,
  },
  pro: {
    dailyBudgetUSD: 5.00,
    monthlyBudgetUSD: 50.00,
    perRequestMaxUSD: 0.20,
    warningThreshold: 0.8,
  },
  ultimate: {
    dailyBudgetUSD: 20.00,
    monthlyBudgetUSD: 200.00,
    perRequestMaxUSD: 1.00,
    warningThreshold: 0.9,
  },
};

/**
 * Cost tracking for a user/project
 */
export interface CostTracker {
  userId: string;
  projectId?: string;
  tier: UserPlanTier;
  /** Spending today (USD) */
  dailySpent: number;
  /** Spending this month (USD) */
  monthlySpent: number;
  /** Last reset timestamp */
  dailyResetAt: number;
  monthlyResetAt: number;
  /** Request count today */
  dailyRequests: number;
  /** Total tokens used today */
  dailyTokens: number;
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  strategy: OptimizationStrategy;
  originalModel: LLMModelId;
  suggestedModel: LLMModelId;
  estimatedSavings: number;
  reason: string;
  qualityImpact: 'none' | 'minimal' | 'moderate' | 'significant';
}

/**
 * Simple in-memory cache for responses
 */
interface CacheEntry {
  response: string;
  model: LLMModelId;
  timestamp: number;
  tokens: { input: number; output: number };
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cost Optimizer
 * Analyzes spending and recommends optimizations
 */
export class CostOptimizer {
  private budget: CostBudget;
  private tracker: CostTracker;

  constructor(tracker: CostTracker) {
    this.tracker = tracker;
    this.budget = DEFAULT_BUDGETS[tracker.tier];
  }

  /**
   * Check if a request should proceed based on budget
   */
  canProceed(estimatedCostUSD: number): {
    allowed: boolean;
    reason?: string;
    warning?: string;
  } {
    // Check per-request limit
    if (estimatedCostUSD > this.budget.perRequestMaxUSD) {
      return {
        allowed: false,
        reason: `Request cost ($${estimatedCostUSD.toFixed(4)}) exceeds per-request limit ($${this.budget.perRequestMaxUSD})`,
      };
    }

    // Check daily budget
    if (this.tracker.dailySpent + estimatedCostUSD > this.budget.dailyBudgetUSD) {
      return {
        allowed: false,
        reason: `Daily budget exhausted. Spent: $${this.tracker.dailySpent.toFixed(4)}, Limit: $${this.budget.dailyBudgetUSD}`,
      };
    }

    // Check monthly budget
    if (this.tracker.monthlySpent + estimatedCostUSD > this.budget.monthlyBudgetUSD) {
      return {
        allowed: false,
        reason: `Monthly budget exhausted. Spent: $${this.tracker.monthlySpent.toFixed(4)}, Limit: $${this.budget.monthlyBudgetUSD}`,
      };
    }

    // Check warning threshold
    const dailyUsage = (this.tracker.dailySpent + estimatedCostUSD) / this.budget.dailyBudgetUSD;
    if (dailyUsage > this.budget.warningThreshold) {
      return {
        allowed: true,
        warning: `Approaching daily budget limit (${(dailyUsage * 100).toFixed(1)}% used)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get optimization recommendation for a request
   */
  recommend(
    taskType: LLMTaskType,
    preferredModel: LLMModelId,
    estimatedTokens: { input: number; output: number }
  ): OptimizationRecommendation {
    const config = getModelConfig(preferredModel);
    if (!config) {
      return {
        strategy: 'NONE',
        originalModel: preferredModel,
        suggestedModel: preferredModel,
        estimatedSavings: 0,
        reason: 'Unknown model',
        qualityImpact: 'none',
      };
    }

    const estimatedCost = estimateCost(
      preferredModel,
      estimatedTokens.input,
      estimatedTokens.output
    );

    // Strategy 1: Check cache first
    // (actual cache check happens in instrumentedCall)

    // Strategy 2: Downgrade if over budget
    if (estimatedCost > this.budget.perRequestMaxUSD * 0.5) {
      const cheaperModel = this.findCheaperAlternative(taskType, preferredModel);
      if (cheaperModel && cheaperModel !== preferredModel) {
        const cheaperCost = estimateCost(
          cheaperModel,
          estimatedTokens.input,
          estimatedTokens.output
        );
        const savings = estimatedCost - cheaperCost;

        return {
          strategy: 'DOWNGRADE',
          originalModel: preferredModel,
          suggestedModel: cheaperModel,
          estimatedSavings: savings,
          reason: `Using ${cheaperModel} instead of ${preferredModel} to stay within budget`,
          qualityImpact: this.assessQualityImpact(preferredModel, cheaperModel),
        };
      }
    }

    // Strategy 3: Truncate if input is very large
    if (estimatedTokens.input > 50000) {
      return {
        strategy: 'TRUNCATE',
        originalModel: preferredModel,
        suggestedModel: preferredModel,
        estimatedSavings: estimatedCost * 0.3, // Rough estimate
        reason: 'Large input context - consider truncating to essential parts',
        qualityImpact: 'minimal',
      };
    }

    // No optimization needed
    return {
      strategy: 'NONE',
      originalModel: preferredModel,
      suggestedModel: preferredModel,
      estimatedSavings: 0,
      reason: 'Request is within budget, no optimization needed',
      qualityImpact: 'none',
    };
  }

  /**
   * Find a cheaper model that can handle the task
   */
  private findCheaperAlternative(
    taskType: LLMTaskType,
    currentModel: LLMModelId
  ): LLMModelId | null {
    const currentConfig = getModelConfig(currentModel);
    if (!currentConfig) return null;

    const currentCost =
      currentConfig.tokensPer1KCostUSD.input + currentConfig.tokensPer1KCostUSD.output;

    // Get models that support this task type
    const alternatives = LLM_MODELS.filter(m => {
      if (m.id === currentModel) return false;
      if (!m.strengths.includes(taskType)) return false;

      const altCost = m.tokensPer1KCostUSD.input + m.tokensPer1KCostUSD.output;
      return altCost < currentCost;
    });

    if (alternatives.length === 0) return null;

    // Return the cheapest alternative that still supports the task
    return alternatives.reduce((cheapest, current) => {
      const cheapestCost =
        cheapest.tokensPer1KCostUSD.input + cheapest.tokensPer1KCostUSD.output;
      const currentCost =
        current.tokensPer1KCostUSD.input + current.tokensPer1KCostUSD.output;
      return currentCost < cheapestCost ? current : cheapest;
    }).id;
  }

  /**
   * Assess quality impact of downgrading models
   */
  private assessQualityImpact(
    originalModel: LLMModelId,
    newModel: LLMModelId
  ): 'none' | 'minimal' | 'moderate' | 'significant' {
    const originalConfig = getModelConfig(originalModel);
    const newConfig = getModelConfig(newModel);

    if (!originalConfig || !newConfig) return 'moderate';

    // Same provider usually means similar quality
    if (originalConfig.provider === newConfig.provider) {
      return 'minimal';
    }

    // DevStral/Codestral to Mistral for code tasks
    if (
      (originalConfig.provider === 'devstral' && newConfig.provider === 'mistral') ||
      (originalConfig.provider === 'openai' && newConfig.provider === 'mistral')
    ) {
      return 'moderate';
    }

    // Major downgrades
    const premiumModels = ['gpt-4o', 'claude-3-5-sonnet-20241022', 'codestral-latest'];
    const basicModels = ['mistral-small-latest', 'gpt-4o-mini'];

    if (premiumModels.includes(originalModel) && basicModels.includes(newModel)) {
      return 'significant';
    }

    return 'moderate';
  }

  /**
   * Record spending after a request completes
   */
  recordSpending(metrics: LLMRunMetricsSimple): void {
    if (metrics.estimatedCostUSD) {
      this.tracker.dailySpent += metrics.estimatedCostUSD;
      this.tracker.monthlySpent += metrics.estimatedCostUSD;
    }
    this.tracker.dailyRequests += 1;
    this.tracker.dailyTokens += metrics.inputTokens + metrics.outputTokens;
  }

  /**
   * Get current spending summary
   */
  getSpendingSummary(): {
    daily: { spent: number; budget: number; percentage: number };
    monthly: { spent: number; budget: number; percentage: number };
    requests: number;
    tokens: number;
  } {
    return {
      daily: {
        spent: this.tracker.dailySpent,
        budget: this.budget.dailyBudgetUSD,
        percentage: (this.tracker.dailySpent / this.budget.dailyBudgetUSD) * 100,
      },
      monthly: {
        spent: this.tracker.monthlySpent,
        budget: this.budget.monthlyBudgetUSD,
        percentage: (this.tracker.monthlySpent / this.budget.monthlyBudgetUSD) * 100,
      },
      requests: this.tracker.dailyRequests,
      tokens: this.tracker.dailyTokens,
    };
  }

  /**
   * Reset daily counters (call at midnight)
   */
  resetDaily(): void {
    this.tracker.dailySpent = 0;
    this.tracker.dailyRequests = 0;
    this.tracker.dailyTokens = 0;
    this.tracker.dailyResetAt = Date.now();
  }

  /**
   * Reset monthly counters (call at month start)
   */
  resetMonthly(): void {
    this.tracker.monthlySpent = 0;
    this.tracker.monthlyResetAt = Date.now();
  }

  /**
   * Check and cache a response
   */
  static cacheResponse(
    cacheKey: string,
    response: string,
    model: LLMModelId,
    tokens: { input: number; output: number }
  ): void {
    responseCache.set(cacheKey, {
      response,
      model,
      timestamp: Date.now(),
      tokens,
    });

    // Clean old entries
    const now = Date.now();
    for (const [key, entry] of responseCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        responseCache.delete(key);
      }
    }
  }

  /**
   * Get cached response if available
   */
  static getCachedResponse(cacheKey: string): CacheEntry | null {
    const entry = responseCache.get(cacheKey);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      responseCache.delete(cacheKey);
      return null;
    }

    return entry;
  }

  /**
   * Generate cache key for a request
   */
  static generateCacheKey(
    taskType: LLMTaskType,
    messages: Array<{ role: string; content: string }>
  ): string {
    // Simple hash based on task type and message content
    const content = messages.map(m => `${m.role}:${m.content}`).join('|');
    const hash = content
      .split('')
      .reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    return `${taskType}_${hash}`;
  }
}

/**
 * Create a cost tracker for a user
 */
export function createCostTracker(
  userId: string,
  tier: UserPlanTier,
  projectId?: string
): CostTracker {
  return {
    userId,
    projectId,
    tier,
    dailySpent: 0,
    monthlySpent: 0,
    dailyResetAt: Date.now(),
    monthlyResetAt: Date.now(),
    dailyRequests: 0,
    dailyTokens: 0,
  };
}

export default CostOptimizer;
