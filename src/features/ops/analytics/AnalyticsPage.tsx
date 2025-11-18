/**
 * Phase 63 Day 2-3: Analytics Dashboard Page
 * Displays KPIs, metrics trends, and daily reports for ops_events
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase";
import KpiCards from "@/components/analytics/KpiCards";
import MetricsTrend from "@/components/analytics/MetricsTrend";
import RangeSelector from "@/components/analytics/RangeSelector";
import ReportsPanel from "@/features/ops/analytics/ReportsPanel";
import InsightsPanel from "@/features/ops/analytics/InsightsPanel";

type ApiResponse = {
  days: number;
  rows: any[];
  kpi: {
    totals: number;
    infos: number;
    warns: number;
    errors: number;
    avgLatency: number;
    errorRate: number;
  };
  series: {
    date: string;
    p50: number;
    p95: number;
    total: number;
    errorRate: number;
  }[];
};

export default function AnalyticsPage({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = useMemo(() => {
    const ar = {
      title: "لوحة تحليلات العمليات",
      subtitle: "مقاييس الأداء والأخطاء للأحداث",
      error: "فشل تحميل البيانات",
      retry: "إعادة المحاولة",
      loading: "جاري التحميل...",
    };
    const en = {
      title: "Ops Analytics Dashboard",
      subtitle: "Performance and error metrics for events",
      error: "Failed to load data",
      retry: "Retry",
      loading: "Loading...",
    };
    return locale === "ar" ? ar : en;
  }, [locale]);

  useEffect(() => {
    let mounted = true;

    async function fetchMetrics() {
      setLoading(true);
      setError(null);

      try {
        // Get Firebase auth token
        const auth = getAuth(app);
        const user = auth.currentUser;

        if (!user) {
          throw new Error("User not authenticated");
        }

        const idToken = await user.getIdToken();

        // Fetch metrics from API
        const res = await fetch(`/api/ops/metrics?days=${days}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();

        if (mounted) {
          setData(json);
        }
      } catch (err: any) {
        console.error("[AnalyticsPage] Error fetching metrics:", err);
        if (mounted) {
          setError(err.message || "Failed to load metrics");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchMetrics();

    return () => {
      mounted = false;
    };
  }, [days]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
          <div className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
            {t.error}
          </div>
          <div className="text-sm text-red-600 dark:text-red-500 mb-4">{error}</div>
          <button
            onClick={() => setDays(days)} // Trigger re-fetch
            className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm opacity-70 mt-1">{t.subtitle}</p>
        </div>
        <RangeSelector locale={locale} value={days} onChange={setDays} />
      </div>

      {/* KPI Cards */}
      <KpiCards
        locale={locale}
        totals={data?.kpi.totals ?? 0}
        errorRate={data?.kpi.errorRate ?? 0}
        avgLatency={data?.kpi.avgLatency ?? 0}
        loading={loading}
      />

      {/* Metrics Trend Chart */}
      <MetricsTrend locale={locale} loading={loading} series={data?.series ?? []} />

      {/* AI Trend Insights Panel */}
      <InsightsPanel locale={locale} />

      {/* Daily Reports Panel */}
      <ReportsPanel locale={locale} />
    </div>
  );
}
