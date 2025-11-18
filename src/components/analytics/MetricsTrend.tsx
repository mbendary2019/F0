/**
 * Phase 63 Day 2: Metrics Trend Chart Component
 * Displays latency percentiles (p50, p95) and error rate over time
 * Uses SSR-safe dynamic imports for Recharts
 */

"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// SSR-safe dynamic imports for Recharts components
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

type SeriesData = {
  date: string;
  p50: number;
  p95: number;
  errorRate: number;
};

export default function MetricsTrend({
  series,
  loading,
  locale = "ar",
}: {
  series: SeriesData[];
  loading?: boolean;
  locale?: "ar" | "en";
}) {
  const t =
    locale === "ar"
      ? {
          p50: "زمن الاستجابة p50",
          p95: "زمن الاستجابة p95",
          er: "نسبة الأخطاء",
          no: "لا توجد بيانات",
          title: "اتجاه المقاييس",
        }
      : {
          p50: "Latency p50",
          p95: "Latency p95",
          er: "Error Rate",
          no: "No data available",
          title: "Metrics Trend",
        };

  const data = useMemo(() => series, [series]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm bg-white dark:bg-gray-900">
        <div className="text-sm mb-2 opacity-70">{t.title}</div>
        <div className="h-72 grid place-content-center opacity-60">
          <div className="animate-pulse">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm bg-white dark:bg-gray-900">
        <div className="text-sm mb-2 opacity-70">{t.title}</div>
        <div className="h-72 grid place-content-center opacity-60">{t.no}</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm bg-white dark:bg-gray-900">
      <div className="text-sm mb-2 opacity-70">{t.title}</div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-xs"
            />
            <YAxis
              yAxisId="ms"
              label={{ value: "Latency (ms)", angle: -90, position: "insideLeft" }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              label={{ value: "Error Rate (%)", angle: 90, position: "insideRight" }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Area
              yAxisId="ms"
              type="monotone"
              dataKey="p50"
              name={t.p50}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Area
              yAxisId="ms"
              type="monotone"
              dataKey="p95"
              name={t.p95}
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Area
              yAxisId="pct"
              type="monotone"
              dataKey="errorRate"
              name={t.er}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
