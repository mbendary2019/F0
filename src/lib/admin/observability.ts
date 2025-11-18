/**
 * Admin Observability Helpers
 * Collect and query metrics and audit logs
 */

import { getFirestore } from 'firebase-admin/firestore';

type AuditFilters = {
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
};

/**
 * Get summary metrics for the last 24 hours and 7-day timeseries
 * TODO: Connect to real metrics source (api_metrics_daily collection)
 */
export async function getSummaryMetrics() {
  const db = getFirestore();
  const now = Date.now();
  const dayMs = 86400000;

  try {
    // Fetch last 24h audit entries as placeholder for calls count
    const since24h = now - dayMs;
    const snap = await db
      .collection('admin_audit')
      .where('ts', '>=', since24h)
      .get();

    // Count calls and errors (placeholder logic)
    const calls24h = snap.size;
    const errors24h = 0; // TODO: Connect to real error tracking

    // Calculate p95 latency (placeholder)
    const p95 = 0; // TODO: Connect to real latency metrics

    // Generate 7-day timeseries (placeholder with zeros)
    const timeseries = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * dayMs);
      const date = d.toISOString().slice(0, 10);
      return { date, calls: 0, errors: 0 };
    });

    // Try to populate from actual daily metrics if available
    try {
      const metricsSnap = await db
        .collection('api_metrics_daily')
        .orderBy('date', 'desc')
        .limit(7)
        .get();

      const metricsMap = new Map<string, { calls: number; errors: number }>();
      metricsSnap.forEach((doc) => {
        const data = doc.data();
        metricsMap.set(data.date, {
          calls: data.calls || 0,
          errors: data.errors || 0,
        });
      });

      // Merge with timeseries
      timeseries.forEach((item) => {
        const metrics = metricsMap.get(item.date);
        if (metrics) {
          item.calls = metrics.calls;
          item.errors = metrics.errors;
        }
      });
    } catch (err) {
      console.log('[observability] api_metrics_daily not available yet:', err);
    }

    return {
      totals: { calls24h, errors24h, p95 },
      timeseries,
    };
  } catch (error) {
    console.error('[observability] Error fetching summary metrics:', error);
    return {
      totals: { calls24h: 0, errors24h: 0, p95: 0 },
      timeseries: [],
    };
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAudit(filters: AuditFilters) {
  const db = getFirestore();

  try {
    let query: FirebaseFirestore.Query = db
      .collection('admin_audit')
      .orderBy('ts', 'desc')
      .limit(1000);

    // Apply filters
    if (filters.action) {
      query = query.where('action', '==', filters.action);
    }

    if (filters.actor) {
      query = query.where('actorUid', '==', filters.actor);
    }

    if (filters.from) {
      const tsFrom = new Date(filters.from).getTime();
      query = query.where('ts', '>=', tsFrom);
    }

    if (filters.to) {
      const tsTo = new Date(filters.to).getTime() + 86399999; // End of day
      query = query.where('ts', '<=', tsTo);
    }

    const snap = await query.get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{
      id: string;
      ts: number;
      action: string;
      actorUid: string;
      targetUid?: string;
      ip?: string;
      ua?: string;
      meta?: Record<string, unknown>;
    }>;
  } catch (error) {
    console.error('[observability] Error querying audit logs:', error);
    return [];
  }
}

/**
 * Record API metrics (to be called from Cloud Functions or middleware)
 */
export async function recordApiMetric(data: {
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp?: number;
}) {
  const db = getFirestore();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const ref = db.collection('api_metrics_daily').doc(today);

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const existing = doc.exists ? doc.data()! : {
        date: today,
        endpoints: {},
        calls: 0,
        errors: 0,
        latencies: [],
      };

      // Increment calls
      existing.calls += 1;

      // Track errors (4xx and 5xx)
      if (data.statusCode >= 400) {
        existing.errors += 1;
      }

      // Track per-endpoint stats
      const endpointKey = `${data.method} ${data.endpoint}`;
      if (!existing.endpoints[endpointKey]) {
        existing.endpoints[endpointKey] = { calls: 0, errors: 0 };
      }
      existing.endpoints[endpointKey].calls += 1;
      if (data.statusCode >= 400) {
        existing.endpoints[endpointKey].errors += 1;
      }

      // Store latencies (keep last 1000 for p95 calculation)
      if (!existing.latencies) existing.latencies = [];
      existing.latencies.push(data.latencyMs);
      if (existing.latencies.length > 1000) {
        existing.latencies = existing.latencies.slice(-1000);
      }

      // Calculate p95
      const sorted = [...existing.latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      existing.p95 = sorted[p95Index] || 0;

      tx.set(ref, existing, { merge: true });
    });
  } catch (error) {
    console.error('[observability] Error recording API metric:', error);
  }
}

