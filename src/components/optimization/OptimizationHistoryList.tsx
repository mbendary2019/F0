// src/components/optimization/OptimizationHistoryList.tsx
// Phase 138.2 + 138.3.2: Component showing optimization run history with scores

"use client";

import type { OptimizationRun, OptimizationRunStatus, OptimizationScores } from "@/lib/optimization/types";

interface OptimizationHistoryListProps {
  runs: OptimizationRun[];
  locale?: string;
  onSelectRun?: (runId: string) => void;
}

const STATUS_CONFIG: Record<
  OptimizationRunStatus,
  { label: { en: string; ar: string }; icon: string; color: string }
> = {
  pending: {
    label: { en: "Pending", ar: "في الانتظار" },
    icon: "⏳",
    color: "text-yellow-400",
  },
  running: {
    label: { en: "Running", ar: "قيد التشغيل" },
    icon: "⚙️",
    color: "text-blue-400",
  },
  collecting_signals: {
    label: { en: "Collecting", ar: "جمع البيانات" },
    icon: "📊",
    color: "text-blue-400",
  },
  planning: {
    label: { en: "Planning", ar: "التخطيط" },
    icon: "📝",
    color: "text-purple-400",
  },
  executing: {
    label: { en: "Executing", ar: "التنفيذ" },
    icon: "⚡",
    color: "text-orange-400",
  },
  completed: {
    label: { en: "Completed", ar: "مكتمل" },
    icon: "✅",
    color: "text-emerald-400",
  },
  failed: {
    label: { en: "Failed", ar: "فشل" },
    icon: "❌",
    color: "text-red-400",
  },
  cancelled: {
    label: { en: "Cancelled", ar: "ملغى" },
    icon: "🚫",
    color: "text-gray-400",
  },
};

// Phase 138.3.2: Risk level icons
const RISK_ICONS: Record<OptimizationScores["riskLevel"], string> = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  critical: "🔴",
};

/**
 * Phase 138.3.2: Get score color class
 */
function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

/**
 * Format relative time (e.g., "2 hours ago", "منذ ساعتين")
 */
function formatRelativeTime(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const isAr = locale === "ar";

  if (diffMinutes < 1) {
    return isAr ? "الآن" : "Just now";
  } else if (diffMinutes < 60) {
    return isAr ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

export function OptimizationHistoryList({
  runs,
  locale = "en",
  onSelectRun,
}: OptimizationHistoryListProps) {
  const isRTL = locale === "ar";
  const t = (en: string, ar: string) => (locale === "ar" ? ar : en);

  if (!runs.length) {
    return (
      <p className={`text-xs text-slate-400 ${isRTL ? "text-right" : ""}`}>
        {t(
          "No optimization runs yet. Click 'Optimize project now' to start.",
          "لم يتم تشغيل أي Optimization حتى الآن. اضغط على 'Optimize project now' للبدء."
        )}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {runs.map((run) => {
        const config = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
        const statusLabel = config.label[locale as "en" | "ar"] || config.label.en;

        return (
          <li
            key={run.id}
            className={`flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2.5 hover:bg-white/10 cursor-pointer transition-colors ${
              isRTL ? "flex-row-reverse" : ""
            }`}
            onClick={() => onSelectRun?.(run.id)}
          >
            <div className={`flex flex-col ${isRTL ? "items-end" : ""}`}>
              <span className={`text-xs font-medium ${config.color}`}>
                {config.icon} {statusLabel}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {formatRelativeTime(run.createdAt, locale)}
              </span>
            </div>

            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              {/* Phase 138.3.2: Score and Risk indicator */}
              {run.scores && (
                <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <span
                    className={`text-sm font-bold ${getScoreColor(run.scores.overallScore)}`}
                    title={t("Overall Score", "النتيجة الكلية")}
                  >
                    {run.scores.overallScore}
                  </span>
                  <span title={t("Risk Level", "مستوى الخطر")}>
                    {RISK_ICONS[run.scores.riskLevel] || "🟡"}
                  </span>
                </div>
              )}

              {/* Metrics preview (show when no scores) */}
              {!run.scores && run.metrics && (
                <div className={`flex gap-2 text-[10px] text-slate-400 ${isRTL ? "flex-row-reverse" : ""}`}>
                  {run.metrics.deploymentsCount != null && (
                    <span title={t("Deployments", "النشرات")}>
                      🚀 {run.metrics.deploymentsCount}
                    </span>
                  )}
                  {run.metrics.liveSessionsCount != null && (
                    <span title={t("Sessions", "الجلسات")}>
                      📡 {run.metrics.liveSessionsCount}
                    </span>
                  )}
                  {run.metrics.agentTasksCount != null && (
                    <span title={t("Tasks", "المهام")}>
                      🤖 {run.metrics.agentTasksCount}
                    </span>
                  )}
                </div>
              )}

              {/* Arrow indicator */}
              <span className="text-slate-500 text-xs">
                {isRTL ? "←" : "→"}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
