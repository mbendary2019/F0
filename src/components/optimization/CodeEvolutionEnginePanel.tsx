// src/components/optimization/CodeEvolutionEnginePanel.tsx
// Phase 138.5.1: ACE (Autonomous Code Evolution) Engine UI Panel
// Displays ACE trigger info and suggested actions from optimization data

"use client";

import { useState, useMemo } from "react";
import type { OptimizationRun, AceTriggerLevel } from "@/lib/optimization/types";
import { buildAceEvolutionPrompt } from "@/lib/optimization/acePromptBuilder";

interface CodeEvolutionEnginePanelProps {
  run: OptimizationRun;
  projectName?: string;
  locale?: string;
  onLaunchAce?: (prompt: string) => void;
}

/**
 * ACE level configuration for styling
 */
const ACE_LEVEL_CONFIG: Record<
  AceTriggerLevel,
  { label: { en: string; ar: string }; color: string; icon: string; bgGlow: string }
> = {
  none: {
    label: { en: "No Action Needed", ar: "لا حاجة للتدخل" },
    color: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    icon: "✓",
    bgGlow: "",
  },
  low: {
    label: { en: "Minor Improvements", ar: "تحسينات طفيفة" },
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    icon: "💡",
    bgGlow: "",
  },
  medium: {
    label: { en: "Recommended Action", ar: "إجراء موصى به" },
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    icon: "⚠️",
    bgGlow: "shadow-amber-500/10",
  },
  high: {
    label: { en: "Critical Action Required", ar: "إجراء حرج مطلوب" },
    color: "bg-red-500/20 text-red-300 border-red-500/30",
    icon: "🚨",
    bgGlow: "shadow-red-500/20 shadow-lg",
  },
};

export function CodeEvolutionEnginePanel({
  run,
  projectName = "Project",
  locale = "en",
  onLaunchAce,
}: CodeEvolutionEnginePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const isRTL = locale === "ar";
  const t = (en: string, ar: string) => (locale === "ar" ? ar : en);

  // Build ACE prompt using the builder
  const acePrompt = useMemo(() => {
    return buildAceEvolutionPrompt({
      run,
      projectName,
      locale,
    });
  }, [run, projectName, locale]);

  // Get ACE level config
  const aceLevel = run.ace?.level || "none";
  const levelConfig = ACE_LEVEL_CONFIG[aceLevel];
  const levelLabel = levelConfig.label[locale as "en" | "ar"] || levelConfig.label.en;

  // Don't show panel if ACE level is none and no reasons
  if (aceLevel === "none" && (!run.ace?.reasons || run.ace.reasons.length === 0)) {
    return null;
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(acePrompt.userPrompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  const handleLaunchAce = () => {
    if (onLaunchAce) {
      onLaunchAce(acePrompt.userPrompt);
    }
  };

  return (
    <div
      className={`rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 p-5 ${levelConfig.bgGlow} ${
        isRTL ? "text-right" : ""
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <span className="text-xl">{levelConfig.icon}</span>
          <h3 className="text-sm font-semibold text-slate-200">
            {t("Code Evolution Engine", "محرك تطوير الكود")}
          </h3>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${levelConfig.color}`}>
          {levelLabel}
        </span>
      </div>

      {/* ACE Trigger Reasons */}
      {run.ace?.reasons && run.ace.reasons.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2">
            {t("Why ACE is suggested:", "لماذا ACE مقترح:")}
          </p>
          <ul className={`space-y-1 ${isRTL ? "pr-3" : "pl-3"}`}>
            {run.ace.reasons.map((reason, idx) => (
              <li
                key={idx}
                className={`text-xs text-slate-300 flex items-start gap-2 ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <span className="text-slate-500 mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Actions */}
      {acePrompt.suggestedActions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2">
            {t("Suggested Actions:", "الإجراءات المقترحة:")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {acePrompt.suggestedActions.slice(0, 4).map((action, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-1 rounded-md bg-slate-700/50 text-xs text-slate-300 border border-slate-600/30"
              >
                {action}
              </span>
            ))}
            {acePrompt.suggestedActions.length > 4 && (
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-700/50 text-xs text-slate-400">
                +{acePrompt.suggestedActions.length - 4} {t("more", "أكثر")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expandable Prompt Preview */}
      <div className="mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition ${
            isRTL ? "flex-row-reverse" : ""
          }`}
        >
          <span>{isExpanded ? "▼" : "▶"}</span>
          <span>{t("View ACE Prompt", "عرض موجه ACE")}</span>
        </button>

        {isExpanded && (
          <div className="mt-2 relative">
            <pre className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/50 text-xs text-slate-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
              {acePrompt.userPrompt}
            </pre>
            <button
              onClick={handleCopyPrompt}
              className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} px-2 py-1 rounded bg-slate-700/80 text-xs text-slate-300 hover:bg-slate-600 transition`}
            >
              {isCopied ? t("Copied!", "تم النسخ!") : t("Copy", "نسخ")}
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
        {onLaunchAce && aceLevel !== "none" && (
          <button
            onClick={handleLaunchAce}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${
              aceLevel === "high"
                ? "bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/30"
                : aceLevel === "medium"
                ? "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-500/30"
                : "bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 border border-purple-500/30"
            }`}
          >
            <span>🚀</span>
            <span>{t("Launch ACE", "تشغيل ACE")}</span>
          </button>
        )}

        <button
          onClick={handleCopyPrompt}
          className="px-4 py-2.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 text-sm transition border border-slate-600/30"
        >
          {t("Copy Prompt", "نسخ الموجه")}
        </button>
      </div>

      {/* Priority Indicator */}
      <div className={`mt-3 pt-3 border-t border-white/5 ${isRTL ? "text-left" : "text-right"}`}>
        <span className="text-[10px] text-slate-500">
          {t("Priority:", "الأولوية:")}{" "}
          <span
            className={
              acePrompt.priority === "critical"
                ? "text-red-400"
                : acePrompt.priority === "high"
                ? "text-amber-400"
                : acePrompt.priority === "medium"
                ? "text-blue-400"
                : "text-slate-400"
            }
          >
            {acePrompt.priority.toUpperCase()}
          </span>
        </span>
      </div>
    </div>
  );
}
