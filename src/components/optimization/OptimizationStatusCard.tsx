// src/components/optimization/OptimizationStatusCard.tsx
// Phase 138.1 + 138.2 + 138.3.2 + 138.4.3: Card showing latest optimization run status, scores and results
// Phase 138.4.3: Added relative time display and polish

"use client";

import Link from "next/link";
import { useLatestOptimizationRun } from "@/hooks/useLatestOptimizationRun";
import type { OptimizationRun, OptimizationRunStatus, OptimizationScores } from "@/lib/optimization/types";

interface OptimizationStatusCardProps {
  projectId: string;
  locale?: string;
}

const STATUS_CONFIG: Record<
  OptimizationRunStatus,
  { label: { en: string; ar: string }; color: string; icon: string }
> = {
  pending: {
    label: { en: "Pending", ar: "في الانتظار" },
    color: "bg-yellow-500/20 text-yellow-300",
    icon: "⏳",
  },
  running: {
    label: { en: "Running", ar: "قيد التشغيل" },
    color: "bg-blue-500/20 text-blue-300",
    icon: "🔄",
  },
  collecting_signals: {
    label: { en: "Collecting Signals", ar: "جمع الإشارات" },
    color: "bg-blue-500/20 text-blue-300",
    icon: "📊",
  },
  planning: {
    label: { en: "Planning", ar: "التخطيط" },
    color: "bg-purple-500/20 text-purple-300",
    icon: "📝",
  },
  executing: {
    label: { en: "Executing", ar: "التنفيذ" },
    color: "bg-orange-500/20 text-orange-300",
    icon: "⚡",
  },
  completed: {
    label: { en: "Completed", ar: "مكتمل" },
    color: "bg-emerald-500/20 text-emerald-300",
    icon: "✅",
  },
  failed: {
    label: { en: "Failed", ar: "فشل" },
    color: "bg-red-500/20 text-red-300",
    icon: "❌",
  },
  cancelled: {
    label: { en: "Cancelled", ar: "ملغى" },
    color: "bg-gray-500/20 text-gray-300",
    icon: "🚫",
  },
};

// Phase 138.3.2: Risk level configuration
const RISK_CONFIG: Record<
  OptimizationScores["riskLevel"],
  { label: { en: string; ar: string }; color: string; icon: string }
> = {
  low: {
    label: { en: "Low Risk", ar: "خطر منخفض" },
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    icon: "🟢",
  },
  medium: {
    label: { en: "Medium Risk", ar: "خطر متوسط" },
    color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    icon: "🟡",
  },
  high: {
    label: { en: "High Risk", ar: "خطر عالي" },
    color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    icon: "🟠",
  },
  critical: {
    label: { en: "Critical Risk", ar: "خطر حرج" },
    color: "bg-red-500/20 text-red-300 border-red-500/30",
    icon: "🔴",
  },
};

// Phase 138.3.2: Helper component for displaying individual scores
function ScoreChip({
  label,
  score,
  locale = "en",
}: {
  label: { en: string; ar: string };
  score: number;
  locale?: string;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-400";
    if (s >= 60) return "text-yellow-400";
    if (s >= 40) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
      <p className={`text-lg font-bold ${getScoreColor(score)}`}>{score}</p>
      <p className="text-[10px] text-slate-400">{label[locale as "en" | "ar"] || label.en}</p>
    </div>
  );
}

export function OptimizationStatusCard({ projectId, locale = "en" }: OptimizationStatusCardProps) {
  // Phase 138.4.4: Added isStale to track old runs
  const { run, loading, error, isStale } = useLatestOptimizationRun(projectId);
  const isRTL = locale === "ar";
  const t = (en: string, ar: string) => (locale === "ar" ? ar : en);

  // Don't render anything if no runs yet
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-slate-700 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return null; // Silent fail
  }

  if (!run) {
    return null; // No optimization runs yet
  }

  const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
  const statusLabel = statusConfig.label[locale as "en" | "ar"] || statusConfig.label.en;

  const formatTime = (isoString?: string) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  // Phase 138.4.3: Format relative time
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("Just now", "الآن");
    if (diffMins < 60) return locale === "ar" ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
    if (diffHours < 24) return locale === "ar" ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    if (diffDays < 7) return locale === "ar" ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    return formatTime(isoString);
  };

  const isInProgress = ["pending", "running", "collecting_signals", "planning", "executing"].includes(
    run.status
  );

  return (
    <div className={`rounded-xl border border-white/10 bg-slate-900/60 p-5 ${isRTL ? "text-right" : ""}`}>
      <div className={`flex items-center justify-between mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        <h3 className="text-sm font-semibold text-slate-200">
          {t("Latest Optimization", "آخر تحسين")}
        </h3>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${statusConfig.color}`}
        >
          <span className={isInProgress ? "animate-spin" : ""}>{statusConfig.icon}</span>
          <span>{statusLabel}</span>
        </span>
      </div>

      {/* Phase 138.3.2: Overall Score and Risk Badge */}
      {run.scores && (
        <div className="mb-4">
          <div className={`flex items-center gap-3 mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            {/* Overall Score Circle */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-slate-700"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${run.scores.overallScore} 100`}
                  strokeLinecap="round"
                  className={
                    run.scores.overallScore >= 80
                      ? "text-emerald-400"
                      : run.scores.overallScore >= 60
                      ? "text-yellow-400"
                      : run.scores.overallScore >= 40
                      ? "text-orange-400"
                      : "text-red-400"
                  }
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-white">{run.scores.overallScore}</span>
              </div>
            </div>

            {/* Risk Badge */}
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-1">{t("Project Health", "صحة المشروع")}</p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border ${
                  RISK_CONFIG[run.scores.riskLevel]?.color || RISK_CONFIG.medium.color
                }`}
              >
                <span>{RISK_CONFIG[run.scores.riskLevel]?.icon || "🟡"}</span>
                <span>
                  {RISK_CONFIG[run.scores.riskLevel]?.label[locale as "en" | "ar"] ||
                    RISK_CONFIG[run.scores.riskLevel]?.label.en ||
                    "Medium Risk"}
                </span>
              </span>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-4 gap-1.5">
            <ScoreChip
              label={{ en: "Security", ar: "الأمان" }}
              score={run.scores.securityScore}
              locale={locale}
            />
            <ScoreChip
              label={{ en: "Reliability", ar: "الموثوقية" }}
              score={run.scores.reliabilityScore}
              locale={locale}
            />
            <ScoreChip
              label={{ en: "Coverage", ar: "التغطية" }}
              score={run.scores.coverageScore}
              locale={locale}
            />
            <ScoreChip
              label={{ en: "Maintain", ar: "الصيانة" }}
              score={run.scores.maintainabilityScore}
              locale={locale}
            />
          </div>
        </div>
      )}

      {/* Metrics */}
      {run.metrics && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-white">{run.metrics.deploymentsCount ?? 0}</p>
            <p className="text-[10px] text-slate-400">{t("Deployments", "نشرات")}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-white">{run.metrics.liveSessionsCount ?? 0}</p>
            <p className="text-[10px] text-slate-400">{t("Sessions", "جلسات")}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-white">{run.metrics.agentTasksCount ?? 0}</p>
            <p className="text-[10px] text-slate-400">{t("Tasks", "مهام")}</p>
          </div>
        </div>
      )}

      {/* Summary */}
      {run.summary && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-1">{t("Summary", "ملخص")}</p>
          <p className="text-sm text-slate-200">{run.summary}</p>
        </div>
      )}

      {/* Recommendations */}
      {run.recommendations && run.recommendations.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2">{t("Recommendations", "التوصيات")}</p>
          <ul className="space-y-1">
            {run.recommendations.map((rec, idx) => (
              <li
                key={idx}
                className={`text-xs text-slate-300 ${isRTL ? "pr-2 border-r-2 border-purple-500/50" : "pl-2 border-l-2 border-purple-500/50"}`}
              >
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error message */}
      {run.errorMessage && (
        <div className="mb-4 p-2 rounded bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{run.errorMessage}</p>
        </div>
      )}

      {/* Phase 138.4.3 + 138.4.4: Timing info with relative time and stale warning */}
      <div className="text-[10px] text-slate-500">
        {run.finishedAt ? (
          <p className="flex items-center gap-1 flex-wrap">
            <span className="text-slate-400">🕐</span>
            <span>{t("Last run:", "آخر تشغيل:")}</span>
            <span className="text-slate-300 font-medium">{formatRelativeTime(run.finishedAt)}</span>
            {/* Phase 138.4.4: Stale badge */}
            {isStale && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] text-amber-200 border border-amber-500/30">
                {t("Stale (>48h)", "قديم (+48س)")}
              </span>
            )}
          </p>
        ) : run.startedAt ? (
          <p className="flex items-center gap-1">
            <span className="animate-pulse">🔄</span>
            <span>{t("Started:", "بدأ:")}</span>
            <span className="text-slate-300">{formatRelativeTime(run.startedAt)}</span>
          </p>
        ) : null}
      </div>

      {/* Phase 138.4.4: Stale warning message */}
      {isStale && (
        <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
          <span>⏱</span>{" "}
          {t(
            "The last optimization run is older than 48 hours. Consider running a fresh optimization for an up-to-date health check.",
            "آخر فحص تحسين أقدم من 48 ساعة. يُنصح بتشغيل فحص جديد للحصول على تقييم محدّث."
          )}
        </div>
      )}

      {/* View Details Button */}
      <div className={`mt-4 pt-3 border-t border-white/5 ${isRTL ? "text-left" : "text-right"}`}>
        <Link
          href={`/${locale}/projects/${projectId}/optimization/${run.id}`}
          className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition"
        >
          <span>{t("View details", "عرض التفاصيل")}</span>
          <span>{isRTL ? "←" : "→"}</span>
        </Link>
      </div>
    </div>
  );
}
