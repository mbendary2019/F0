// orchestrator/core/llm/modelRegistry.ts
// Phase 170: Model Registry - All available LLM models and their configurations

import type { LLMModelConfig, LLMModelId, LLMProvider } from './types';

/**
 * All available LLM models with their configurations
 */
export const LLM_MODELS: LLMModelConfig[] = [
  // ═══════════════════════════════════════════════════════════════
  // OpenAI Models
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    tokensPer1KCostUSD: { input: 2.5, output: 10.0 },
    strengths: ['CODE_GENERATION', 'MULTIMODAL_ANALYSIS', 'PLANNING', 'CODE_REVIEW'],
    supportsVision: true,
    supportsStreaming: true,
    isDefault: true,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o Mini',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    tokensPer1KCostUSD: { input: 0.15, output: 0.60 },
    strengths: ['CHAT', 'AGENT_ROUTING', 'DOC_SUMMARY', 'PLANNING'],
    supportsVision: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    label: 'GPT-4 Turbo',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    tokensPer1KCostUSD: { input: 10.0, output: 30.0 },
    strengths: ['CODE_GENERATION', 'REFACTOR', 'CODE_REVIEW'],
    supportsVision: true,
    supportsStreaming: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // Anthropic Models (Claude)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    label: 'Claude 3.5 Sonnet',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    tokensPer1KCostUSD: { input: 3.0, output: 15.0 },
    strengths: ['CODE_REVIEW', 'REFACTOR', 'AUTO_FIX', 'DOC_SUMMARY', 'CODE_GENERATION'],
    supportsVision: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    label: 'Claude 3 Opus',
    contextWindow: 200_000,
    maxOutputTokens: 4_096,
    tokensPer1KCostUSD: { input: 15.0, output: 75.0 },
    strengths: ['CODE_REVIEW', 'REFACTOR', 'PLANNING'],
    supportsVision: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    label: 'Claude 3 Haiku',
    contextWindow: 200_000,
    maxOutputTokens: 4_096,
    tokensPer1KCostUSD: { input: 0.25, output: 1.25 },
    strengths: ['CHAT', 'AGENT_ROUTING', 'DOC_SUMMARY'],
    supportsStreaming: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // Mistral Models
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'mistral-small-latest',
    provider: 'mistral',
    label: 'Mistral Small',
    contextWindow: 32_000,
    maxOutputTokens: 8_192,
    tokensPer1KCostUSD: { input: 0.1, output: 0.3 },
    strengths: ['CHAT', 'AGENT_ROUTING', 'DOC_SUMMARY', 'PLANNING'],
    supportsStreaming: true,
  },
  {
    id: 'mistral-medium-latest',
    provider: 'mistral',
    label: 'Mistral Medium',
    contextWindow: 32_000,
    maxOutputTokens: 8_192,
    tokensPer1KCostUSD: { input: 0.27, output: 0.81 },
    strengths: ['CODE_GENERATION', 'PLANNING', 'CHAT'],
    supportsStreaming: true,
  },
  {
    id: 'mistral-large-latest',
    provider: 'mistral',
    label: 'Mistral Large',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tokensPer1KCostUSD: { input: 2.0, output: 6.0 },
    strengths: ['CODE_GENERATION', 'CODE_REVIEW', 'REFACTOR', 'PLANNING'],
    supportsStreaming: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // DevStral / Codestral (Mistral Code Models)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'devstral-small-2505',
    provider: 'devstral',
    label: 'DevStral Small',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    tokensPer1KCostUSD: { input: 0.1, output: 0.3 },
    strengths: ['AUTO_FIX', 'CODE_GENERATION', 'REFACTOR', 'TEST_GENERATION'],
    supportsStreaming: true,
  },
  {
    id: 'codestral-latest',
    provider: 'devstral',
    label: 'Codestral',
    contextWindow: 256_000,
    maxOutputTokens: 16_384,
    tokensPer1KCostUSD: { input: 0.3, output: 0.9 },
    strengths: ['AUTO_FIX', 'CODE_GENERATION', 'CODE_REVIEW', 'REFACTOR', 'TEST_GENERATION'],
    supportsStreaming: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // Google Gemini
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'gemini-1.5-pro',
    provider: 'gemini',
    label: 'Gemini 1.5 Pro',
    contextWindow: 2_000_000,
    maxOutputTokens: 8_192,
    tokensPer1KCostUSD: { input: 1.25, output: 5.0 },
    strengths: ['MULTIMODAL_ANALYSIS', 'DOC_SUMMARY', 'PLANNING'],
    supportsVision: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'gemini',
    label: 'Gemini 1.5 Flash',
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
    tokensPer1KCostUSD: { input: 0.075, output: 0.30 },
    strengths: ['CHAT', 'DOC_SUMMARY', 'MULTIMODAL_ANALYSIS'],
    supportsVision: true,
    supportsStreaming: true,
  },
];

/**
 * Get model config by ID
 */
export function getModelConfig(modelId: LLMModelId): LLMModelConfig | undefined {
  return LLM_MODELS.find(m => m.id === modelId);
}

/**
 * Get all models for a provider
 */
export function getModelsByProvider(provider: LLMProvider): LLMModelConfig[] {
  return LLM_MODELS.filter(m => m.provider === provider);
}

/**
 * Get models that are strong at a specific task
 */
export function getModelsForTask(taskType: string): LLMModelConfig[] {
  return LLM_MODELS.filter(m => m.strengths.includes(taskType as any));
}

/**
 * Get the cheapest model for a task
 */
export function getCheapestModelForTask(taskType: string): LLMModelConfig | undefined {
  const models = getModelsForTask(taskType);
  if (models.length === 0) return undefined;

  return models.reduce((cheapest, current) => {
    const cheapestCost = cheapest.tokensPer1KCostUSD.input + cheapest.tokensPer1KCostUSD.output;
    const currentCost = current.tokensPer1KCostUSD.input + current.tokensPer1KCostUSD.output;
    return currentCost < cheapestCost ? current : cheapest;
  });
}

/**
 * Get the default model
 */
export function getDefaultModel(): LLMModelConfig {
  return LLM_MODELS.find(m => m.isDefault) || LLM_MODELS[0];
}

/**
 * Estimate cost for a request
 */
export function estimateCost(
  modelId: LLMModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const config = getModelConfig(modelId);
  if (!config) return 0;

  const inputCost = (inputTokens / 1000) * config.tokensPer1KCostUSD.input;
  const outputCost = (outputTokens / 1000) * config.tokensPer1KCostUSD.output;

  return inputCost + outputCost;
}

/**
 * Model comparison for display
 */
export interface ModelComparison {
  modelId: LLMModelId;
  label: string;
  provider: LLMProvider;
  costTier: 'cheap' | 'medium' | 'expensive';
  qualityTier: 'basic' | 'good' | 'excellent';
  speedTier: 'slow' | 'medium' | 'fast';
  bestFor: string[];
}

export function getModelComparisons(): ModelComparison[] {
  return [
    {
      modelId: 'mistral-small-latest',
      label: 'Mistral Small',
      provider: 'mistral',
      costTier: 'cheap',
      qualityTier: 'good',
      speedTier: 'fast',
      bestFor: ['Chat', 'Planning', 'Quick Tasks'],
    },
    {
      modelId: 'devstral-small-2505',
      label: 'DevStral Small',
      provider: 'devstral',
      costTier: 'cheap',
      qualityTier: 'excellent',
      speedTier: 'fast',
      bestFor: ['Auto-Fix', 'Code Generation', 'Refactoring'],
    },
    {
      modelId: 'codestral-latest',
      label: 'Codestral',
      provider: 'devstral',
      costTier: 'medium',
      qualityTier: 'excellent',
      speedTier: 'medium',
      bestFor: ['Complex Code', 'Code Review', 'Long Context'],
    },
    {
      modelId: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      provider: 'openai',
      costTier: 'cheap',
      qualityTier: 'good',
      speedTier: 'fast',
      bestFor: ['General Chat', 'Simple Code', 'Multimodal'],
    },
    {
      modelId: 'gpt-4o',
      label: 'GPT-4o',
      provider: 'openai',
      costTier: 'expensive',
      qualityTier: 'excellent',
      speedTier: 'medium',
      bestFor: ['Complex Tasks', 'Multimodal', 'Quality Critical'],
    },
    {
      modelId: 'claude-3-haiku-20240307',
      label: 'Claude 3 Haiku',
      provider: 'anthropic',
      costTier: 'cheap',
      qualityTier: 'good',
      speedTier: 'fast',
      bestFor: ['Chat', 'Quick Tasks', 'Summarization'],
    },
    {
      modelId: 'claude-3-5-sonnet-20241022',
      label: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      costTier: 'medium',
      qualityTier: 'excellent',
      speedTier: 'medium',
      bestFor: ['Code Review', 'Refactoring', 'Long Documents'],
    },
    {
      modelId: 'claude-3-opus-20240229',
      label: 'Claude 3 Opus',
      provider: 'anthropic',
      costTier: 'expensive',
      qualityTier: 'excellent',
      speedTier: 'slow',
      bestFor: ['Complex Analysis', 'Research', 'Enterprise'],
    },
    {
      modelId: 'gemini-1.5-flash',
      label: 'Gemini Flash',
      provider: 'gemini',
      costTier: 'cheap',
      qualityTier: 'good',
      speedTier: 'fast',
      bestFor: ['Very Long Context', 'Documents', 'Images'],
    },
  ];
}
