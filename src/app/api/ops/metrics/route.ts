/**
 * Phase 63 Day 2: Analytics Metrics API
 * Protected endpoint that fetches aggregated daily metrics
 * Supports 7/30/90 day ranges
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type MetricDoc = {
  date: string;
  total: number;
  info: number;
  warn: number;
  error: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  byType?: Record<string, number>;
  byStrategy?: Record<string, number>;
  updatedAt?: number;
};

/**
 * Get date N days ago in UTC yyyy-mm-dd format
 */
function daysAgoUTC(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}

/**
 * GET /api/ops/metrics?days=7
 * Returns aggregated metrics for the specified time range
 */
export async function GET(req: NextRequest) {
  try {
    // Parse range parameter (7, 30, or 90 days)
    const range = Number(req.nextUrl.searchParams.get("days") ?? "7");
    const allowed = [7, 30, 90];
    const days = allowed.includes(range) ? range : 7;

    // Authentication: Get token from Authorization header or __session cookie
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.replace("Bearer ", "") || req.cookies.get("__session")?.value;

    if (!idToken) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify token
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (error: any) {
      console.error("[metrics-api] Token verification failed:", error.message);
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "Invalid authentication token" },
        { status: 401 }
      );
    }

    if (!decoded) {
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "Token verification failed" },
        { status: 401 }
      );
    }

    // Fetch metrics from Firestore
    const startDate = daysAgoUTC(days - 1);
    const snap = await adminDb
      .collection("ops_metrics_daily")
      .where("date", ">=", startDate)
      .orderBy("date", "asc")
      .get();

    const rows: MetricDoc[] = [];
    snap.forEach((doc) => {
      rows.push(doc.data() as MetricDoc);
    });

    // Calculate aggregate KPIs
    const totals = rows.reduce((sum, row) => sum + row.total, 0);
    const errors = rows.reduce((sum, row) => sum + row.error, 0);
    const infos = rows.reduce((sum, row) => sum + row.info, 0);
    const warns = rows.reduce((sum, row) => sum + row.warn, 0);

    const avgLatency = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + row.avgLatency, 0) / rows.length)
      : 0;

    const errorRate = totals ? Number(((errors / totals) * 100).toFixed(2)) : 0;

    // Prepare time series data for charts (p50, p95, error rate by day)
    const series = rows.map((row) => ({
      date: row.date,
      p50: row.p50Latency,
      p95: row.p95Latency,
      total: row.total,
      errorRate: row.total
        ? Number(((row.error / row.total) * 100).toFixed(2))
        : 0,
    }));

    // Response with cache control
    const response = NextResponse.json({
      days,
      rows,
      kpi: {
        totals,
        infos,
        warns,
        errors,
        avgLatency,
        errorRate,
      },
      series,
    });

    // Cache for 15 seconds (balance between freshness and performance)
    response.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");

    return response;
  } catch (error: any) {
    console.error("[metrics-api] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to fetch metrics",
        detail: error?.message,
      },
      { status: 500 }
    );
  }
}
