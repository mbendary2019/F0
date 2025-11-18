/**
 * Phase 63 - Enhanced Daily Metrics Aggregation
 * Scheduled function that runs daily to aggregate ops_events metrics
 * Includes latency percentiles, event breakdowns, and backfill capability
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, tz } from './client';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type EventDoc = {
  ts: number;           // timestamp in unix ms
  level?: 'info' | 'warn' | 'error';
  type?: string;        // e.g., 'ingest', 'normalize', 'rag.validate'
  strategy?: string;    // e.g., 'default', 'fast', 'llm-mini'
  latency?: number;     // ms
  message?: string;
  sessionId?: string;
  uid?: string;
  orgId?: string;
  [key: string]: any;
};

export type DailyMetrics = {
  date: string;                // yyyy-mm-dd (UTC)
  total: number;
  info: number;
  warn: number;
  error: number;
  avgLatency: number;          // ms
  p50Latency: number;          // ms (median)
  p95Latency: number;          // ms (95th percentile)
  byType: Record<string, number>;
  byStrategy: Record<string, number>;
  updatedAt: number;           // unix ms

  // Legacy Phase 48 fields (preserved for backward compatibility)
  dau?: number;
  tokens?: number;
  requests?: number;
  seatsUsed?: number;
  orgsActive?: number;
  aggregatedAt?: Date;
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Format date as yyyy-mm-dd in UTC
 */
function ymdUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get start of day (00:00:00.000) in UTC for given date
 */
function startOfDayUTC(d: Date): number {
  const iso = ymdUTC(d);
  return new Date(`${iso}T00:00:00.000Z`).getTime();
}

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const idx = Math.ceil((p / 100) * arr.length) - 1;
  const sorted = [...arr].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.min(sorted.length - 1, idx))]);
}

// ============================================================
// AGGREGATION LOGIC
// ============================================================

/**
 * Compute daily metrics for a given time range
 */
export async function computeMetrics(sinceMs: number, untilMs: number): Promise<DailyMetrics> {
  const snap = await db
    .collection('ops_events')
    .where('ts', '>=', sinceMs)
    .where('ts', '<', untilMs)
    .get();

  let total = 0, info = 0, warn = 0, error = 0;
  const latencies: number[] = [];
  const byType: Record<string, number> = {};
  const byStrategy: Record<string, number> = {};

  // Legacy Phase 48 counters (preserved for backward compatibility)
  const dauSet = new Set<string>();
  const orgSet = new Set<string>();
  let tokens = 0;
  let requests = 0;

  snap.forEach((doc) => {
    const d = doc.data() as EventDoc;
    total++;

    // Count by level
    if (d.level === 'info') info++;
    else if (d.level === 'warn') warn++;
    else if (d.level === 'error') error++;

    // Collect latencies
    if (d.latency != null) {
      latencies.push(d.latency);
    }

    // Count by type
    if (d.type) {
      byType[d.type] = (byType[d.type] || 0) + 1;
    }

    // Count by strategy
    if (d.strategy) {
      byStrategy[d.strategy] = (byStrategy[d.strategy] || 0) + 1;
    }

    // Legacy Phase 48 tracking
    if (d.uid) dauSet.add(d.uid);
    if (d.orgId) orgSet.add(d.orgId);
    if (d.type === 'tokens') tokens += (d as any).n || 0;
    if (d.type === 'api') requests += (d as any).n || 1;
  });

  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  return {
    date: ymdUTC(new Date(sinceMs)),
    total,
    info,
    warn,
    error,
    avgLatency,
    p50Latency: percentile(latencies, 50),
    p95Latency: percentile(latencies, 95),
    byType,
    byStrategy,
    updatedAt: Date.now(),

    // Legacy Phase 48 fields
    dau: dauSet.size,
    tokens,
    requests,
    orgsActive: orgSet.size,
    aggregatedAt: new Date(),
  };
}

// ============================================================
// SCHEDULED FUNCTION (runs daily at 02:10 Asia/Kuwait)
// ============================================================

export const aggregateDailyMetrics = onSchedule(
  {
    schedule: '10 2 * * *',  // 02:10 every day (cron format)
    timeZone: tz,
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    // Aggregate previous day's complete data
    const end = startOfDayUTC(new Date());  // Today 00:00 UTC
    const since = end - DAY_MS;              // Yesterday 00:00 UTC
    const docId = ymdUTC(new Date(since));   // yyyy-mm-dd for yesterday

    console.log(`📊 Aggregating metrics for ${docId} (${since} to ${end})`);

    const metrics = await computeMetrics(since, end);

    // Write to Firestore (idempotent with merge)
    await db.collection('ops_metrics_daily').doc(docId).set(metrics, { merge: true });

    console.log(`✅ Metrics aggregated for ${docId}:`, {
      total: metrics.total,
      info: metrics.info,
      warn: metrics.warn,
      error: metrics.error,
      avgLatency: metrics.avgLatency,
      p50: metrics.p50Latency,
      p95: metrics.p95Latency,
    });
  }
);

// ============================================================
// BACKFILL CALLABLE (admin-only)
// ============================================================

export const aggregateDailyMetricsBackfill = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 300,
    cors: true,
  },
  async (request) => {
    // Admin-only guard
    if (!request.auth?.token?.admin) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    // Validate input: days (1-90, default 7)
    const days = Math.max(1, Math.min(90, Number(request.data?.days ?? 7)));

    console.log(`🔄 Starting backfill for last ${days} days`);

    let processed = 0;
    const results: Array<{ date: string; total: number }> = [];

    // Process each day from most recent to oldest
    for (let i = 1; i <= days; i++) {
      const end = startOfDayUTC(new Date()) - DAY_MS * (i - 1);
      const since = end - DAY_MS;
      const docId = ymdUTC(new Date(since));

      console.log(`  Processing ${docId}...`);

      const metrics = await computeMetrics(since, end);
      await db.collection('ops_metrics_daily').doc(docId).set(metrics, { merge: true });

      processed++;
      results.push({ date: metrics.date, total: metrics.total });
    }

    console.log(`✅ Backfill complete: ${processed} days processed`);

    return {
      success: true,
      processed,
      results,
      message: `Successfully aggregated metrics for ${processed} days`,
    };
  }
);
