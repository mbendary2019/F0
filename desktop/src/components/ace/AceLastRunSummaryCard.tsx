// desktop/src/components/ace/AceLastRunSummaryCard.tsx
// =============================================================================
// Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)
// =============================================================================
// NOTE: This file is part of the locked Quality pipeline.
// Any major behavioral changes should be done in a new Phase (>= 150).
// =============================================================================
// Phase 148.0: ACE Last Run Summary Card
// Phase 148.1: Improved delta calculation using source-based snapshot matching
// Phase 147.2: Added targetedIssues and estimated debt display
// Phase 147.3: Added issuesBefore/issuesAfter/debtDelta from telemetry
// Phase 149: Added Code Evolution Engine button
// Phase 149.1: Added Trend Badge with UP/DOWN/FLAT indicators
// Phase 149.3: Added Narrative text based on trend
// Phase 149.5: Official UI Copy with NO_CHANGE state handling
// Shows summary of the most recent ACE run with debt reduction metrics

import React, { useMemo, useState } from 'react';
import { useAceTelemetry } from '../../contexts/aceTelemetryContext';
import { useQualityHistory } from '../../state/qualityHistoryContext';
import { formatDateAgo } from '../../lib/quality/qualityHistoryTypes';
import { CodeEvolutionEngineModal } from './CodeEvolutionEngineModal';
import { buildCodeEvolutionSummary } from '../../lib/quality/codeEvolutionEngine';
import type { EvolutionTrend } from '../../lib/quality/codeEvolutionTypes';
import { autoFixEngineCopy, codeEvolutionCopy } from '../../lib/quality/codeEvolutionCopy';

interface Props {
  locale?: 'ar' | 'en';
  projectRoot?: string;
}

/**
 * AceLastRunSummaryCard
 * Displays a summary of the most recent ACE run including:
 * - Files processed
 * - Patches applied
 * - Targeted issues (from plan)
 * - Estimated debt reduction
 *
 * Phase 148.1: Uses source-based snapshot matching for accurate delta:
 * - Before: Nearest 'scan' snapshot before run start
 * - After: Nearest 'auto_fix_after_scan' snapshot after run end
 *
 * Phase 147.2: Shows per-run targeted issues for meaningful metrics
 */
export const AceLastRunSummaryCard: React.FC<Props> = ({
  locale = 'en',
  projectRoot,
}) => {
  const { runs } = useAceTelemetry();
  const { snapshots, latestSnapshot } = useQualityHistory();
  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);

  const isArabic = locale === 'ar';

  // Phase 149.1: Compute evolution summary for trend badge
  const evolutionSummary = useMemo(() => {
    if (!runs || runs.length === 0 || !snapshots) return null;
    return buildCodeEvolutionSummary(runs, snapshots);
  }, [runs, snapshots]);

  // Phase 149.1: Trend Badge renderer (using centralized copy)
  const renderTrendBadge = (trend: EvolutionTrend) => {
    const trendCopy = codeEvolutionCopy.trend[trend];
    const config: Record<EvolutionTrend, { icon: string; color: string }> = {
      UP: { icon: '📈', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      DOWN: { icon: '📉', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
      FLAT: { icon: '➡️', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    };
    const c = config[trend];
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${c.color}`}>
        <span>{c.icon}</span>
        <span>{isArabic ? trendCopy.ar : trendCopy.en}</span>
      </span>
    );
  };

  // Get current health from latest snapshot
  const currentHealth = latestSnapshot?.health ?? 0;

  // Get the last run (optionally filtered by project)
  const lastRun = useMemo(() => {
    if (!runs || runs.length === 0) return null;
    if (projectRoot) {
      const projectRuns = runs.filter(r => r.projectRoot === projectRoot);
      return projectRuns.length > 0 ? projectRuns[0] : null;
    }
    return runs[0]; // runs are sorted newest first
  }, [runs, projectRoot]);

  // Phase 149.5: Determine run state for status messaging
  const runState = useMemo(() => {
    if (!lastRun) return 'NO_RUNS';
    if (lastRun.totalErrors > 0) return 'ERROR';
    if ((lastRun.totalApplied ?? 0) === 0) return 'NO_CHANGE';
    return 'IMPROVED';
  }, [lastRun]);

  // Phase 148.1: Calculate before/after issues using source-based matching
  // Phase 147.3: Prefer lastRun.issuesBefore from telemetry when available
  const { issuesBefore, issuesAfter } = useMemo(() => {
    if (!lastRun) {
      return { issuesBefore: null, issuesAfter: null, issuesDelta: null };
    }

    // Phase 147.3: Use telemetry values directly if available
    // debtDelta is auto-calculated in recordRun if issuesBefore & issuesAfter exist
    if (lastRun.debtDelta != null) {
      return {
        issuesBefore: lastRun.issuesBefore ?? null,
        issuesAfter: lastRun.issuesAfter ?? null,
        issuesDelta: lastRun.debtDelta,
      };
    }

    // Fallback to snapshot-based calculation (Phase 148.1)
    if (!snapshots || snapshots.length === 0) {
      // Still use telemetry issuesBefore if available
      return {
        issuesBefore: lastRun.issuesBefore ?? null,
        issuesAfter: null,
        issuesDelta: null,
      };
    }

    const runStart = new Date(lastRun.startedAt).getTime();
    const runEnd = new Date(lastRun.finishedAt || lastRun.startedAt).getTime();

    // 1) Prefer lastRun.issuesBefore, fallback to nearest 'scan' snapshot before run start
    let before: number | null = lastRun.issuesBefore ?? null;
    if (before === null) {
      const beforeCandidates = snapshots.filter((s) => {
        const t = new Date(s.createdAt).getTime();
        return s.source === 'scan' && t <= runStart;
      });
      const beforeSnap = beforeCandidates.length > 0
        ? beforeCandidates[beforeCandidates.length - 1]
        : null;
      before = beforeSnap?.totalIssues ?? null;
    }

    // 2) Find nearest 'auto_fix_after_scan' snapshot after run end
    const afterCandidates = snapshots.filter((s) => {
      const t = new Date(s.createdAt).getTime();
      return s.source === 'auto_fix_after_scan' && t >= runEnd;
    });
    const afterSnap = afterCandidates.length > 0
      ? afterCandidates[0]
      : null;

    const after = afterSnap?.totalIssues ?? null;

    // Calculate delta (positive = improvement)
    let delta: number | null = null;
    if (before !== null && after !== null) {
      delta = before - after;
    }

    return { issuesBefore: before, issuesAfter: after, issuesDelta: delta };
  }, [lastRun, snapshots]);

  // No runs yet - show empty state
  if (!lastRun) {
    const copy = autoFixEngineCopy.lastRun;
    return (
      <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-3 py-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-slate-200 text-xs">
            {isArabic ? copy.lastRunSummary.ar : copy.lastRunSummary.en}
          </span>
          <span className="text-[10px] text-slate-500">
            {isArabic ? copy.noRuns.ar : copy.noRuns.en}
          </span>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">
          {isArabic ? copy.noRunsHint.ar : copy.noRunsHint.en}
        </p>
      </div>
    );
  }

  // Format duration
  const durationSec = Math.round((lastRun.finishedAt
    ? new Date(lastRun.finishedAt).getTime() - new Date(lastRun.startedAt).getTime()
    : 0) / 1000);

  return (
    <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-950/80 to-fuchsia-950/20 px-3 py-2.5 shadow-lg shadow-fuchsia-500/5">
      {/* Header - Phase 147.2: Show duration instead of duplicate files count */}
      {/* Phase 149.1: Added trend badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-100 text-xs">
                {isArabic ? autoFixEngineCopy.lastRun.title.ar : autoFixEngineCopy.lastRun.title.en}
              </span>
              {evolutionSummary && renderTrendBadge(evolutionSummary.trend)}
            </div>
            <span className="text-[9px] text-slate-500">
              {formatDateAgo(lastRun.finishedAt || lastRun.startedAt, locale)}
            </span>
          </div>
        </div>
        <span className="rounded-full bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 text-[10px] font-medium text-slate-400">
          {durationSec}s
        </span>
      </div>

      {/* Phase 147.2: Stats Grid - 4 columns for meaningful metrics */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {/* Files Processed - Phase 149.6: Use centralized copy */}
        <div className="flex flex-col rounded-lg bg-slate-900/50 px-1.5 py-1.5">
          <span className="text-slate-500 text-[8px]">
            {isArabic ? autoFixEngineCopy.labels.files.ar : autoFixEngineCopy.labels.files.en}
          </span>
          <span className="text-sm font-semibold text-fuchsia-400">
            {lastRun.filesProcessed ?? 0}
          </span>
        </div>

        {/* Patches Applied - Phase 149.6: Use centralized copy */}
        <div className="flex flex-col rounded-lg bg-slate-900/50 px-1.5 py-1.5">
          <span className="text-slate-500 text-[8px]">
            {isArabic ? autoFixEngineCopy.labels.patches.ar : autoFixEngineCopy.labels.patches.en}
          </span>
          <span className="text-sm font-semibold text-emerald-400">
            {lastRun.totalApplied ?? 0}
          </span>
        </div>

        {/* Targeted Issues - Phase 147.2 - Phase 149.6: Use centralized copy */}
        <div className="flex flex-col rounded-lg bg-slate-900/50 px-1.5 py-1.5">
          <span className="text-slate-500 text-[8px]">
            {isArabic ? autoFixEngineCopy.labels.targeted.ar : autoFixEngineCopy.labels.targeted.en}
          </span>
          <span className="text-sm font-semibold text-amber-400">
            {lastRun.targetedIssues ?? '–'}
          </span>
        </div>

        {/* Estimated Debt Reduction - Phase 147.2: min(targetedIssues, totalApplied) - Phase 149.6: Use centralized copy */}
        <div className="flex flex-col rounded-lg bg-slate-900/50 px-1.5 py-1.5">
          <span className="text-slate-500 text-[8px]">
            {isArabic ? autoFixEngineCopy.labels.estReduction.ar : autoFixEngineCopy.labels.estReduction.en}
          </span>
          <span className="text-sm font-semibold text-sky-400">
            {lastRun.targetedIssues != null && lastRun.totalApplied != null
              ? Math.min(lastRun.targetedIssues, lastRun.totalApplied)
              : '–'}
          </span>
        </div>
      </div>

      {/* Phase 149.5/149.8: Status-specific messaging for NO_CHANGE (0 patches) */}
      {runState === 'NO_CHANGE' && (
        <div className="mt-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px]">ℹ️</span>
            <span className="text-[10px] font-medium text-amber-300">
              {isArabic ? autoFixEngineCopy.noSafeChanges.title.ar : autoFixEngineCopy.noSafeChanges.title.en}
            </span>
          </div>
          <p className="text-[9px] text-amber-200/70 leading-relaxed">
            {isArabic ? autoFixEngineCopy.noSafeChanges.description.ar : autoFixEngineCopy.noSafeChanges.description.en}
          </p>
        </div>
      )}

      {runState === 'ERROR' && (
        <div className="mt-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px]">⚠️</span>
            <span className="text-[10px] font-medium text-red-300">
              {isArabic ? autoFixEngineCopy.error.badge.ar : autoFixEngineCopy.error.badge.en}
            </span>
          </div>
          <p className="text-[9px] text-red-200/70 leading-relaxed">
            {isArabic ? autoFixEngineCopy.error.body.ar : autoFixEngineCopy.error.body.en}
          </p>
        </div>
      )}

      {runState === 'IMPROVED' && (
        <div className="mt-2 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px]">✅</span>
            <span className="text-[10px] font-medium text-emerald-300">
              {isArabic ? autoFixEngineCopy.improved.title.ar : autoFixEngineCopy.improved.title.en}
            </span>
          </div>
          <p className="text-[9px] text-emerald-200/70 leading-relaxed">
            {isArabic
              ? autoFixEngineCopy.improved.body.ar(lastRun.totalApplied ?? 0, lastRun.filesProcessed ?? 0)
              : autoFixEngineCopy.improved.body.en(lastRun.totalApplied ?? 0, lastRun.filesProcessed ?? 0)}
          </p>
        </div>
      )}

      {/* Phase 149.1/149.3: Narrative text based on trend (using centralized copy) */}
      {evolutionSummary && evolutionSummary.totalRuns > 0 && (
        <div className="mt-2 px-1 py-1 rounded-lg bg-slate-900/30 border border-slate-800/40">
          <p className="text-[9px] text-slate-400 leading-relaxed">
            {evolutionSummary.trend === 'UP' && (
              isArabic
                ? codeEvolutionCopy.narrative.UP.ar(evolutionSummary.improvedRuns, evolutionSummary.totalRuns)
                : codeEvolutionCopy.narrative.UP.en(evolutionSummary.improvedRuns, evolutionSummary.totalRuns)
            )}
            {evolutionSummary.trend === 'DOWN' && (
              isArabic ? codeEvolutionCopy.narrative.DOWN.ar : codeEvolutionCopy.narrative.DOWN.en
            )}
            {evolutionSummary.trend === 'FLAT' && (
              isArabic ? codeEvolutionCopy.narrative.FLAT.ar : codeEvolutionCopy.narrative.FLAT.en
            )}
          </p>
        </div>
      )}

      {/* Current issues footer - Phase 148.1: Show actual before/after from snapshots - Phase 149.6: Use centralized copy */}
      {issuesAfter !== null && (
        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-800/50 pt-1.5">
          <span>
            {isArabic ? autoFixEngineCopy.lastRun.currentIssues.ar : autoFixEngineCopy.lastRun.currentIssues.en}: {issuesAfter}
          </span>
          {issuesBefore !== null && (
            <span>
              {isArabic ? autoFixEngineCopy.lastRun.beforeRun.ar : autoFixEngineCopy.lastRun.beforeRun.en}: {issuesBefore}
            </span>
          )}
        </div>
      )}

      {/* Errors indicator */}
      {lastRun.totalErrors > 0 && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-amber-400">
          <span>⚠️</span>
          <span>
            {lastRun.totalErrors} {isArabic ? 'أخطاء' : 'errors'}
          </span>
        </div>
      )}

      {/* Phase 149: Evolution Engine button - Phase 149.6: Use centralized copy */}
      <div className="mt-2 pt-2 border-t border-slate-800/50">
        <button
          type="button"
          onClick={() => setShowEvolutionModal(true)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-[10px] text-slate-300 hover:text-white transition-colors"
        >
          <span>📊</span>
          <span>{isArabic ? autoFixEngineCopy.openEvolution.label.ar : autoFixEngineCopy.openEvolution.label.en}</span>
        </button>
      </div>

      {/* Phase 149: Code Evolution Modal */}
      <CodeEvolutionEngineModal
        isOpen={showEvolutionModal}
        onClose={() => setShowEvolutionModal(false)}
        locale={locale}
        aceRuns={runs}
        snapshots={snapshots}
        currentHealth={currentHealth}
        onRecompute={() => {
          setIsRecomputing(true);
          // Simulate recompute (data is already reactive)
          setTimeout(() => setIsRecomputing(false), 500);
        }}
        isRecomputing={isRecomputing}
      />
    </div>
  );
};

export default AceLastRunSummaryCard;
