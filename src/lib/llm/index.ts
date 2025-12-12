/**
 * Phase 176: LLM Module - Unified Multi-Provider Interface
 *
 * Main exports:
 * - callLLM: Full-featured LLM call with routing, fallback, retry
 * - chat: Simple chat completion
 * - chatJSON: Chat with JSON mode
 * - selectModel: Get model selection decision
 * - getLoadBalancingStats: Get current routing stats
 */

export {
  callLLM,
  chat,
  chatJSON,
  type LLMMessage,
  type LLMRequestOptions,
  type LLMResponse,
} from './unifiedLLMClient';

export {
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
  type ProviderName,
  type ModelConfig,
  type ModelCapability,
  type RoutingProfile,
  type SelectionContext,
  type SelectionDecision,
  type FallbackEvent,
  type FallbackReason,
  type LLMError,
  type LoadBalancingStats,
  type RoutingConfig,
} from './modelSelector';

// Re-export legacy callOpenAI for backwards compatibility
export { callOpenAI } from './callOpenAI';
