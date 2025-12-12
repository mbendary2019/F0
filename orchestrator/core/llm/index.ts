// orchestrator/core/llm/index.ts
// Phase 170: Multi-Model Orchestrator - Main exports

// Types
export * from './types';

// Model Registry
export {
  LLM_MODELS,
  getModelConfig,
  getModelsByProvider,
  getModelsForTask,
  getCheapestModelForTask,
  getDefaultModel,
  estimateCost,
  getModelComparisons,
  type ModelComparison,
} from './modelRegistry';

// Clients
export { F0MistralClient, createMistralClient } from './clients/mistralClient';
export {
  F0DevStralClient,
  createDevStralClient,
  DEVSTRAL_SYSTEM_PROMPTS,
} from './clients/devstralClient';
export {
  F0AnthropicClient,
  createAnthropicClient,
  getAnthropicClient,
} from './clients/anthropicClient';

// Client Factory
export { LLMClientFactory } from './clientFactory';

// Router
export {
  LLMRouter,
  routeToModel,
  type RoutingContext,
  type TaskCriticality,
} from './router';

// Cost Optimizer
export {
  CostOptimizer,
  createCostTracker,
  type CostBudget,
  type CostTracker,
  type OptimizationStrategy,
  type OptimizationRecommendation,
} from './costOptimizer';

// Benchmarks
export {
  BenchmarkEngine,
  type BenchmarkRun,
  type ModelBenchmarkStats,
} from './benchmarks';

// Instrumented Call
export {
  instrumentedLLMCall,
  codeCall,
  chatCall,
  planningCall,
  type InstrumentedCallOptions,
  type InstrumentedCallResult,
} from './instrumentedCall';

// ACE Auto-Fix Integration
export {
  aceAutoFix,
  devstralCodeFix,
  getRecommendedCodeModel,
  quickFix,
  type AceIssue,
  type AcePatch,
  type AceAutoFixRequest,
  type AceAutoFixResponse,
} from './aceIntegration';

// ═══════════════════════════════════════════════════════════════
// Phase 170.2: Agent Roles System
// ═══════════════════════════════════════════════════════════════

// Agent Roles
export {
  AGENT_MODEL_MAP,
  parseModelIdentifier,
  getRoleDescription,
  getRoleModels,
  isCodeRole,
  isHighQualityRole,
  getRoleTemperature,
  type AgentRole,
  type ModelIdentifier,
  type AgentModelConfig,
} from './agentRoles';

// Intent Resolver
export {
  resolveAgentRole,
  resolveWithContext,
  hasCodeBlock,
  isFileAnalysisIntent,
  detectCodeLanguage,
  type IntentInput,
  type IntentResult,
} from './intentResolver';

// Agent Router
export {
  AgentRouter,
  routeAgent,
  routeWithRole,
  type AgentRoutingRequest,
  type AgentRoutingResult,
  type FallbackAttempt,
  type FallbackTrace,
} from './agentRouter';
