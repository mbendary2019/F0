// src/lib/rag/metrics.ts
// Phase 58: Metrics tracking for RAG queries

import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { Strategy } from './types';

const METRICS_COLLECTION = 'ops_rag_queries';

/**
 * Recall metrics entry for tracking
 */
export interface RecallMetrics {
  workspaceId: string;
  strategy: Strategy;
  tookMs: number;
  cacheHit: boolean;
  topK: number;
  itemsRetrieved: number;
  queryLength?: number;
  timestamp: Date;
}

/**
 * Record metrics for a recall operation
 * Logs performance data for monitoring and optimization
 *
 * @param entry - Metrics entry
 */
export async function recordRecallMetrics(entry: RecallMetrics): Promise<void> {
  const db = getFirestore();

  try {
    await addDoc(collection(db, METRICS_COLLECTION), {
      ...entry,
      timestamp: Timestamp.fromDate(entry.timestamp),
    });
  } catch (error) {
    // Don't fail the request if metrics logging fails
    console.error('[RAG Metrics] Failed to record:', error);
  }
}

/**
 * Performance summary for analysis
 */
export interface PerformanceSummary {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

/**
 * Calculate performance percentiles from latency data
 *
 * @param latencies - Array of latency values in milliseconds
 * @returns Performance summary with percentiles
 */
export function calculatePerformanceSummary(latencies: number[]): PerformanceSummary {
  if (latencies.length === 0) {
    return { p50: 0, p95: 0, p99: 0, mean: 0, min: 0, max: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const len = sorted.length;

  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    mean: sorted.reduce((sum, val) => sum + val, 0) / len,
    min: sorted[0],
    max: sorted[len - 1],
  };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Strategy performance comparison
 */
export interface StrategyPerformance {
  strategy: Strategy;
  avgLatency: number;
  cacheHitRate: number;
  totalQueries: number;
}

/**
 * Calculate per-strategy performance metrics
 * Useful for comparing dense vs sparse vs hybrid
 */
export function calculateStrategyPerformance(
  metrics: RecallMetrics[]
): StrategyPerformance[] {
  const byStrategy = new Map<
    Strategy,
    { latencies: number[]; cacheHits: number; total: number }
  >();

  // Group by strategy
  for (const metric of metrics) {
    if (!byStrategy.has(metric.strategy)) {
      byStrategy.set(metric.strategy, { latencies: [], cacheHits: 0, total: 0 });
    }

    const stats = byStrategy.get(metric.strategy)!;
    stats.latencies.push(metric.tookMs);
    stats.total++;
    if (metric.cacheHit) stats.cacheHits++;
  }

  // Calculate averages
  const results: StrategyPerformance[] = [];
  for (const [strategy, stats] of byStrategy) {
    results.push({
      strategy,
      avgLatency: stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length,
      cacheHitRate: stats.cacheHits / stats.total,
      totalQueries: stats.total,
    });
  }

  return results;
}

/**
 * Log performance warning if latency exceeds threshold
 */
export function checkPerformanceThreshold(
  tookMs: number,
  threshold = 400
): void {
  if (tookMs > threshold) {
    console.warn(
      `[RAG Performance] Query latency (${tookMs}ms) exceeded threshold (${threshold}ms)`
    );
  }
}
