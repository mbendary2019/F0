// orchestrator/core/media/visionRouter.ts
// Phase 171: Vision Model Router - Intelligent model selection for media analysis

import type {
  VisionModelId,
  VisionProvider,
  VisionModelConfig,
  VisionRoutingContext,
  VisionRoutingResult,
  AnalysisIntent,
  MediaType,
} from './mediaTypes';

/**
 * Vision model configurations
 */
export const VISION_MODELS: Record<VisionModelId, VisionModelConfig> = {
  // Anthropic Claude Models
  'claude-3-5-sonnet-20241022': {
    modelId: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    maxImageSize: 20 * 1024 * 1024, // 20MB
    maxTokens: 8192,
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    supportsMultipleImages: true,
    supportsPdf: false,
  },
  'claude-3-haiku-20240307': {
    modelId: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    maxImageSize: 20 * 1024 * 1024,
    maxTokens: 4096,
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    costPer1kInputTokens: 0.00025,
    costPer1kOutputTokens: 0.00125,
    supportsMultipleImages: true,
    supportsPdf: false,
  },
  'claude-sonnet-4-20250514': {
    modelId: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    maxImageSize: 20 * 1024 * 1024,
    maxTokens: 8192,
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    supportsMultipleImages: true,
    supportsPdf: false,
  },

  // OpenAI Models
  'gpt-4o': {
    modelId: 'gpt-4o',
    provider: 'openai',
    maxImageSize: 20 * 1024 * 1024,
    maxTokens: 4096,
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    costPer1kInputTokens: 0.005,
    costPer1kOutputTokens: 0.015,
    supportsMultipleImages: true,
    supportsPdf: false,
  },
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    maxImageSize: 20 * 1024 * 1024,
    maxTokens: 4096,
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    costPer1kInputTokens: 0.00015,
    costPer1kOutputTokens: 0.0006,
    supportsMultipleImages: true,
    supportsPdf: false,
  },

  // Google Gemini Models
  'gemini-1.5-flash': {
    modelId: 'gemini-1.5-flash',
    provider: 'gemini',
    maxImageSize: 20 * 1024 * 1024,
    maxTokens: 8192,
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    costPer1kInputTokens: 0.000075,
    costPer1kOutputTokens: 0.0003,
    supportsMultipleImages: true,
    supportsPdf: true,
  },
  'gemini-1.5-pro': {
    modelId: 'gemini-1.5-pro',
    provider: 'gemini',
    maxImageSize: 20 * 1024 * 1024,
    maxTokens: 8192,
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    costPer1kInputTokens: 0.00125,
    costPer1kOutputTokens: 0.005,
    supportsMultipleImages: true,
    supportsPdf: true,
  },
};

/**
 * Intent to model quality mapping
 * Higher number = needs better model
 */
const INTENT_COMPLEXITY: Record<AnalysisIntent, number> = {
  general_description: 1,
  document_summary: 2,
  data_extraction: 3,
  error_analysis: 3,
  code_extraction: 4,
  ui_extraction: 4,
  design_feedback: 4,
  accessibility_audit: 5,
};

/**
 * Tier to model quality mapping
 */
const TIER_MAX_QUALITY: Record<'free' | 'pro' | 'enterprise', number> = {
  free: 2,
  pro: 4,
  enterprise: 5,
};

/**
 * Models by quality tier
 */
const MODELS_BY_QUALITY: Record<number, VisionModelId[]> = {
  1: ['gpt-4o-mini', 'gemini-1.5-flash'],
  2: ['claude-3-haiku-20240307', 'gpt-4o-mini', 'gemini-1.5-flash'],
  3: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro'],
  4: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
  5: ['claude-sonnet-4-20250514', 'gpt-4o', 'gemini-1.5-pro'],
};

/**
 * Vision Router Class
 */
export class VisionRouter {
  /**
   * Route media analysis to appropriate model
   */
  static route(context: VisionRoutingContext): VisionRoutingResult {
    const { mediaType, intent, userTier, fileSizeBytes, isUrgent } = context;

    // Determine required quality level
    const intentComplexity = INTENT_COMPLEXITY[intent] || 3;
    const maxQuality = TIER_MAX_QUALITY[userTier];
    const targetQuality = Math.min(intentComplexity, maxQuality);

    // Get candidate models
    let candidates = MODELS_BY_QUALITY[targetQuality] || MODELS_BY_QUALITY[3];

    // Filter by PDF support if needed
    if (mediaType === 'pdf') {
      candidates = candidates.filter((m) => VISION_MODELS[m].supportsPdf);
      if (candidates.length === 0) {
        // Fall back to models that can handle extracted text
        candidates = ['claude-3-5-sonnet-20241022', 'gpt-4o'];
      }
    }

    // Filter by file size
    if (fileSizeBytes) {
      candidates = candidates.filter(
        (m) => VISION_MODELS[m].maxImageSize >= fileSizeBytes
      );
    }

    // For urgent requests, prefer faster models
    if (isUrgent) {
      const fastModels = ['gpt-4o-mini', 'gemini-1.5-flash', 'claude-3-haiku-20240307'];
      const urgentCandidates = candidates.filter((m) => fastModels.includes(m));
      if (urgentCandidates.length > 0) {
        candidates = urgentCandidates;
      }
    }

    // Select primary and fallbacks
    const [primary, ...fallbacks] = candidates;

    if (!primary) {
      // Absolute fallback
      return {
        primaryModel: 'gpt-4o-mini',
        provider: 'openai',
        fallbacks: ['claude-3-haiku-20240307'],
        reason: 'No suitable model found, using fallback',
      };
    }

    return {
      primaryModel: primary,
      provider: VISION_MODELS[primary].provider,
      fallbacks: fallbacks.slice(0, 2), // Max 2 fallbacks
      reason: this.buildReason(context, primary, targetQuality),
    };
  }

  /**
   * Build human-readable reason for model selection
   */
  private static buildReason(
    context: VisionRoutingContext,
    model: VisionModelId,
    quality: number
  ): string {
    const parts: string[] = [];

    parts.push(`Intent: ${context.intent} (complexity ${quality})`);
    parts.push(`Tier: ${context.userTier}`);

    if (context.isUrgent) {
      parts.push('Priority: urgent');
    }

    if (context.mediaType === 'pdf') {
      parts.push('Media: PDF');
    }

    return `Selected ${model}: ${parts.join(', ')}`;
  }

  /**
   * Get model configuration
   */
  static getModelConfig(modelId: VisionModelId): VisionModelConfig {
    const config = VISION_MODELS[modelId];
    if (!config) {
      throw new Error(`Unknown vision model: ${modelId}`);
    }
    return config;
  }

  /**
   * Check if provider has API key configured
   */
  static isProviderAvailable(provider: VisionProvider): boolean {
    switch (provider) {
      case 'anthropic':
        return !!process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return !!process.env.OPENAI_API_KEY;
      case 'gemini':
        return !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
      default:
        return false;
    }
  }

  /**
   * Get available providers
   */
  static getAvailableProviders(): VisionProvider[] {
    const providers: VisionProvider[] = ['anthropic', 'openai', 'gemini'];
    return providers.filter((p) => this.isProviderAvailable(p));
  }

  /**
   * Estimate cost for analysis
   */
  static estimateCost(
    modelId: VisionModelId,
    inputTokens: number,
    outputTokens: number
  ): number {
    const config = this.getModelConfig(modelId);
    const inputCost = (inputTokens / 1000) * config.costPer1kInputTokens;
    const outputCost = (outputTokens / 1000) * config.costPer1kOutputTokens;
    return inputCost + outputCost;
  }

  /**
   * Get cheapest model for intent
   */
  static getCheapestModel(intent: AnalysisIntent): VisionModelId {
    const complexity = INTENT_COMPLEXITY[intent] || 3;
    const models = MODELS_BY_QUALITY[Math.min(complexity, 2)] || ['gpt-4o-mini'];

    // Sort by cost
    const sorted = models
      .map((m) => ({
        model: m,
        cost: VISION_MODELS[m].costPer1kInputTokens + VISION_MODELS[m].costPer1kOutputTokens,
      }))
      .sort((a, b) => a.cost - b.cost);

    return sorted[0]?.model || 'gpt-4o-mini';
  }

  /**
   * Get best model for quality
   */
  static getBestModel(intent: AnalysisIntent): VisionModelId {
    const complexity = INTENT_COMPLEXITY[intent] || 3;
    const targetQuality = Math.min(complexity + 1, 5);
    const models = MODELS_BY_QUALITY[targetQuality] || MODELS_BY_QUALITY[5];
    return models[0] || 'claude-sonnet-4-20250514';
  }
}

/**
 * Convenience function for routing
 */
export function routeVision(context: VisionRoutingContext): VisionRoutingResult {
  return VisionRouter.route(context);
}

/**
 * Get model config by ID
 */
export function getVisionModelConfig(modelId: VisionModelId): VisionModelConfig {
  return VisionRouter.getModelConfig(modelId);
}
