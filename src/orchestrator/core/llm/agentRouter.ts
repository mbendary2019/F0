// orchestrator/core/llm/agentRouter.ts
// Phase 170.2: Agent Router - Routes requests to appropriate models based on role

import type { LLMModelId, LLMProvider, LLMChatOptions, LLMChatResponse } from './types';
import type { AgentRole, ModelIdentifier, AgentModelConfig } from './agentRoles';
import { AGENT_MODEL_MAP, parseModelIdentifier, getRoleDescription, getRoleTemperature } from './agentRoles';
import { resolveAgentRole, resolveWithContext, type IntentInput, type IntentResult } from './intentResolver';
import { LLMClientFactory } from './clientFactory';
import { BenchmarkEngine } from './benchmarks';

/**
 * Agent routing request
 */
export interface AgentRoutingRequest {
  /** User message (for intent resolution) */
  message: string;
  /** Pre-resolved role (skip intent resolution) */
  role?: AgentRole;
  /** Chat options */
  options: Omit<LLMChatOptions, 'model'>;
  /** User ID for tracking */
  userId: string;
  /** User tier */
  userTier?: 'free' | 'pro' | 'ultimate';
  /** Previous role in conversation */
  previousRole?: AgentRole;
  /** Force specific model (bypass routing) */
  forceModel?: LLMModelId;
}

/**
 * Fallback attempt record
 */
export interface FallbackAttempt {
  model: LLMModelId;
  provider: LLMProvider;
  errorType?: string;
  errorMessage?: string;
  latencyMs?: number;
}

/**
 * Complete fallback trace for analytics
 */
export interface FallbackTrace {
  primaryModel: LLMModelId;
  primaryProvider: LLMProvider;
  fallbackChain: FallbackAttempt[];
  finalModelUsed: LLMModelId;
  finalProvider: LLMProvider;
  errorType?: string;
  attemptCount: number;
  totalLatencyMs: number;
}

/**
 * Agent routing result
 */
export interface AgentRoutingResult {
  success: boolean;
  response?: LLMChatResponse;
  role: AgentRole;
  intent?: IntentResult;
  modelUsed: LLMModelId;
  providerUsed: LLMProvider;
  fallbacksUsed: number;
  latencyMs: number;
  error?: string;
  /** Complete fallback trace for analytics */
  trace?: FallbackTrace;
}

/**
 * Logging interface
 */
interface AgentLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  data: Record<string, unknown>;
}

const logs: AgentLog[] = [];

/**
 * Error classification for smart fallback decisions
 */
type ErrorType = 'RATE_LIMIT' | 'AUTH_ERROR' | 'TIMEOUT' | 'SERVER_ERROR' | 'BAD_REQUEST' | 'NETWORK' | 'UNKNOWN';

interface ErrorClassification {
  type: ErrorType;
  statusCode?: number;
  shouldRetry: boolean;
  shouldFallback: boolean;
}

/**
 * Classify error to determine fallback behavior
 *
 * Policy:
 * - 429 / 503 / timeout → fallback immediately (or retry once then fallback)
 * - 401 / 403 → fallback immediately (bad key)
 * - 400 → usually payload issue, might not benefit from fallback
 * - 5xx → server error, fallback to different provider
 */
function classifyError(error: any): ErrorClassification {
  const message = error?.message?.toLowerCase() || '';
  const statusCode = error?.status || error?.statusCode || extractStatusCode(message);

  // Rate limiting
  if (statusCode === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return { type: 'RATE_LIMIT', statusCode: 429, shouldRetry: true, shouldFallback: true };
  }

  // Auth errors - fallback immediately
  if (statusCode === 401 || statusCode === 403 || message.includes('unauthorized') || message.includes('invalid key') || message.includes('api key')) {
    return { type: 'AUTH_ERROR', statusCode: statusCode || 401, shouldRetry: false, shouldFallback: true };
  }

  // Timeout
  if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) {
    return { type: 'TIMEOUT', statusCode: 408, shouldRetry: true, shouldFallback: true };
  }

  // Server errors - fallback to different provider
  if (statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return { type: 'SERVER_ERROR', statusCode, shouldRetry: statusCode === 503, shouldFallback: true };
  }

  // Bad request - might be provider-specific format issue
  if (statusCode === 400) {
    return { type: 'BAD_REQUEST', statusCode: 400, shouldRetry: false, shouldFallback: true };
  }

  // Network errors
  if (message.includes('econnrefused') || message.includes('network') || message.includes('fetch failed')) {
    return { type: 'NETWORK', shouldRetry: true, shouldFallback: true };
  }

  // Forced failures (for testing)
  if (message.includes('forced_fail')) {
    return { type: 'UNKNOWN', shouldRetry: false, shouldFallback: true };
  }

  return { type: 'UNKNOWN', statusCode, shouldRetry: false, shouldFallback: true };
}

/**
 * Extract status code from error message
 */
function extractStatusCode(message: string): number | undefined {
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

function log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown>) {
  const entry: AgentLog = {
    timestamp: new Date().toISOString(),
    level,
    event,
    data,
  };
  logs.push(entry);

  // Console output with formatting
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📍';
  console.log(`${prefix} [AgentRouter.${event}]`, JSON.stringify(data, null, 2));
}

/**
 * Agent Router - Main router class
 */
export class AgentRouter {
  /**
   * Route a request to the appropriate model
   */
  static async route(request: AgentRoutingRequest): Promise<AgentRoutingResult> {
    const startTime = Date.now();
    let fallbacksUsed = 0;
    const fallbackChain: FallbackAttempt[] = [];

    // Step 1: Resolve intent if role not provided
    let role: AgentRole = request.role || 'chat_light';
    let intent: IntentResult | undefined;

    if (!request.role) {
      intent = resolveWithContext(request.message, {
        previousRole: request.previousRole,
        userTier: request.userTier,
      });
      role = intent.role;

      log('info', 'intent_resolved', {
        role,
        confidence: intent.confidence,
        reason: intent.reason,
        messagePreview: request.message.substring(0, 100),
      });
    }

    // Step 2: Get model config for role
    const config = AGENT_MODEL_MAP[role];

    // Step 3: Handle forced model
    if (request.forceModel) {
      log('info', 'model_forced', {
        role,
        forcedModel: request.forceModel,
      });

      try {
        const response = await this.callModel(
          request.forceModel,
          this.getProviderForModel(request.forceModel),
          request.options,
          role
        );

        return {
          success: true,
          response,
          role,
          intent,
          modelUsed: request.forceModel,
          providerUsed: this.getProviderForModel(request.forceModel),
          fallbacksUsed: 0,
          latencyMs: Date.now() - startTime,
        };
      } catch (error: any) {
        return {
          success: false,
          role,
          intent,
          modelUsed: request.forceModel,
          providerUsed: this.getProviderForModel(request.forceModel),
          fallbacksUsed: 0,
          latencyMs: Date.now() - startTime,
          error: error.message,
        };
      }
    }

    // Step 4: Try primary model
    const { provider: primaryProvider, model: primaryModel } = parseModelIdentifier(config.primary);

    log('info', 'routing', {
      role,
      roleDescription: getRoleDescription(role),
      primaryModel: config.primary,
      fallbackCount: config.fallback.length,
      maxLatencyMs: config.maxLatencyMs,
      maxCostUSD: config.maxCostUSD,
    });

    try {
      const response = await this.callModel(primaryModel, primaryProvider, request.options, role);

      log('info', 'success', {
        role,
        model: primaryModel,
        provider: primaryProvider,
        latencyMs: Date.now() - startTime,
        fallbacksUsed: 0,
      });

      const totalLatency = Date.now() - startTime;
      return {
        success: true,
        response,
        role,
        intent,
        modelUsed: primaryModel,
        providerUsed: primaryProvider,
        fallbacksUsed: 0,
        latencyMs: totalLatency,
        trace: {
          primaryModel,
          primaryProvider,
          fallbackChain: [],
          finalModelUsed: primaryModel,
          finalProvider: primaryProvider,
          attemptCount: 1,
          totalLatencyMs: totalLatency,
        },
      };
    } catch (primaryError: any) {
      const primaryErrorInfo = classifyError(primaryError);
      log('warn', 'primary_failed', {
        role,
        model: primaryModel,
        error: primaryError.message,
        errorType: primaryErrorInfo.type,
        statusCode: primaryErrorInfo.statusCode,
        shouldRetry: primaryErrorInfo.shouldRetry,
      });

      // Record primary failure in trace
      fallbackChain.push({
        model: primaryModel,
        provider: primaryProvider,
        errorType: primaryErrorInfo.type,
        errorMessage: primaryError.message,
      });

      // Step 5: Try fallbacks
      let lastFailedModel = primaryModel;
      let lastError = primaryError;
      let lastErrorType = primaryErrorInfo.type;

      for (const fallbackId of config.fallback) {
        fallbacksUsed++;
        const { provider: fallbackProvider, model: fallbackModel } = parseModelIdentifier(fallbackId);

        log('info', 'trying_fallback', {
          role,
          fallbackNumber: fallbacksUsed,
          from: lastFailedModel,
          to: fallbackModel,
          reason: lastError.message,
        });

        try {
          const response = await this.callModel(fallbackModel, fallbackProvider, request.options, role);

          const totalLatency = Date.now() - startTime;
          log('info', 'fallback_success', {
            role,
            model: fallbackModel,
            provider: fallbackProvider,
            latencyMs: totalLatency,
            fallbacksUsed,
          });

          return {
            success: true,
            response,
            role,
            intent,
            modelUsed: fallbackModel,
            providerUsed: fallbackProvider,
            fallbacksUsed,
            latencyMs: totalLatency,
            trace: {
              primaryModel,
              primaryProvider,
              fallbackChain,
              finalModelUsed: fallbackModel,
              finalProvider: fallbackProvider,
              errorType: lastErrorType,
              attemptCount: fallbacksUsed + 1,
              totalLatencyMs: totalLatency,
            },
          };
        } catch (fallbackError: any) {
          const fallbackErrorInfo = classifyError(fallbackError);
          log('warn', 'fallback_failed', {
            role,
            model: fallbackModel,
            fallbackNumber: fallbacksUsed,
            error: fallbackError.message,
            errorType: fallbackErrorInfo.type,
            statusCode: fallbackErrorInfo.statusCode,
          });

          // Record fallback failure in trace
          fallbackChain.push({
            model: fallbackModel,
            provider: fallbackProvider,
            errorType: fallbackErrorInfo.type,
            errorMessage: fallbackError.message,
          });

          // Update for next iteration
          lastFailedModel = fallbackModel;
          lastError = fallbackError;
          lastErrorType = fallbackErrorInfo.type;
        }
      }

      // Step 6: All failed - use safe fallback
      log('error', 'all_failed', {
        role,
        primaryModel,
        fallbacksTried: config.fallback.length,
        finalError: lastError.message,
        fallbackChain: fallbackChain.map(f => `${f.model}:${f.errorType}`),
      });

      // Try the safe fallback
      const safeConfig = AGENT_MODEL_MAP.fallback_safe;
      const { provider: safeProvider, model: safeModel } = parseModelIdentifier(safeConfig.primary);

      try {
        const response = await this.callModel(safeModel, safeProvider, request.options, 'fallback_safe');
        const totalLatency = Date.now() - startTime;

        return {
          success: true,
          response,
          role: 'fallback_safe',
          intent,
          modelUsed: safeModel,
          providerUsed: safeProvider,
          fallbacksUsed: fallbacksUsed + 1,
          latencyMs: totalLatency,
          trace: {
            primaryModel,
            primaryProvider,
            fallbackChain,
            finalModelUsed: safeModel,
            finalProvider: safeProvider,
            errorType: lastErrorType,
            attemptCount: fallbacksUsed + 2,
            totalLatencyMs: totalLatency,
          },
        };
      } catch (safeError: any) {
        const safeErrorInfo = classifyError(safeError);
        fallbackChain.push({
          model: safeModel,
          provider: safeProvider,
          errorType: safeErrorInfo.type,
          errorMessage: safeError.message,
        });

        const totalLatency = Date.now() - startTime;
        return {
          success: false,
          role,
          intent,
          modelUsed: primaryModel,
          providerUsed: primaryProvider,
          fallbacksUsed,
          latencyMs: totalLatency,
          error: `All models failed. Last error: ${safeError.message}`,
          trace: {
            primaryModel,
            primaryProvider,
            fallbackChain,
            finalModelUsed: safeModel,
            finalProvider: safeProvider,
            errorType: safeErrorInfo.type,
            attemptCount: fallbacksUsed + 2,
            totalLatencyMs: totalLatency,
          },
        };
      }
    }
  }

  /**
   * Call a specific model
   */
  private static async callModel(
    model: LLMModelId,
    provider: LLMProvider,
    options: Omit<LLMChatOptions, 'model'>,
    role: AgentRole
  ): Promise<LLMChatResponse> {
    const client = LLMClientFactory.getByProvider(provider);

    // Apply role-specific temperature if not set
    const temperature = options.temperature ?? getRoleTemperature(role);

    const startTime = Date.now();
    const response = await client.chat({
      ...options,
      model,
      temperature,
    });

    const latencyMs = Date.now() - startTime;

    // Record benchmark
    BenchmarkEngine.recordRun({
      modelId: model,
      taskType: this.roleToTaskType(role) as any,
      timestamp: Date.now(),
      metrics: {
        modelId: model,
        latencyMs,
        inputTokens: response.usage?.inputTokens || 0,
        outputTokens: response.usage?.outputTokens || 0,
        success: true,
      },
    });

    return response;
  }

  /**
   * Get provider for a model ID
   */
  private static getProviderForModel(modelId: LLMModelId): LLMProvider {
    if (modelId.startsWith('gpt') || modelId.startsWith('o1')) return 'openai';
    if (modelId.startsWith('claude')) return 'anthropic';
    if (modelId.startsWith('mistral')) return 'mistral';
    if (modelId.startsWith('devstral') || modelId.startsWith('codestral')) return 'devstral';
    if (modelId.startsWith('gemini')) return 'gemini';
    return 'openai'; // Default
  }

  /**
   * Map role to task type for benchmarking
   */
  private static roleToTaskType(role: AgentRole): string {
    const mapping: Record<AgentRole, string> = {
      chat_light: 'CHAT',
      planning: 'PLANNING',
      ux_ideation: 'PLANNING',
      code_generation: 'CODE_GENERATION',
      code_review: 'CODE_REVIEW',
      complex_analysis: 'PLANNING',
      fast_background: 'AGENT_ROUTING',
      fallback_safe: 'CHAT',
    };
    return mapping[role];
  }

  /**
   * Get recent logs
   */
  static getLogs(limit: number = 100): AgentLog[] {
    return logs.slice(-limit);
  }

  /**
   * Clear logs
   */
  static clearLogs(): void {
    logs.length = 0;
  }

  /**
   * Get routing stats
   */
  static getStats(): {
    totalRequests: number;
    byRole: Record<AgentRole, number>;
    fallbackRate: number;
    avgLatencyMs: number;
  } {
    const routingLogs = logs.filter(l => l.event === 'success' || l.event === 'fallback_success');

    const byRole: Record<AgentRole, number> = {
      chat_light: 0,
      planning: 0,
      ux_ideation: 0,
      code_generation: 0,
      code_review: 0,
      complex_analysis: 0,
      fast_background: 0,
      fallback_safe: 0,
    };

    let totalFallbacks = 0;
    let totalLatency = 0;

    for (const log of routingLogs) {
      const role = log.data.role as AgentRole;
      if (role) byRole[role]++;
      if (log.data.fallbacksUsed && (log.data.fallbacksUsed as number) > 0) {
        totalFallbacks++;
      }
      if (log.data.latencyMs) {
        totalLatency += log.data.latencyMs as number;
      }
    }

    return {
      totalRequests: routingLogs.length,
      byRole,
      fallbackRate: routingLogs.length > 0 ? totalFallbacks / routingLogs.length : 0,
      avgLatencyMs: routingLogs.length > 0 ? totalLatency / routingLogs.length : 0,
    };
  }
}

/**
 * Quick route function
 */
export async function routeAgent(
  message: string,
  options: Omit<LLMChatOptions, 'model'>,
  userId: string
): Promise<AgentRoutingResult> {
  return AgentRouter.route({
    message,
    options,
    userId,
  });
}

/**
 * Route with specific role (skip intent resolution)
 */
export async function routeWithRole(
  role: AgentRole,
  options: Omit<LLMChatOptions, 'model'>,
  userId: string
): Promise<AgentRoutingResult> {
  return AgentRouter.route({
    message: '',
    role,
    options,
    userId,
  });
}

export default AgentRouter;
