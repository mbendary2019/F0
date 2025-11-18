// src/components/ops/SnippetCacheAnalytics.tsx
// Phase 57.3: Snippet cache performance analytics cards

'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebaseClient';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';

// === Types ===

type SnippetMetricsDay = {
  day: string;
  embed_requests: number;
  cache_hits: number;
  cache_misses: number;
  tokens_saved_est: number;
  cost_saved_est: number;
  avg_latency_ms: number;
  unique_snippets: number;
  updated_at: Date;
};

type CacheStats = {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  tokensSaved: number;
  costSaved: number;
  avgLatencyMs: number;
  performance: 'excellent' | 'good' | 'fair' | 'poor';
};

// === Component ===

export default function SnippetCacheAnalytics({ days = 7 }: { days?: number }) {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCacheStats();
  }, [days]);

  async function loadCacheStats() {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const startDay = formatDay(startDate);
      const endDay = formatDay(endDate);

      console.log(`[SnippetCacheAnalytics] Loading metrics from ${startDay} to ${endDay}`);

      // Query metrics from Firestore
      const metricsRef = collection(db, 'ops_metrics_snippets_daily');
      const q = query(
        metricsRef,
        where('day', '>=', startDay),
        where('day', '<=', endDay),
        orderBy('day', 'desc'),
        limit(days)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.warn('[SnippetCacheAnalytics] No metrics found');
        setStats({
          totalRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
          tokensSaved: 0,
          costSaved: 0,
          avgLatencyMs: 0,
          performance: 'poor',
        });
        setLoading(false);
        return;
      }

      // Aggregate metrics
      let totalRequests = 0;
      let totalHits = 0;
      let totalMisses = 0;
      let totalTokensSaved = 0;
      let totalCostSaved = 0;
      let totalLatencyMs = 0;
      let count = 0;

      snapshot.forEach((doc) => {
        const data = doc.data() as SnippetMetricsDay;
        totalRequests += data.embed_requests || 0;
        totalHits += data.cache_hits || 0;
        totalMisses += data.cache_misses || 0;
        totalTokensSaved += data.tokens_saved_est || 0;
        totalCostSaved += data.cost_saved_est || 0;
        totalLatencyMs += data.avg_latency_ms || 0;
        count++;
      });

      const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
      const avgLatencyMs = count > 0 ? totalLatencyMs / count : 0;

      // Determine performance
      let performance: 'excellent' | 'good' | 'fair' | 'poor';
      if (hitRate >= 0.8) {
        performance = 'excellent';
      } else if (hitRate >= 0.6) {
        performance = 'good';
      } else if (hitRate >= 0.4) {
        performance = 'fair';
      } else {
        performance = 'poor';
      }

      setStats({
        totalRequests,
        cacheHits: totalHits,
        cacheMisses: totalMisses,
        hitRate,
        tokensSaved: totalTokensSaved,
        costSaved: totalCostSaved,
        avgLatencyMs,
        performance,
      });

      console.log('[SnippetCacheAnalytics] Stats loaded:', {
        totalRequests,
        hitRate: (hitRate * 100).toFixed(1) + '%',
        performance,
      });

      setLoading(false);
    } catch (err) {
      console.error('[SnippetCacheAnalytics] Error loading metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cache metrics');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Snippet Cache Performance</h2>
          <div className="text-xs text-gray-400">Loading...</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-white shadow animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3"></div>
              <div className="h-6 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Snippet Cache Performance</h2>
        </div>
        <div className="p-5 rounded-2xl bg-red-50 border border-red-200">
          <div className="text-sm text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // KPI Cards
  const kpiCards = [
    {
      key: 'requests',
      label: 'Embedding Requests',
      value: stats.totalRequests.toLocaleString(),
      color: 'blue',
      description: `${stats.cacheHits.toLocaleString()} hits, ${stats.cacheMisses.toLocaleString()} misses`,
    },
    {
      key: 'hitRate',
      label: 'Cache Hit Rate',
      value: (stats.hitRate * 100).toFixed(1) + '%',
      color: getHitRateColor(stats.hitRate),
      description: getPerformanceBadge(stats.performance),
    },
    {
      key: 'tokensSaved',
      label: 'Tokens Saved',
      value: formatLargeNumber(stats.tokensSaved),
      color: 'green',
      description: 'Estimated from cache hits',
    },
    {
      key: 'costSaved',
      label: 'Cost Saved',
      value: '$' + stats.costSaved.toFixed(4),
      color: 'purple',
      description: `Last ${days} days`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Snippet Cache Performance</h2>
        <div className="text-xs text-gray-500">Last {days} days</div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.key}
            className="p-5 rounded-2xl bg-white shadow hover:shadow-md transition-shadow"
          >
            <div className="text-xs text-gray-500 mb-2">{kpi.label}</div>
            <div className={`text-2xl font-bold text-${kpi.color}-600 mb-1`}>
              {kpi.value}
            </div>
            <div className="text-xs text-gray-400">{kpi.description}</div>
          </div>
        ))}
      </div>

      {/* Performance Insights */}
      {stats.hitRate < 0.5 && (
        <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
          <div className="text-sm font-medium text-yellow-800 mb-1">
            Low cache hit rate detected
          </div>
          <div className="text-xs text-yellow-600">
            Consider increasing TTL or reviewing snippet deduplication logic.
          </div>
        </div>
      )}

      {stats.avgLatencyMs > 500 && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
          <div className="text-sm font-medium text-orange-800 mb-1">
            High latency detected
          </div>
          <div className="text-xs text-orange-600">
            Average latency: {stats.avgLatencyMs.toFixed(0)}ms. Consider parallel batch
            requests or optimizing Firestore queries.
          </div>
        </div>
      )}

      {stats.performance === 'excellent' && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
          <div className="text-sm font-medium text-green-800 mb-1">
            Cache performing excellently
          </div>
          <div className="text-xs text-green-600">
            Hit rate above 80%. System is well-optimized for cost and latency.
          </div>
        </div>
      )}
    </div>
  );
}

// === Helper Functions ===

function formatDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getHitRateColor(hitRate: number): string {
  if (hitRate >= 0.8) return 'green';
  if (hitRate >= 0.6) return 'blue';
  if (hitRate >= 0.4) return 'yellow';
  return 'red';
}

function getPerformanceBadge(performance: string): string {
  const badges = {
    excellent: '🟢 Excellent',
    good: '🔵 Good',
    fair: '🟡 Fair',
    poor: '🔴 Poor',
  };
  return badges[performance as keyof typeof badges] || 'Unknown';
}

function formatLargeNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}
