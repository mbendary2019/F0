// desktop/src/lib/testing/itg/itgAiEnhancer.ts
// Phase 139.5: ITG AI Enhancer v1
// Flexible scaffold for AI-enhanced test suggestions
// Can be connected to any LLM (Claude, GPT, F0 Agent, etc.)

import type { ITGTestSuggestion, ITGAiSource } from './itgTypes';

/**
 * Configuration for ITG AI enhancement
 */
export interface ITGAiConfig {
  enabled: boolean;                // Master toggle
  mode?: 'hybrid' | 'full';        // hybrid = static + AI, full = AI only
  modelName?: string;              // Optional model identifier
  maxSuggestionsPerCall?: number;  // Safety limit per AI call
}

/**
 * Interface for AI client implementations
 * Implement this to connect to any LLM or agent
 */
export interface ITGAiClient {
  enhanceSuggestions: (params: {
    projectId: string;
    suggestions: ITGTestSuggestion[];
  }) => Promise<ITGTestSuggestion[]>;
}

/**
 * Identity client (default): returns suggestions unchanged.
 * Use until you connect a real LLM/agent.
 */
export const identityAiClient: ITGAiClient = {
  async enhanceSuggestions({ suggestions }) {
    // Simply tag as static and return unchanged
    return suggestions.map((s) => ({
      ...s,
      source: (s.source ?? 'static') as ITGAiSource,
    }));
  },
};

/**
 * Main function to enhance suggestions with AI.
 *
 * - If aiConfig.enabled=false or no suggestions → returns unchanged
 * - If enabled → passes through aiClient.enhanceSuggestions
 * - Safe fallback on error → returns original suggestions
 *
 * @param opts - Enhancement options
 * @returns Enhanced suggestions (or original if AI disabled/failed)
 */
export async function enhanceSuggestionsWithAI(opts: {
  projectId: string;
  suggestions: ITGTestSuggestion[];
  aiConfig: ITGAiConfig;
  aiClient?: ITGAiClient;
}): Promise<ITGTestSuggestion[]> {
  const { projectId, suggestions, aiConfig, aiClient } = opts;

  // Return unchanged if AI disabled or no suggestions
  if (!aiConfig.enabled || suggestions.length === 0) {
    return suggestions;
  }

  const client = aiClient ?? identityAiClient;
  const maxPerCall = aiConfig.maxSuggestionsPerCall ?? 20;

  // Slice to respect limit
  const toEnhance = suggestions.slice(0, maxPerCall);

  try {
    console.debug('[ITG AI] Enhancing', toEnhance.length, 'suggestions...');

    // Tag suggestions as static before sending to AI
    const taggedSuggestions = toEnhance.map((s) => ({
      ...s,
      source: (s.source ?? 'static') as ITGAiSource,
    }));

    // Call AI client
    const enhanced = await client.enhanceSuggestions({
      projectId,
      suggestions: taggedSuggestions,
    });

    console.debug('[ITG AI] Got', enhanced.length, 'enhanced suggestions');

    // Merge enhanced suggestions back into original list
    const enhancedIds = new Set(enhanced.map((e) => e.id));
    const merged = suggestions.map((s) => {
      if (!enhancedIds.has(s.id)) {
        return s; // Not enhanced, keep original
      }
      const e = enhanced.find((x) => x.id === s.id);
      if (!e) return s;

      // Merge AI enhancements
      return {
        ...s,
        ...e,
        source: (e.source ?? 'ai-hybrid') as ITGAiSource,
      };
    });

    return merged;
  } catch (err) {
    // Safe fallback: return original suggestions on any error
    console.error('[ITG AI] enhanceSuggestionsWithAI error:', err);
    return suggestions;
  }
}

/**
 * Default AI config (disabled)
 */
export const DEFAULT_AI_CONFIG: ITGAiConfig = {
  enabled: false,
  mode: 'hybrid',
  maxSuggestionsPerCall: 20,
};

/**
 * Create AI config from environment or settings
 */
export function createAiConfigFromEnv(): ITGAiConfig {
  // Check for env flag (works in both Node and browser with NEXT_PUBLIC_ prefix)
  const envEnabled =
    typeof process !== 'undefined' &&
    (process.env?.NEXT_PUBLIC_ITG_AI_ENABLED === '1' ||
     process.env?.NEXT_PUBLIC_ITG_AI_ENABLED === 'true');

  return {
    enabled: envEnabled,
    mode: 'hybrid',
    modelName: 'f0-default',
    maxSuggestionsPerCall: 20,
  };
}
