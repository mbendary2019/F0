// orchestrator/core/llm/benchmarks.ts
// Phase 170.4: Benchmarking & Scoring System - Measure model performance

import type {
  LLMTaskType,
  LLMModelId,
  LLMRunMetricsSimple,
  LLMProvider,
} from './types';
import { getModelConfig, estimateCost } from './modelRegistry';

/**
 * Benchmark result for a single run
 */
export interface BenchmarkRun {
  id: string;
  modelId: LLMModelId;
  taskType: LLMTaskType;
  timestamp: number;
  metrics: LLMRunMetricsSimple;
  /** Quality score 0-100 (if evaluated) */
  qualityScore?: number;
  /** Response relevance score 0-100 */
  relevanceScore?: number;
  /** Code correctness (for code tasks) */
  codeCorrectness?: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Aggregated benchmark statistics for a model
 */
export interface ModelBenchmarkStats {
  modelId: LLMModelId;
  provider: LLMProvider;
  taskType: LLMTaskType;
  /** Number of runs */
  runCount: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** P95 latency in ms */
  p95LatencyMs: number;
  /** Average quality score */
  avgQualityScore: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average cost per request */
  avgCostUSD: number;
  /** Total tokens used */
  totalTokens: number;
  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * In-memory storage for benchmark runs (replace with Firestore in production)
 */
const benchmarkRuns: BenchmarkRun[] = [];
const MAX_STORED_RUNS = 1000;

/**
 * Benchmark Engine
 * Collects and analyzes LLM performance metrics
 */
export class BenchmarkEngine {
  /**
   * Record a benchmark run
   */
  static recordRun(run: Omit<BenchmarkRun, 'id'>): BenchmarkRun {
    const fullRun: BenchmarkRun = {
      ...run,
      id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };

    benchmarkRuns.push(fullRun);

    // Keep only last N runs in memory
    if (benchmarkRuns.length > MAX_STORED_RUNS) {
      benchmarkRuns.shift();
    }

    console.log('[BenchmarkEngine] Recorded run:', {
      model: fullRun.modelId,
      taskType: fullRun.taskType,
      latencyMs: fullRun.metrics.latencyMs,
      success: fullRun.metrics.success,
    });

    return fullRun;
  }

  /**
   * Create run from metrics
   */
  static createRunFromMetrics(
    metrics: LLMRunMetricsSimple,
    taskType: LLMTaskType,
    options?: {
      qualityScore?: number;
      relevanceScore?: number;
      codeCorrectness?: boolean;
      error?: string;
    }
  ): BenchmarkRun {
    return this.recordRun({
      modelId: metrics.modelId,
      taskType,
      timestamp: Date.now(),
      metrics,
      qualityScore: options?.qualityScore,
      relevanceScore: options?.relevanceScore,
      codeCorrectness: options?.codeCorrectness,
      error: options?.error,
    });
  }

  /**
   * Get statistics for a model + task type combination
   */
  static getStats(
    modelId: LLMModelId,
    taskType: LLMTaskType
  ): ModelBenchmarkStats | null {
    const runs = benchmarkRuns.filter(
      r => r.modelId === modelId && r.taskType === taskType
    );

    if (runs.length === 0) return null;

    const config = getModelConfig(modelId);
    if (!config) return null;

    // Calculate aggregates
    const latencies = runs.map(r => r.metrics.latencyMs);
    const qualityScores = runs
      .filter(r => r.qualityScore !== undefined)
      .map(r => r.qualityScore!);
    const successfulRuns = runs.filter(r => r.metrics.success);
    const totalCost = runs.reduce(
      (sum, r) => sum + (r.metrics.estimatedCostUSD || 0),
      0
    );
    const totalTokens = runs.reduce(
      (sum, r) => sum + r.metrics.inputTokens + r.metrics.outputTokens,
      0
    );

    // Sort latencies for P95
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);

    return {
      modelId,
      provider: config.provider,
      taskType,
      runCount: runs.length,
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95LatencyMs: sortedLatencies[p95Index] || sortedLatencies[sortedLatencies.length - 1],
      avgQualityScore:
        qualityScores.length > 0
          ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
          : 0,
      successRate: successfulRuns.length / runs.length,
      avgCostUSD: totalCost / runs.length,
      totalTokens,
      lastUpdated: Math.max(...runs.map(r => r.timestamp)),
    };
  }

  /**
   * Get all stats for a task type (compare models)
   */
  static getTaskStats(taskType: LLMTaskType): ModelBenchmarkStats[] {
    const modelIds = [...new Set(benchmarkRuns.map(r => r.modelId))];

    return modelIds
      .map(modelId => this.getStats(modelId, taskType))
      .filter((stats): stats is ModelBenchmarkStats => stats !== null)
      .sort((a, b) => {
        // Sort by quality score, then by latency
        if (b.avgQualityScore !== a.avgQualityScore) {
          return b.avgQualityScore - a.avgQualityScore;
        }
        return a.avgLatencyMs - b.avgLatencyMs;
      });
  }

  /**
   * Get best model for a task based on benchmarks
   */
  static getBestModelForTask(
    taskType: LLMTaskType,
    prioritize: 'quality' | 'speed' | 'cost' = 'quality'
  ): LLMModelId | null {
    const stats = this.getTaskStats(taskType);

    if (stats.length === 0) return null;

    // Filter to models with good success rate
    const reliable = stats.filter(s => s.successRate > 0.9);
    const candidates = reliable.length > 0 ? reliable : stats;

    switch (prioritize) {
      case 'quality':
        return candidates.sort((a, b) => b.avgQualityScore - a.avgQualityScore)[0]?.modelId || null;
      case 'speed':
        return candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0]?.modelId || null;
      case 'cost':
        return candidates.sort((a, b) => a.avgCostUSD - b.avgCostUSD)[0]?.modelId || null;
      default:
        return candidates[0]?.modelId || null;
    }
  }

  /**
   * Get recent runs for debugging
   */
  static getRecentRuns(limit: number = 20): BenchmarkRun[] {
    return benchmarkRuns.slice(-limit);
  }

  /**
   * Get summary dashboard data
   */
  static getDashboardSummary(): {
    totalRuns: number;
    successRate: number;
    avgLatencyMs: number;
    totalCostUSD: number;
    modelBreakdown: Record<string, number>;
    taskBreakdown: Record<string, number>;
  } {
    const successfulRuns = benchmarkRuns.filter(r => r.metrics.success);
    const totalCost = benchmarkRuns.reduce(
      (sum, r) => sum + (r.metrics.estimatedCostUSD || 0),
      0
    );
    const avgLatency =
      benchmarkRuns.length > 0
        ? benchmarkRuns.reduce((sum, r) => sum + r.metrics.latencyMs, 0) / benchmarkRuns.length
        : 0;

    // Count by model
    const modelBreakdown: Record<string, number> = {};
    benchmarkRuns.forEach(r => {
      modelBreakdown[r.modelId] = (modelBreakdown[r.modelId] || 0) + 1;
    });

    // Count by task type
    const taskBreakdown: Record<string, number> = {};
    benchmarkRuns.forEach(r => {
      taskBreakdown[r.taskType] = (taskBreakdown[r.taskType] || 0) + 1;
    });

    return {
      totalRuns: benchmarkRuns.length,
      successRate: benchmarkRuns.length > 0 ? successfulRuns.length / benchmarkRuns.length : 0,
      avgLatencyMs: avgLatency,
      totalCostUSD: totalCost,
      modelBreakdown,
      taskBreakdown,
    };
  }

  /**
   * Clear all benchmark data (for testing)
   */
  static clearAll(): void {
    benchmarkRuns.length = 0;
  }

  /**
   * Evaluate code quality (simple heuristics)
   */
  static evaluateCodeQuality(code: string): number {
    let score = 70; // Base score

    // Check for common issues
    if (code.includes('TODO') || code.includes('FIXME')) score -= 5;
    if (code.includes('console.log')) score -= 3;
    if (code.includes('any')) score -= 5; // TypeScript any
    if (code.includes('// @ts-ignore')) score -= 10;

    // Positive signals
    if (code.includes('export ')) score += 5;
    if (code.includes('interface ') || code.includes('type ')) score += 5;
    if (code.includes('try {') && code.includes('catch')) score += 5;
    if (code.includes('async ')) score += 3;

    // Length checks
    const lines = code.split('\n').length;
    if (lines > 500) score -= 10; // Too long
    if (lines < 5) score -= 20; // Too short

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compare two models head-to-head
   */
  static compareModels(
    modelA: LLMModelId,
    modelB: LLMModelId,
    taskType: LLMTaskType
  ): {
    winner: LLMModelId | 'tie';
    comparison: {
      metric: string;
      modelA: number;
      modelB: number;
      winner: 'A' | 'B' | 'tie';
    }[];
  } {
    const statsA = this.getStats(modelA, taskType);
    const statsB = this.getStats(modelB, taskType);

    if (!statsA || !statsB) {
      return {
        winner: 'tie',
        comparison: [],
      };
    }

    const comparison: {
      metric: string;
      modelA: number;
      modelB: number;
      winner: 'A' | 'B' | 'tie';
    }[] = [
      {
        metric: 'Quality Score',
        modelA: statsA.avgQualityScore,
        modelB: statsB.avgQualityScore,
        winner:
          statsA.avgQualityScore > statsB.avgQualityScore
            ? 'A'
            : statsA.avgQualityScore < statsB.avgQualityScore
            ? 'B'
            : 'tie',
      },
      {
        metric: 'Latency (ms)',
        modelA: statsA.avgLatencyMs,
        modelB: statsB.avgLatencyMs,
        winner:
          statsA.avgLatencyMs < statsB.avgLatencyMs
            ? 'A'
            : statsA.avgLatencyMs > statsB.avgLatencyMs
            ? 'B'
            : 'tie',
      },
      {
        metric: 'Cost (USD)',
        modelA: statsA.avgCostUSD,
        modelB: statsB.avgCostUSD,
        winner:
          statsA.avgCostUSD < statsB.avgCostUSD
            ? 'A'
            : statsA.avgCostUSD > statsB.avgCostUSD
            ? 'B'
            : 'tie',
      },
      {
        metric: 'Success Rate',
        modelA: statsA.successRate,
        modelB: statsB.successRate,
        winner:
          statsA.successRate > statsB.successRate
            ? 'A'
            : statsA.successRate < statsB.successRate
            ? 'B'
            : 'tie',
      },
    ];

    // Count wins
    const winsA = comparison.filter(c => c.winner === 'A').length;
    const winsB = comparison.filter(c => c.winner === 'B').length;

    return {
      winner: winsA > winsB ? modelA : winsA < winsB ? modelB : 'tie',
      comparison,
    };
  }
}

export default BenchmarkEngine;
