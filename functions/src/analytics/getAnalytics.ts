/**
 * Phase 48 - Get Analytics Function
 * Returns KPIs and time series data for dashboard
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './client';

interface GetAnalyticsPayload {
  days?: number;
  orgId?: string;
}

interface DailyMetrics {
  date: string;
  dau: number;
  tokens: number;
  requests: number;
  seatsUsed: number;
  orgsActive: number;
}

interface KPIs {
  dau: number;
  tokens: number;
  requests: number;
  seatsUsed: number;
  orgsActive: number;
}

export const getAnalytics = onCall<GetAnalyticsPayload>(
  {
    cors: [/\.web\.app$/, /localhost/],
    region: 'us-central1',
  },
  async (req) => {
    const auth = req.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to view analytics');
    }

    const { days = 30, orgId } = req.data || {};

    // Query daily metrics
    let query = db
      .collection('ops_metrics_daily')
      .orderBy('date', 'desc')
      .limit(Math.min(days, 365)); // Cap at 1 year

    const snapshot = await query.get();

    // Parse metrics
    const series: DailyMetrics[] = snapshot.docs
      .map((doc) => doc.data() as DailyMetrics)
      .reverse(); // Oldest to newest for charts

    // Calculate KPIs
    const kpis: KPIs = series.reduce(
      (acc, row) => ({
        dau: Math.max(acc.dau, row.dau),
        tokens: acc.tokens + row.tokens,
        requests: acc.requests + row.requests,
        seatsUsed: row.seatsUsed, // Latest value
        orgsActive: Math.max(acc.orgsActive, row.orgsActive),
      }),
      { dau: 0, tokens: 0, requests: 0, seatsUsed: 0, orgsActive: 0 }
    );

    // If orgId is provided, filter org-specific events
    if (orgId) {
      // This would require additional aggregation logic
      // For now, return global metrics
      console.log(`Org-specific analytics not yet implemented for: ${orgId}`);
    }

    return {
      kpis,
      series,
      period: {
        start: series[0]?.date || null,
        end: series[series.length - 1]?.date || null,
        days: series.length,
      },
    };
  }
);
