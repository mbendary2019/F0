// desktop/src/components/ace/CodeEvolutionEngineModal.tsx
// =============================================================================
// Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)
// =============================================================================
// NOTE: This file is part of the locked Quality pipeline.
// Any major behavioral changes should be done in a new Phase (>= 150).
// =============================================================================
// Phase 149: Code Evolution Engine Modal
// Phase 149.2: Added Sparkline visualization for delta evolution
// Phase 149.4: Improved Recompute button with spinner and empty states
// Phase 149.6: Wiring & Consistency Sweep - Centralized copy usage
// Shows evolution summary with tabs for Overview, Plan, and Suggestions

import React, { useState, useMemo, useCallback } from 'react';
import {
  buildCodeEvolutionSummary,
  generateEvolutionSuggestions,
  generateEvolutionPlan,
  formatDuration,
  getTrendIcon,
  getStatusIcon,
  getStatusColorClass,
} from '../../lib/quality/codeEvolutionEngine';
import type {
  CodeEvolutionSummary,
  EvolutionSuggestion,
  EvolutionPlan,
} from '../../lib/quality/codeEvolutionTypes';
import type { AceRun } from '../../contexts/aceTelemetryContext';
import type { QualitySnapshot } from '../../lib/quality/qualityHistoryTypes';
import { codeEvolutionCopy } from '../../lib/quality/codeEvolutionCopy';

type TabId = 'overview' | 'plan' | 'suggestions';

interface CodeEvolutionEngineModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Locale for bilingual support */
  locale?: 'ar' | 'en';
  /** ACE runs from telemetry context */
  aceRuns: AceRun[];
  /** Code health snapshots */
  snapshots: QualitySnapshot[];
  /** Current health percentage */
  currentHealth: number;
  /** Handler to trigger ACE run */
  onRunAce?: () => void;
  /** Handler to recompute evolution */
  onRecompute?: () => void;
  /** Whether recompute is in progress */
  isRecomputing?: boolean;
}

/**
 * Code Evolution Engine Modal
 * Displays evolution summary, plan, and suggestions
 */
export const CodeEvolutionEngineModal: React.FC<CodeEvolutionEngineModalProps> = ({
  isOpen,
  onClose,
  locale = 'en',
  aceRuns,
  snapshots,
  currentHealth,
  onRunAce,
  onRecompute,
  isRecomputing = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const isAr = locale === 'ar';

  // Compute evolution summary
  const summary = useMemo(
    () => buildCodeEvolutionSummary(aceRuns, snapshots),
    [aceRuns, snapshots]
  );

  // Generate suggestions
  const suggestions = useMemo(
    () => generateEvolutionSuggestions(summary, currentHealth),
    [summary, currentHealth]
  );

  // Generate plan
  const plan = useMemo(
    () => generateEvolutionPlan(summary, currentHealth),
    [summary, currentHealth]
  );

  const handleRecompute = useCallback(() => {
    onRecompute?.();
  }, [onRecompute]);

  if (!isOpen) return null;

  // Phase 149.6: Use centralized copy for tabs
  const tabs: { id: TabId; label: string; labelAr: string }[] = [
    { id: 'overview', label: codeEvolutionCopy.tabs.overview.en, labelAr: codeEvolutionCopy.tabs.overview.ar },
    { id: 'plan', label: codeEvolutionCopy.tabs.plan.en, labelAr: codeEvolutionCopy.tabs.plan.ar },
    { id: 'suggestions', label: codeEvolutionCopy.tabs.suggestions.en, labelAr: codeEvolutionCopy.tabs.suggestions.ar },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`
          relative w-full max-w-2xl max-h-[85vh] overflow-hidden
          rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
          border border-white/10 shadow-2xl
          ${isAr ? 'rtl' : 'ltr'}
        `}
      >
        {/* Header - Phase 149.6: Use centralized copy */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isAr ? codeEvolutionCopy.title.ar : codeEvolutionCopy.title.en}
              </h2>
              <p className="text-xs text-gray-400">
                {isAr
                  ? `${summary.totalRuns} تشغيل · ${summary.improvedRuns} تحسين`
                  : `${summary.totalRuns} runs · ${summary.improvedRuns} improvements`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Phase 149.4: Improved Recompute button with spinner */}
            <button
              type="button"
              onClick={handleRecompute}
              disabled={isRecomputing}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200 flex items-center gap-1.5
                ${isRecomputing
                  ? 'bg-blue-500/20 text-blue-300 cursor-wait'
                  : 'bg-blue-500/30 text-blue-200 hover:bg-blue-500/40'
                }
              `}
            >
              {isRecomputing ? (
                <>
                  <svg
                    className="animate-spin h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{isAr ? codeEvolutionCopy.buttons.computing.ar : codeEvolutionCopy.buttons.computing.en}</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>{isAr ? codeEvolutionCopy.buttons.recompute.ar : codeEvolutionCopy.buttons.recompute.en}</span>
                </>
              )}
            </button>
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'text-white border-b-2 border-blue-500 bg-white/5'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {isAr ? tab.labelAr : tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              summary={summary}
              currentHealth={currentHealth}
              locale={locale}
            />
          )}
          {activeTab === 'plan' && (
            <PlanTab plan={plan} locale={locale} />
          )}
          {activeTab === 'suggestions' && (
            <SuggestionsTab
              suggestions={suggestions}
              locale={locale}
              onRunAce={onRunAce}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Overview Tab Content
 */
const OverviewTab: React.FC<{
  summary: CodeEvolutionSummary;
  currentHealth: number;
  locale: 'ar' | 'en';
}> = ({ summary, currentHealth, locale }) => {
  const isAr = locale === 'ar';

  return (
    <div className="space-y-6">
      {/* Stats Grid - Phase 149.6: Use centralized copy */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={isAr ? codeEvolutionCopy.metrics.runsAnalyzed.ar : codeEvolutionCopy.metrics.runsAnalyzed.en}
          value={summary.totalRuns}
          icon="🔄"
        />
        <StatCard
          label={isAr ? codeEvolutionCopy.metrics.improvedRuns.ar : codeEvolutionCopy.metrics.improvedRuns.en}
          value={summary.improvedRuns}
          icon="✅"
          color="emerald"
        />
        <StatCard
          label={isAr ? codeEvolutionCopy.metrics.totalResolved.ar : codeEvolutionCopy.metrics.totalResolved.en}
          value={summary.totalDelta}
          icon={summary.totalDelta <= 0 ? '📉' : '📈'}
          color={summary.totalDelta <= 0 ? 'emerald' : 'amber'}
        />
        <StatCard
          label={isAr ? codeEvolutionCopy.metrics.evolutionTrend.ar : codeEvolutionCopy.metrics.evolutionTrend.en}
          value={getTrendIcon(summary.trend)}
          subValue={
            summary.trend === 'UP'
              ? isAr ? codeEvolutionCopy.trend.UP.ar : codeEvolutionCopy.trend.UP.en
              : summary.trend === 'DOWN'
                ? isAr ? codeEvolutionCopy.trend.DOWN.ar : codeEvolutionCopy.trend.DOWN.en
                : isAr ? codeEvolutionCopy.trend.FLAT.ar : codeEvolutionCopy.trend.FLAT.en
          }
          icon=""
        />
      </div>

      {/* Current Health - Phase 149.6: Use centralized copy */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">
            {isAr ? codeEvolutionCopy.metrics.currentHealth.ar : codeEvolutionCopy.metrics.currentHealth.en}
          </span>
          <span className="text-lg font-semibold text-white">{currentHealth}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              currentHealth >= 80
                ? 'bg-emerald-500'
                : currentHealth >= 60
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${currentHealth}%` }}
          />
        </div>
      </div>

      {/* Phase 149.2: Delta Sparkline - Phase 149.6: Use centralized copy */}
      {summary.runs.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              {isAr ? codeEvolutionCopy.metrics.deltaEvolution.ar : codeEvolutionCopy.metrics.deltaEvolution.en}
            </span>
            <span className="text-xs text-gray-500">
              {isAr ? codeEvolutionCopy.metrics.last10Runs.ar : codeEvolutionCopy.metrics.last10Runs.en}
            </span>
          </div>
          <div className="flex justify-center">
            <Sparkline
              data={summary.runs.slice(-10).map((r) => r.delta)}
              width={280}
              height={50}
              locale={locale}
            />
          </div>
        </div>
      )}

      {/* Recent Runs - Phase 149.6: Use centralized copy */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          {isAr ? codeEvolutionCopy.metrics.recentRuns.ar : codeEvolutionCopy.metrics.recentRuns.en}
        </h3>
        {summary.runs.length === 0 ? (
          /* Phase 149.4: Improved empty state - Phase 149.6: Use centralized copy */
          <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl bg-white/5 border border-white/10 border-dashed">
            <div className="text-4xl mb-3">🚀</div>
            <p className="text-sm font-medium text-gray-300 text-center mb-1">
              {isAr ? codeEvolutionCopy.empty.title.ar : codeEvolutionCopy.empty.title.en}
            </p>
            <p className="text-xs text-gray-500 text-center max-w-xs">
              {isAr ? codeEvolutionCopy.empty.hint.ar : codeEvolutionCopy.empty.hint.en}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {summary.runs.slice(-5).reverse().map((run) => (
              <div
                key={run.aceRunId}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getStatusIcon(run.status)}</span>
                  <div>
                    <p className="text-sm text-white">
                      {formatDuration(run.durationMs, isAr)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(run.startedAt).toLocaleString(isAr ? 'ar' : 'en')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${getStatusColorClass(run.status)}`}>
                    {run.delta !== null
                      ? run.delta > 0
                        ? `+${run.delta}`
                        : run.delta
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {run.appliedPatches} {isAr ? 'باتش' : 'patches'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Plan Tab Content
 */
const PlanTab: React.FC<{
  plan: EvolutionPlan;
  locale: 'ar' | 'en';
}> = ({ plan, locale }) => {
  const isAr = locale === 'ar';

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">
            {isAr ? 'تقدم الخطة' : 'Plan Progress'}
          </span>
          <span className="text-lg font-semibold text-white">
            {Math.round(plan.progress)}%
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${plan.progress}%` }}
          />
        </div>
        {plan.estimatedRunsToTarget > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {isAr
              ? `~${plan.estimatedRunsToTarget} تشغيل للوصول للهدف`
              : `~${plan.estimatedRunsToTarget} runs to reach target`}
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {plan.steps.map((step) => (
          <div
            key={step.step}
            className={`
              p-4 rounded-xl border transition-all
              ${step.completed
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-white/5 border-white/10'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${step.completed
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                  }
                `}
              >
                {step.completed ? '✓' : step.step}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">
                  {isAr ? step.titleAr : step.title}
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  {isAr ? step.descriptionAr : step.description}
                </p>
                {step.metric && (
                  <div className="mt-2 text-xs">
                    <span className="text-gray-500">
                      {isAr ? step.metric.labelAr : step.metric.label}:
                    </span>{' '}
                    <span className="text-white font-medium">{step.metric.value}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Suggestions Tab Content
 */
const SuggestionsTab: React.FC<{
  suggestions: EvolutionSuggestion[];
  locale: 'ar' | 'en';
  onRunAce?: () => void;
}> = ({ suggestions, locale, onRunAce }) => {
  const isAr = locale === 'ar';

  const priorityColors = {
    high: 'border-red-500/30 bg-red-500/10',
    medium: 'border-amber-500/30 bg-amber-500/10',
    low: 'border-blue-500/30 bg-blue-500/10',
  };

  const priorityLabels = {
    high: isAr ? 'عالي' : 'High',
    medium: isAr ? 'متوسط' : 'Medium',
    low: isAr ? 'منخفض' : 'Low',
  };

  return (
    <div className="space-y-4">
      {suggestions.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-4xl">🎉</span>
          <p className="text-sm text-gray-400 mt-2">
            {isAr ? 'لا توجد اقتراحات حالياً' : 'No suggestions at this time'}
          </p>
        </div>
      ) : (
        suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={`
              p-4 rounded-xl border transition-all
              ${priorityColors[suggestion.priority]}
            `}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`
                      px-2 py-0.5 rounded text-[10px] font-medium uppercase
                      ${suggestion.priority === 'high'
                        ? 'bg-red-500/30 text-red-200'
                        : suggestion.priority === 'medium'
                          ? 'bg-amber-500/30 text-amber-200'
                          : 'bg-blue-500/30 text-blue-200'
                      }
                    `}
                  >
                    {priorityLabels[suggestion.priority]}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-white">
                  {isAr ? suggestion.titleAr : suggestion.title}
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  {isAr ? suggestion.descriptionAr : suggestion.description}
                </p>
              </div>
              {suggestion.action === 'runAce' && onRunAce && (
                <button
                  type="button"
                  onClick={onRunAce}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/30 text-emerald-200 text-xs font-medium hover:bg-emerald-500/40 transition-colors"
                >
                  {isAr ? 'شغّل' : 'Run'}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

/**
 * Phase 149.2: Sparkline Component
 * Visualizes run deltas as a mini line chart
 */
const Sparkline: React.FC<{
  data: (number | null)[];
  width?: number;
  height?: number;
  locale?: 'ar' | 'en';
}> = ({ data, width = 180, height = 40, locale = 'en' }) => {
  const isAr = locale === 'ar';

  // Filter out nulls and get valid values
  const validData = data.filter((d): d is number => d !== null);

  if (validData.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-gray-500"
        style={{ width, height }}
      >
        {isAr ? codeEvolutionCopy.sparkline.notEnoughData.ar : codeEvolutionCopy.sparkline.notEnoughData.en}
      </div>
    );
  }

  // Calculate bounds
  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;

  // Build SVG path
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = validData.map((val, i) => {
    const x = padding + (i / (validData.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((val - min) / range) * chartHeight;
    return { x, y, val };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  // Determine line color based on trend (last vs first)
  const trendUp = validData[validData.length - 1] < validData[0]; // negative delta = improvement
  const strokeColor = trendUp ? '#10b981' : validData[validData.length - 1] > validData[0] ? '#f43f5e' : '#6b7280';

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Zero line */}
        {min < 0 && max > 0 && (
          <line
            x1={padding}
            y1={padding + chartHeight - ((0 - min) / range) * chartHeight}
            x2={width - padding}
            y2={padding + chartHeight - ((0 - min) / range) * chartHeight}
            stroke="#4b5563"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
        {/* Line path */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={p.val < 0 ? '#10b981' : p.val > 0 ? '#f43f5e' : '#6b7280'}
            stroke="#1f2937"
            strokeWidth={1}
          />
        ))}
      </svg>
      {/* Labels - Phase 149.6: Use centralized copy */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[8px] text-gray-500">
        <span>{isAr ? codeEvolutionCopy.sparkline.oldest.ar : codeEvolutionCopy.sparkline.oldest.en}</span>
        <span>{isAr ? codeEvolutionCopy.sparkline.latest.ar : codeEvolutionCopy.sparkline.latest.en}</span>
      </div>
    </div>
  );
};

/**
 * Stat Card Component
 */
const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: string;
  color?: 'emerald' | 'amber' | 'blue' | 'red';
  subValue?: string;
}> = ({ label, value, icon, color, subValue }) => {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30',
    amber: 'bg-amber-500/10 border-amber-500/30',
    blue: 'bg-blue-500/10 border-blue-500/30',
    red: 'bg-red-500/10 border-red-500/30',
  };

  return (
    <div
      className={`
        p-3 rounded-xl border
        ${color ? colorClasses[color] : 'bg-white/5 border-white/10'}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
    </div>
  );
};

export default CodeEvolutionEngineModal;
