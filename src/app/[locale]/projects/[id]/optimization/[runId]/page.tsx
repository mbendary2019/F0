// src/app/[locale]/projects/[id]/optimization/[runId]/page.tsx
// Phase 138.2 + 138.3.2 + 138.5.2: Optimization Run Details Page with Scores and ACE Panel

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import F0Shell from "@/components/f0/F0Shell";
import { CodeEvolutionEnginePanel } from "@/components/optimization/CodeEvolutionEnginePanel";
import type { OptimizationRun, OptimizationRunStatus, OptimizationScores } from "@/lib/optimization/types";

const STATUS_CONFIG: Record<
  OptimizationRunStatus,
  { label: { en: string; ar: string }; color: string; bgColor: string; icon: string }
> = {
  pending: {
    label: { en: "Pending", ar: "في الانتظار" },
    color: "text-yellow-300",
    bgColor: "bg-yellow-500/20",
    icon: "⏳",
  },
  running: {
    label: { en: "Running", ar: "قيد التشغيل" },
    color: "text-blue-300",
    bgColor: "bg-blue-500/20",
    icon: "⚙️",
  },
  collecting_signals: {
    label: { en: "Collecting Signals", ar: "جمع الإشارات" },
    color: "text-blue-300",
    bgColor: "bg-blue-500/20",
    icon: "📊",
  },
  planning: {
    label: { en: "Planning", ar: "التخطيط" },
    color: "text-purple-300",
    bgColor: "bg-purple-500/20",
    icon: "📝",
  },
  executing: {
    label: { en: "Executing", ar: "التنفيذ" },
    color: "text-orange-300",
    bgColor: "bg-orange-500/20",
    icon: "⚡",
  },
  completed: {
    label: { en: "Completed", ar: "مكتمل" },
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/20",
    icon: "✅",
  },
  failed: {
    label: { en: "Failed", ar: "فشل" },
    color: "text-red-300",
    bgColor: "bg-red-500/20",
    icon: "❌",
  },
  cancelled: {
    label: { en: "Cancelled", ar: "ملغى" },
    color: "text-gray-300",
    bgColor: "bg-gray-500/20",
    icon: "🚫",
  },
};

// Phase 138.3.2: Risk level configuration
const RISK_CONFIG: Record<
  OptimizationScores["riskLevel"],
  { label: { en: string; ar: string }; color: string; bgColor: string; icon: string }
> = {
  low: {
    label: { en: "Low Risk", ar: "خطر منخفض" },
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/20",
    icon: "🟢",
  },
  medium: {
    label: { en: "Medium Risk", ar: "خطر متوسط" },
    color: "text-yellow-300",
    bgColor: "bg-yellow-500/20",
    icon: "🟡",
  },
  high: {
    label: { en: "High Risk", ar: "خطر عالي" },
    color: "text-orange-300",
    bgColor: "bg-orange-500/20",
    icon: "🟠",
  },
  critical: {
    label: { en: "Critical Risk", ar: "خطر حرج" },
    color: "text-red-300",
    bgColor: "bg-red-500/20",
    icon: "🔴",
  },
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

export default function OptimizationRunDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const projectId = params?.id as string;
  const runId = params?.runId as string;

  const isRTL = locale === "ar";
  const t = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const [run, setRun] = useState<OptimizationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !runId || !db) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, "projects", projectId, "optimizationRuns", runId);

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setRun({ id: snap.id, ...snap.data() } as OptimizationRun);
          setError(null);
        } else {
          setError(t("Optimization run not found", "لم يتم العثور على الـ Run"));
        }
        setLoading(false);
      },
      (err) => {
        console.error("[OptimizationRunDetails] Error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId, runId]);

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleString(isRTL ? "ar-EG" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const calculateDuration = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
      return `${diffSec}s`;
    } else if (diffSec < 3600) {
      const min = Math.floor(diffSec / 60);
      const sec = diffSec % 60;
      return `${min}m ${sec}s`;
    } else {
      const hours = Math.floor(diffSec / 3600);
      const min = Math.floor((diffSec % 3600) / 60);
      return `${hours}h ${min}m`;
    }
  };

  if (loading) {
    return (
      <F0Shell>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin text-4xl">⚙️</div>
        </div>
      </F0Shell>
    );
  }

  if (error || !run) {
    return (
      <F0Shell>
        <div className={`space-y-4 ${isRTL ? "text-right" : ""}`}>
          <p className="text-red-400">{error || t("Run not found", "لم يتم العثور على الـ Run")}</p>
          <Link
            href={`/${locale}/projects/${projectId}`}
            className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300"
          >
            {isRTL ? "← رجوع للمشروع" : "← Back to project"}
          </Link>
        </div>
      </F0Shell>
    );
  }

  const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
  const statusLabel = statusConfig.label[locale as "en" | "ar"] || statusConfig.label.en;
  const duration = calculateDuration(run.startedAt, run.finishedAt);
  const isInProgress = ["pending", "running", "collecting_signals", "planning", "executing"].includes(run.status);

  return (
    <F0Shell>
      <div className={`space-y-6 ${isRTL ? "text-right" : ""}`}>
        {/* Header */}
        <div className="space-y-2">
          <Link
            href={`/${locale}/projects/${projectId}`}
            className={`inline-flex items-center text-xs text-slate-400 hover:text-slate-300 ${isRTL ? "flex-row-reverse" : ""}`}
          >
            <span>{isRTL ? "←" : "←"}</span>
            <span className="mx-1">{t("Back to project", "رجوع للمشروع")}</span>
          </Link>

          <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <h1 className="text-xl font-semibold text-white">
              {t("Optimization Run", "Optimization Run")}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
            >
              <span className={isInProgress ? "animate-spin" : ""}>{statusConfig.icon}</span>
              <span>{statusLabel}</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 font-mono">ID: {run.id}</p>
        </div>

        {/* Timing Info */}
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            {t("Timing", "التوقيت")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                {t("Created", "تاريخ الإنشاء")}
              </p>
              <p className="text-sm text-slate-200">{formatDateTime(run.createdAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                {t("Started", "بدأ")}
              </p>
              <p className="text-sm text-slate-200">{formatDateTime(run.startedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                {t("Finished", "انتهى")}
              </p>
              <p className="text-sm text-slate-200">{formatDateTime(run.finishedAt)}</p>
            </div>
            {duration && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                  {t("Duration", "المدة")}
                </p>
                <p className="text-sm text-emerald-400 font-medium">{duration}</p>
              </div>
            )}
          </div>
        </div>

        {/* Phase 138.3.2: Scores Section */}
        {run.scores && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
            <div className={`flex items-center justify-between mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
              <h3 className="text-sm font-semibold text-slate-200">
                {t("Quality Scores", "نتائج الجودة")}
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  RISK_CONFIG[run.scores.riskLevel]?.bgColor || RISK_CONFIG.medium.bgColor
                } ${RISK_CONFIG[run.scores.riskLevel]?.color || RISK_CONFIG.medium.color}`}
              >
                <span>{RISK_CONFIG[run.scores.riskLevel]?.icon || "🟡"}</span>
                <span>
                  {RISK_CONFIG[run.scores.riskLevel]?.label[locale as "en" | "ar"] ||
                    RISK_CONFIG[run.scores.riskLevel]?.label.en}
                </span>
              </span>
            </div>

            {/* Overall Score with Circle */}
            <div className={`flex items-center gap-6 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-slate-700"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray={`${run.scores.overallScore} 100`}
                    strokeLinecap="round"
                    className={getScoreColor(run.scores.overallScore)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${getScoreColor(run.scores.overallScore)}`}>
                    {run.scores.overallScore}
                  </span>
                </div>
              </div>
              <div className={isRTL ? "text-right" : ""}>
                <p className="text-lg font-semibold text-white mb-1">
                  {t("Overall Score", "النتيجة الكلية")}
                </p>
                <p className="text-sm text-slate-400">
                  {run.scores.overallScore >= 80
                    ? t("Your project is in great shape!", "مشروعك في حالة ممتازة!")
                    : run.scores.overallScore >= 60
                    ? t("Good progress, some areas for improvement", "تقدم جيد، هناك مجال للتحسين")
                    : run.scores.overallScore >= 40
                    ? t("Needs attention in several areas", "يحتاج اهتمام في عدة مجالات")
                    : t("Critical improvements needed", "يحتاج تحسينات حرجة")}
                </p>
              </div>
            </div>

            {/* Individual Scores Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ScoreCard
                label={t("Security", "الأمان")}
                score={run.scores.securityScore}
                icon="🛡️"
              />
              <ScoreCard
                label={t("Reliability", "الموثوقية")}
                score={run.scores.reliabilityScore}
                icon="⚡"
              />
              <ScoreCard
                label={t("Coverage", "التغطية")}
                score={run.scores.coverageScore}
                icon="📊"
              />
              <ScoreCard
                label={t("Maintainability", "قابلية الصيانة")}
                score={run.scores.maintainabilityScore}
                icon="🔧"
              />
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        {run.metrics && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              {t("Metrics", "الإحصائيات")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard
                label={t("Deployments", "النشرات")}
                value={run.metrics.deploymentsCount ?? 0}
                icon="🚀"
              />
              <MetricCard
                label={t("Live Sessions", "الجلسات")}
                value={run.metrics.liveSessionsCount ?? 0}
                icon="📡"
              />
              <MetricCard
                label={t("Agent Tasks", "مهام الوكيل")}
                value={run.metrics.agentTasksCount ?? 0}
                icon="🤖"
              />
              <MetricCard
                label={t("Open Issues", "المشاكل المفتوحة")}
                value={run.metrics.openIssuesCount ?? 0}
                icon="⚠️"
              />
              <MetricCard
                label={t("Files", "الملفات")}
                value={run.metrics.filesCount ?? 0}
                icon="📁"
              />
              <MetricCard
                label={t("Lines of Code", "أسطر الكود")}
                value={run.metrics.totalLinesOfCode ?? 0}
                icon="📝"
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {run.summary && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              {t("Summary", "ملخص")}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{run.summary}</p>
          </div>
        )}

        {/* Recommendations */}
        {run.recommendations && run.recommendations.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              {t("Recommendations", "التوصيات")}
            </h3>
            <ul className="space-y-2">
              {run.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className={`text-sm text-slate-300 py-2 px-3 rounded-lg bg-white/5 ${
                    isRTL ? "border-r-2 border-purple-500/50" : "border-l-2 border-purple-500/50"
                  }`}
                >
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Phase 138.5.2: ACE (Code Evolution Engine) Panel */}
        {run.ace && run.status === "completed" && (
          <CodeEvolutionEnginePanel
            run={run}
            projectName={`Project ${projectId}`}
            locale={locale}
            onLaunchAce={(prompt) => {
              // Navigate to F0 agent chat with the ACE prompt pre-filled
              const encodedPrompt = encodeURIComponent(prompt);
              router.push(`/${locale}/f0?prompt=${encodedPrompt}`);
            }}
          />
        )}

        {/* Error Message */}
        {run.errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
            <h3 className="text-sm font-semibold text-red-400 mb-2">
              {t("Error", "خطأ")}
            </h3>
            <p className="text-sm text-red-300">{run.errorMessage}</p>
          </div>
        )}

        {/* Actions */}
        <div className={`flex gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Link
            href={`/${locale}/projects/${projectId}`}
            className="inline-flex items-center rounded-lg border border-white/15 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 transition"
          >
            {t("Back to Project", "رجوع للمشروع")}
          </Link>
        </div>
      </div>
    </F0Shell>
  );
}

// Metric Card Component
function MetricCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-[10px] text-slate-400 mt-1">{label}</p>
    </div>
  );
}

// Phase 138.3.2: Score Card Component
function ScoreCard({ label, score, icon }: { label: string; score: number; icon: string }) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-emerald-400";
    if (s >= 60) return "text-yellow-400";
    if (s >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return "bg-emerald-500/10 border-emerald-500/20";
    if (s >= 60) return "bg-yellow-500/10 border-yellow-500/20";
    if (s >= 40) return "bg-orange-500/10 border-orange-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  return (
    <div className={`rounded-lg p-4 text-center border ${getBgColor(score)}`}>
      <p className="text-2xl mb-2">{icon}</p>
      <p className={`text-2xl font-bold ${getColor(score)}`}>{score}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
