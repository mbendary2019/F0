// src/lib/ai/telemetry/snippetMetrics.ts
// Phase 57.2: Telemetry for snippet cache performance
// Track cache hits/misses, cost savings, and latency

import { db } from "../memory/firestoreSchema";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// === Constants ===

const COL_METRICS = "ops_metrics_snippets_daily" as const;

// === Types ===

export type SnippetMetricsDoc = {
  day: string; // YYYY-MM-DD
  embed_requests: number; // Total embedding requests
  cache_hits: number; // Cache hits
  cache_misses: number; // Cache misses
  tokens_saved_est: number; // Estimated tokens saved by caching
  cost_saved_est: number; // Estimated cost saved ($)
  avg_latency_ms: number; // Average latency
  total_latency_ms: number; // Total latency (for averaging)
  request_count: number; // Number of requests (for averaging)
  created_at: FieldValue | Timestamp;
  last_updated: FieldValue | Timestamp;
};

export type MetricUpdate = {
  hits?: number;
  misses?: number;
  tokensSaved?: number;
  costSaved?: number;
  latencyMs?: number;
};

// === Main Functions ===

/**
 * Increment snippet cache metrics for a day
 * Uses Firestore transaction for atomic updates
 *
 * @param day - Day key (YYYY-MM-DD)
 * @param update - Metric updates
 *
 * @example
 * ```typescript
 * // Record cache hit
 * await bumpSnippetMetric(dayKey(), {
 *   hits: 5,
 *   tokensSaved: 250,
 *   costSaved: 0.0000325
 * });
 *
 * // Record cache miss
 * await bumpSnippetMetric(dayKey(), {
 *   misses: 2,
 *   latencyMs: 450
 * });
 * ```
 */
export async function bumpSnippetMetric(
  day: string,
  update: MetricUpdate
): Promise<void> {
  const {
    hits = 0,
    misses = 0,
    tokensSaved = 0,
    costSaved = 0,
    latencyMs = 0,
  } = update;

  const ref = db.collection(COL_METRICS).doc(day);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        // Create new document
        const doc: SnippetMetricsDoc = {
          day,
          embed_requests: hits + misses,
          cache_hits: hits,
          cache_misses: misses,
          tokens_saved_est: tokensSaved,
          cost_saved_est: costSaved,
          avg_latency_ms: latencyMs,
          total_latency_ms: latencyMs,
          request_count: latencyMs > 0 ? 1 : 0,
          created_at: FieldValue.serverTimestamp(),
          last_updated: FieldValue.serverTimestamp(),
        };

        tx.set(ref, doc, { merge: false });
      } else {
        // Update existing document
        const prev = snap.data() as SnippetMetricsDoc;

        const newRequestCount =
          prev.request_count + (latencyMs > 0 ? 1 : 0);
        const newTotalLatency = prev.total_latency_ms + latencyMs;
        const newAvgLatency =
          newRequestCount > 0 ? newTotalLatency / newRequestCount : 0;

        tx.update(ref, {
          embed_requests: prev.embed_requests + hits + misses,
          cache_hits: prev.cache_hits + hits,
          cache_misses: prev.cache_misses + misses,
          tokens_saved_est: prev.tokens_saved_est + tokensSaved,
          cost_saved_est: prev.cost_saved_est + costSaved,
          avg_latency_ms: newAvgLatency,
          total_latency_ms: newTotalLatency,
          request_count: newRequestCount,
          last_updated: FieldValue.serverTimestamp(),
        });
      }
    });
  } catch (error) {
    console.error(`[snippetMetrics] Failed to update metrics for ${day}:`, error);
    // Don't throw - metrics should not break main flow
  }
}

/**
 * Batch update metrics from cache result
 *
 * @param day - Day key
 * @param stats - Cache statistics
 * @param latencyMs - Optional latency measurement
 */
export async function recordCacheStats(
  day: string,
  stats: {
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  },
  latencyMs?: number
): Promise<void> {
  // Estimate tokens and cost saved
  const avgTokensPerSnippet = 50; // Conservative estimate
  const tokensSaved = stats.cacheHits * avgTokensPerSnippet;

  // OpenAI text-embedding-3-large: $0.13 per 1M tokens
  const costPerToken = 0.13 / 1_000_000;
  const costSaved = tokensSaved * costPerToken;

  await bumpSnippetMetric(day, {
    hits: stats.cacheHits,
    misses: stats.cacheMisses,
    tokensSaved,
    costSaved,
    latencyMs,
  });
}

/**
 * Get metrics for a specific day
 */
export async function getMetricsForDay(
  day: string
): Promise<SnippetMetricsDoc | null> {
  const snap = await db.collection(COL_METRICS).doc(day).get();

  if (!snap.exists) return null;

  return snap.data() as SnippetMetricsDoc;
}

/**
 * Get metrics for a date range
 */
export async function getMetricsRange(
  startDay: string,
  endDay: string
): Promise<SnippetMetricsDoc[]> {
  const query = db
    .collection(COL_METRICS)
    .where("day", ">=", startDay)
    .where("day", "<=", endDay)
    .orderBy("day", "asc");

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as SnippetMetricsDoc);
}

/**
 * Get aggregated metrics summary
 */
export async function getMetricsSummary(
  days: number = 30
): Promise<{
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  avgHitRate: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  avgLatencyMs: number;
  dailyMetrics: SnippetMetricsDoc[];
}> {
  const endDay = dayKey();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDay = dayKey(startDate);

  const metrics = await getMetricsRange(startDay, endDay);

  if (!metrics.length) {
    return {
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      avgHitRate: 0,
      totalTokensSaved: 0,
      totalCostSaved: 0,
      avgLatencyMs: 0,
      dailyMetrics: [],
    };
  }

  const totalRequests = metrics.reduce((sum, m) => sum + m.embed_requests, 0);
  const totalHits = metrics.reduce((sum, m) => sum + m.cache_hits, 0);
  const totalMisses = metrics.reduce((sum, m) => sum + m.cache_misses, 0);
  const totalTokensSaved = metrics.reduce(
    (sum, m) => sum + m.tokens_saved_est,
    0
  );
  const totalCostSaved = metrics.reduce((sum, m) => sum + m.cost_saved_est, 0);

  const avgHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

  const avgLatencyMs =
    metrics.reduce((sum, m) => sum + m.avg_latency_ms, 0) / metrics.length;

  return {
    totalRequests,
    totalHits,
    totalMisses,
    avgHitRate,
    totalTokensSaved,
    totalCostSaved,
    avgLatencyMs,
    dailyMetrics: metrics,
  };
}

/**
 * Get day key for metrics (YYYY-MM-DD)
 */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Export metrics as CSV
 */
export function exportMetricsCSV(metrics: SnippetMetricsDoc[]): string {
  const headers = [
    "day",
    "embed_requests",
    "cache_hits",
    "cache_misses",
    "hit_rate",
    "tokens_saved",
    "cost_saved",
    "avg_latency_ms",
  ];

  const rows = metrics.map((m) => {
    const hitRate =
      m.embed_requests > 0 ? m.cache_hits / m.embed_requests : 0;

    return [
      m.day,
      m.embed_requests,
      m.cache_hits,
      m.cache_misses,
      hitRate.toFixed(4),
      m.tokens_saved_est,
      m.cost_saved_est.toFixed(6),
      m.avg_latency_ms.toFixed(2),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Get cache performance insights
 */
export async function getCacheInsights(
  days: number = 7
): Promise<{
  performance: "excellent" | "good" | "fair" | "poor";
  hitRate: number;
  recommendations: string[];
  estimatedSavings: {
    tokens: number;
    cost: number;
    percentage: number;
  };
}> {
  const summary = await getMetricsSummary(days);

  const hitRate = summary.avgHitRate;

  let performance: "excellent" | "good" | "fair" | "poor";
  if (hitRate >= 0.8) performance = "excellent";
  else if (hitRate >= 0.6) performance = "good";
  else if (hitRate >= 0.4) performance = "fair";
  else performance = "poor";

  const recommendations: string[] = [];

  if (hitRate < 0.5) {
    recommendations.push(
      "Low cache hit rate. Consider increasing cache TTL or pre-warming cache."
    );
  }

  if (summary.avgLatencyMs > 500) {
    recommendations.push(
      "High average latency. Consider using faster embedding model or parallel requests."
    );
  }

  if (summary.totalRequests < 100) {
    recommendations.push(
      "Low usage volume. Cache benefits may not be significant yet."
    );
  }

  // Calculate savings percentage
  const totalTokensWithoutCache =
    summary.totalTokensSaved / (hitRate > 0 ? hitRate : 0.01);
  const savingsPercentage =
    totalTokensWithoutCache > 0
      ? (summary.totalTokensSaved / totalTokensWithoutCache) * 100
      : 0;

  return {
    performance,
    hitRate,
    recommendations,
    estimatedSavings: {
      tokens: summary.totalTokensSaved,
      cost: summary.totalCostSaved,
      percentage: savingsPercentage,
    },
  };
}

/**
 * Record latency measurement
 */
export async function recordLatency(
  day: string,
  latencyMs: number
): Promise<void> {
  await bumpSnippetMetric(day, { latencyMs });
}

/**
 * Clean up old metrics (retention policy)
 */
export async function cleanupOldMetrics(
  retentionDays: number = 90
): Promise<{ deleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffDay = dayKey(cutoffDate);

  const query = db
    .collection(COL_METRICS)
    .where("day", "<", cutoffDay)
    .limit(100);

  const snap = await query.get();

  if (snap.empty) {
    return { deleted: 0 };
  }

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  console.log(`[snippetMetrics] Cleaned up ${snap.size} old metric documents`);

  return { deleted: snap.size };
}
