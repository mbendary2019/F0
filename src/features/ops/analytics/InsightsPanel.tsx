"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebaseClient";

type InsightData = {
  date: string;
  stats?: {
    target?: any;
    deltas?: { total: number; error: number; avgLatency: number; p95Latency: number };
    z?: { p95: number; error: number };
    topTypes?: Record<string, number>;
    topStrategies?: Record<string, number>;
  };
  summary?: { en: string; ar: string };
  createdAt?: number;
};

export default function InsightsPanel({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  const t = locale === "ar"
    ? {
        title: "ملخص ذكي (AI)",
        empty: "لا يوجد ملخص بعد",
        details: "تفاصيل",
        latency: "الزمن",
        errors: "الأخطاء"
      }
    : {
        title: "AI Trend Insight",
        empty: "No insight yet",
        details: "Details",
        latency: "Latency",
        errors: "Errors"
      };

  useEffect(() => {
    let mounted = true;

    async function fetchInsights() {
      try {
        const auth = getAuth(app);
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const idToken = await user.getIdToken();
        const res = await fetch("/api/ops/reports/insights", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!res.ok) {
          console.error("Failed to fetch insights:", res.status);
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (mounted) {
          setInsight(json?.insights ?? null);
        }
      } catch (error) {
        console.error("Error fetching insights:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchInsights();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          {t.title}
        </h3>
        {insight?.date && (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {insight.date}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse text-slate-400">جاري التحميل...</div>
        </div>
      ) : !insight ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary text */}
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            {locale === "ar" ? insight.summary?.ar : insight.summary?.en}
          </p>

          {/* Stats details */}
          {insight.stats && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs">
                <div className="font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t.errors}
                </div>
                <div className="space-y-0.5">
                  <div className="text-slate-500 dark:text-slate-500">
                    z-score: <span className="font-mono">{insight.stats.z?.error ?? 0}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-500">
                    Δ%: <span className="font-mono">{insight.stats.deltas?.error ?? 0}%</span>
                  </div>
                </div>
              </div>

              <div className="text-xs">
                <div className="font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t.latency}
                </div>
                <div className="space-y-0.5">
                  <div className="text-slate-500 dark:text-slate-500">
                    p95 z-score: <span className="font-mono">{insight.stats.z?.p95 ?? 0}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-500">
                    Δ%: <span className="font-mono">{insight.stats.deltas?.p95Latency ?? 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
