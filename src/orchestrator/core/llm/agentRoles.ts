// orchestrator/core/llm/agentRoles.ts
// Phase 170.2: Agent Roles System - Role-based model routing

import type { LLMModelId, LLMProvider } from './types';

/**
 * Agent Roles - Define what the agent is doing, not which model
 */
export type AgentRole =
  | 'chat_light'       // Light chat, greetings, short questions
  | 'planning'         // Planning, GTM, product ideas
  | 'ux_ideation'      // UX/UI ideation, user experience
  | 'code_generation'  // Writing code
  | 'code_review'      // Code review, refactoring
  | 'complex_analysis' // Deep analysis, complex decisions
  | 'fast_background'  // Fast invisible background tasks
  | 'fallback_safe';   // Safe fallback when anything fails

/**
 * Model identifier format: "provider:model"
 */
export type ModelIdentifier = `${LLMProvider}:${string}`;

/**
 * Agent Model Configuration
 */
export interface AgentModelConfig {
  primary: ModelIdentifier;
  fallback: ModelIdentifier[];
  /** Optional: Max latency threshold (ms) before trying fallback */
  maxLatencyMs?: number;
  /** Optional: Max cost per request (USD) */
  maxCostUSD?: number;
}

/**
 * Agent Model Map - Maps roles to models
 * This is the core configuration for role-based routing
 */
export const AGENT_MODEL_MAP: Record<AgentRole, AgentModelConfig> = {
  // ═══════════════════════════════════════════════════════════════
  // Light/Fast Tasks
  // ═══════════════════════════════════════════════════════════════
  chat_light: {
    primary: 'mistral:mistral-small-latest',
    fallback: ['anthropic:claude-3-haiku-20240307', 'openai:gpt-4o-mini'],
    maxLatencyMs: 2000,
    maxCostUSD: 0.005,
  },

  fast_background: {
    primary: 'mistral:mistral-small-latest',
    fallback: ['openai:gpt-4o-mini'],
    maxLatencyMs: 1500,
    maxCostUSD: 0.003,
  },

  // ═══════════════════════════════════════════════════════════════
  // Planning & Ideation (Claude Haiku - fast reasoning)
  // ═══════════════════════════════════════════════════════════════
  planning: {
    primary: 'anthropic:claude-3-haiku-20240307',
    fallback: ['openai:gpt-4o', 'mistral:mistral-medium-latest'],
    maxLatencyMs: 5000,
    maxCostUSD: 0.02,
  },

  ux_ideation: {
    primary: 'anthropic:claude-3-haiku-20240307',
    fallback: ['openai:gpt-4o', 'anthropic:claude-sonnet-4-20250514'],
    maxLatencyMs: 5000,
    maxCostUSD: 0.02,
  },

  // ═══════════════════════════════════════════════════════════════
  // Code Tasks (DevStral/Codestral - code specialists)
  // ═══════════════════════════════════════════════════════════════
  code_generation: {
    primary: 'devstral:devstral-small-2505',
    fallback: ['devstral:codestral-latest', 'anthropic:claude-sonnet-4-20250514', 'openai:gpt-4o'],
    maxLatencyMs: 10000,
    maxCostUSD: 0.05,
  },

  code_review: {
    primary: 'anthropic:claude-sonnet-4-20250514',
    fallback: ['devstral:codestral-latest', 'openai:gpt-4o'],
    maxLatencyMs: 15000,
    maxCostUSD: 0.10,
  },

  // ═══════════════════════════════════════════════════════════════
  // Complex Analysis (Claude Sonnet 4 - high IQ)
  // ═══════════════════════════════════════════════════════════════
  complex_analysis: {
    primary: 'anthropic:claude-sonnet-4-20250514',
    fallback: ['anthropic:claude-3-5-haiku-20241022', 'openai:gpt-4o'],
    maxLatencyMs: 30000,
    maxCostUSD: 0.50,
  },

  // ═══════════════════════════════════════════════════════════════
  // Safe Fallback (always available)
  // ═══════════════════════════════════════════════════════════════
  fallback_safe: {
    primary: 'openai:gpt-4o-mini',
    fallback: ['mistral:mistral-small-latest'],
    maxLatencyMs: 30000,
    maxCostUSD: 0.10,
  },
};

/**
 * Parse model identifier to provider and model
 */
export function parseModelIdentifier(identifier: ModelIdentifier): {
  provider: LLMProvider;
  model: LLMModelId;
} {
  const [provider, ...modelParts] = identifier.split(':');
  const model = modelParts.join(':'); // Handle model names with colons
  return {
    provider: provider as LLMProvider,
    model: model as LLMModelId,
  };
}

/**
 * Get role description for logging
 */
export function getRoleDescription(role: AgentRole): string {
  const descriptions: Record<AgentRole, string> = {
    chat_light: 'Light chat / greetings / short questions',
    planning: 'Planning / GTM / product ideas',
    ux_ideation: 'UX/UI ideation / user experience',
    code_generation: 'Code generation / writing code',
    code_review: 'Code review / refactoring',
    complex_analysis: 'Deep analysis / complex decisions',
    fast_background: 'Fast background tasks',
    fallback_safe: 'Safe fallback mode',
  };
  return descriptions[role];
}

/**
 * Get all models used by a role (primary + fallbacks)
 */
export function getRoleModels(role: AgentRole): ModelIdentifier[] {
  const config = AGENT_MODEL_MAP[role];
  return [config.primary, ...config.fallback];
}

/**
 * Check if a role is code-related
 */
export function isCodeRole(role: AgentRole): boolean {
  return role === 'code_generation' || role === 'code_review';
}

/**
 * Check if a role requires high-quality output
 */
export function isHighQualityRole(role: AgentRole): boolean {
  return role === 'complex_analysis' || role === 'code_review';
}

/**
 * Get recommended temperature for a role
 */
export function getRoleTemperature(role: AgentRole): number {
  const temperatures: Record<AgentRole, number> = {
    chat_light: 0.7,
    planning: 0.6,
    ux_ideation: 0.8,
    code_generation: 0.2,
    code_review: 0.1,
    complex_analysis: 0.3,
    fast_background: 0.5,
    fallback_safe: 0.5,
  };
  return temperatures[role];
}
