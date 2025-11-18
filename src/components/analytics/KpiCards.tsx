/**
 * Phase 63 Day 2: KPI Cards Component
 * Displays key performance indicators: Total Events, Error Rate, Avg Latency
 */

"use client";

export default function KpiCards({
  totals,
  errorRate,
  avgLatency,
  loading,
  locale = "ar",
}: {
  totals: number;
  errorRate: number;
  avgLatency: number;
  loading?: boolean;
  locale?: "ar" | "en";
}) {
  const t =
    locale === "ar"
      ? {
          total: "إجمالي الأحداث",
          error: "نسبة الأخطاء",
          avg: "متوسط زمن الاستجابة",
          avgUnit: "مللي ثانية",
        }
      : {
          total: "Total Events",
          error: "Error Rate",
          avg: "Avg Latency",
          avgUnit: "ms",
        };

  const Item = ({ title, value }: { title: string; value: string | number }) => (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm min-w-[200px] bg-white dark:bg-gray-900">
      <div className="text-sm opacity-70 mb-1">{title}</div>
      <div className="text-2xl font-semibold">{loading ? "…" : value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Item title={t.total} value={totals.toLocaleString()} />
      <Item title={t.error} value={`${errorRate}%`} />
      <Item title={t.avg} value={`${avgLatency} ${t.avgUnit}`} />
    </div>
  );
}
