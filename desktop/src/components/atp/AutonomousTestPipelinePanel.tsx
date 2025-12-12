// desktop/src/components/atp/AutonomousTestPipelinePanel.tsx
// Phase 140.5: Autonomous Test Pipeline Panel
// Phase 140.5.1: Added Open button for fixes + Insert with file write & ATP rerun
// UI Panel for ATP - displays status, controls, and results

'use client';

import React, { useMemo, useState } from 'react';
import {
  useTestCycle,
  useTestCycleMetrics,
  useTestCycleLogs,
} from '../../lib/atp/TestCycleContext';
import type { SuggestedFix } from '../../lib/atp/failingTestTypes';
import type { GeneratedTestSuggestion } from '../../lib/atp/amtgTypes';

// Phase 140.5.1: Type declaration for f0Desktop API
declare global {
  interface Window {
    f0Desktop?: {
      openFileInEditor?: (
        filePath: string,
        line?: number,
        column?: number,
      ) => Promise<void> | void;
      writeFile?: (filePath: string, content: string) => Promise<void> | void;
      fileExists?: (filePath: string) => Promise<boolean> | boolean;
    };
  }
}

// Phase 140.5.1: Helper to open file in editor at specific location
async function openLocationInEditor(
  filePath?: string | null,
  line?: number | null,
  column?: number | null,
) {
  if (!filePath) {
    console.warn('[ATP] No filePath provided for openLocationInEditor');
    return;
  }

  const api = window.f0Desktop;
  if (!api?.openFileInEditor) {
    console.warn('[ATP] f0Desktop.openFileInEditor not available');
    return;
  }

  try {
    await api.openFileInEditor(
      filePath,
      line ?? undefined,
      column ?? undefined,
    );
    console.log('[ATP] Opened file in editor:', filePath, line);
  } catch (err) {
    console.error('[ATP] Failed to open file in editor', err);
  }
}

// Phase 140.5.1: Helper to insert generated test file and rerun ATP
async function insertGeneratedTestAndRerun(
  suggestion: GeneratedTestSuggestion,
  rerun: () => void,
) {
  const api = window.f0Desktop;
  if (!api?.writeFile) {
    console.warn('[ATP] f0Desktop.writeFile not available');
    return;
  }

  const testFilePath = suggestion.testFilePath;
  if (!testFilePath) {
    console.warn('[ATP] No testFilePath on suggestion', suggestion);
    return;
  }

  // Get the test content
  const content = suggestion.content || '// TODO: generated test code is missing';

  try {
    // Check if file already exists
    if (api.fileExists) {
      const exists = await api.fileExists(testFilePath);
      if (exists) {
        console.warn(
          '[ATP] Test file already exists, opening instead',
          testFilePath,
        );
        await api.openFileInEditor?.(testFilePath);
        return;
      }
    }

    // Write the test file
    await api.writeFile(testFilePath, content);
    console.log('[ATP] Inserted generated test file at', testFilePath);

    // Open the file after creation
    await api.openFileInEditor?.(testFilePath);

    // Rerun ATP cycle
    rerun();
  } catch (err) {
    console.error('[ATP] Failed to insert generated test', err);
  }
}

interface AutonomousTestPipelinePanelProps {
  /** Locale for labels */
  locale?: 'en' | 'ar';
  /** Additional class names */
  className?: string;
  /** Callback when user wants to apply a fix */
  onApplyFix?: (fix: SuggestedFix) => void;
  /** Callback when user wants to insert a generated test */
  onInsertTest?: (suggestion: GeneratedTestSuggestion) => void;
}

/**
 * AutonomousTestPipelinePanel
 * Phase 140.5: UI Panel for the ATP system
 * Phase 140.5.1: Added Open/Insert buttons with f0Desktop integration
 *
 * Features:
 * - Run ATP button (manual trigger)
 * - Cancel button when cycle is running
 * - View Logs toggle
 * - Summary badges (Coverage, Tests, Fails, Auto Tests, Fixes)
 * - Suggested Fixes list with Open button
 * - Auto-Generated Tests list with Insert button
 */
export const AutonomousTestPipelinePanel: React.FC<
  AutonomousTestPipelinePanelProps
> = ({ locale = 'en', className = '', onApplyFix, onInsertTest }) => {
  const {
    activeCycle,
    lastCompletedCycle,
    isActive,
    startCycle,
    cancelActiveCycle,
  } = useTestCycle();

  const metrics = useTestCycleMetrics();
  const logs = useTestCycleLogs();

  // UI state
  const [showLogs, setShowLogs] = useState(false);
  const [expandedFixes, setExpandedFixes] = useState<Set<string>>(new Set());
  // Phase 140.5.1: Track which test is being inserted
  const [insertingId, setInsertingId] = useState<string | null>(null);

  const isArabic = locale === 'ar';

  // Labels
  const labels = {
    title: isArabic ? '🤖 خط الاختبار الآلي' : '🤖 Autonomous Test Pipeline',
    runAtp: isArabic ? 'تشغيل ATP' : 'Run ATP',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    viewLogs: isArabic ? 'عرض السجلات' : 'View Logs',
    hideLogs: isArabic ? 'إخفاء السجلات' : 'Hide Logs',
    noData: isArabic ? 'لا توجد بيانات بعد' : 'No data yet',
    runHint: isArabic ? 'شغّل ATP لتحليل الاختبارات' : 'Run ATP to analyze tests',
    coverage: isArabic ? 'التغطية' : 'Coverage',
    tests: isArabic ? 'الاختبارات' : 'Tests',
    failing: isArabic ? 'فاشل' : 'Failing',
    autoTests: isArabic ? 'اختبارات آلية' : 'Auto Tests',
    fixes: isArabic ? 'إصلاحات' : 'Fixes',
    suggestedFixes: isArabic ? 'إصلاحات مقترحة' : 'Suggested Fixes',
    generatedTests: isArabic ? 'اختبارات مولّدة' : 'Generated Tests',
    applyFix: isArabic ? 'تطبيق' : 'Apply',
    openFile: isArabic ? 'فتح' : 'Open',
    insertTest: isArabic ? 'إدراج' : 'Insert',
    inserting: isArabic ? 'جاري...' : 'Inserting…',
    phase: isArabic ? 'المرحلة' : 'Phase',
    insights: isArabic ? 'رؤى' : 'Insights',
  };

  // Current phase
  const currentPhase = activeCycle?.phase ?? lastCompletedCycle?.phase ?? 'idle';

  // Phase display
  const phaseDisplay = useMemo(() => {
    const phaseMap: Record<
      string,
      { icon: string; label: string; color: string }
    > = {
      idle: {
        icon: '⏸️',
        label: isArabic ? 'جاهز' : 'Idle',
        color: 'text-gray-400',
      },
      queued: {
        icon: '⏳',
        label: isArabic ? 'في الانتظار' : 'Queued',
        color: 'text-amber-400',
      },
      running: {
        icon: '🔄',
        label: isArabic ? 'يعمل' : 'Running',
        color: 'text-blue-400',
      },
      analyzing: {
        icon: '🔍',
        label: isArabic ? 'يحلل' : 'Analyzing',
        color: 'text-purple-400',
      },
      finished: {
        icon: '✅',
        label: isArabic ? 'انتهى' : 'Finished',
        color: 'text-emerald-400',
      },
      error: {
        icon: '❌',
        label: isArabic ? 'خطأ' : 'Error',
        color: 'text-red-400',
      },
      canceled: {
        icon: '🚫',
        label: isArabic ? 'ملغي' : 'Canceled',
        color: 'text-orange-400',
      },
    };
    return phaseMap[currentPhase] ?? phaseMap.idle;
  }, [currentPhase, isArabic]);

  // Handle run ATP
  const handleRunAtp = () => {
    startCycle({ trigger: 'manual' });
  };

  // Handle cancel
  const handleCancel = () => {
    cancelActiveCycle('User canceled from ATP Panel');
  };

  // Toggle fix expansion
  const toggleFixExpanded = (fixId: string) => {
    setExpandedFixes((prev) => {
      const next = new Set(prev);
      if (next.has(fixId)) {
        next.delete(fixId);
      } else {
        next.add(fixId);
      }
      return next;
    });
  };

  // Phase 140.5.1: Handle insert test with file write and ATP rerun
  const handleInsertTest = async (suggestion: GeneratedTestSuggestion) => {
    setInsertingId(suggestion.id);

    await insertGeneratedTestAndRerun(suggestion, () => {
      // Rerun ATP after writing the test
      startCycle({
        trigger: 'manual',
        context: { source: 'atp-insert-test', suggestionId: suggestion.id },
        timeoutMs: 120_000,
      });
    });

    setInsertingId(null);

    // Also call the external callback if provided
    if (onInsertTest) {
      onInsertTest(suggestion);
    }
  };

  // Get suggested fixes from metrics
  const suggestedFixes = metrics.suggestedFixes ?? [];
  const autoTestsGenerated = metrics.autoTestsGenerated ?? [];

  // Coverage delta display
  const coverageDelta = metrics.coverageDeltaPct ?? 0;
  const coverageDeltaDisplay =
    coverageDelta > 0
      ? `+${coverageDelta.toFixed(1)}%`
      : `${coverageDelta.toFixed(1)}%`;
  const coverageDeltaColor =
    coverageDelta > 0
      ? 'text-emerald-400'
      : coverageDelta < 0
        ? 'text-red-400'
        : 'text-gray-400';

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#e0dbff]">{labels.title}</h3>
        <span className={`text-xs ${phaseDisplay.color} flex items-center gap-1`}>
          <span>{phaseDisplay.icon}</span>
          <span>{phaseDisplay.label}</span>
        </span>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        {!isActive ? (
          <button
            onClick={handleRunAtp}
            className="flex-1 px-3 py-2 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 border border-[#7c3aed]/30 rounded-lg text-xs text-[#c4b5fd] font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <span>▶️</span>
            <span>{labels.runAtp}</span>
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-xs text-red-300 font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <span>⏹️</span>
            <span>{labels.cancel}</span>
          </button>
        )}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="px-3 py-2 bg-[#1a1a2e]/60 hover:bg-[#251347]/60 border border-[#251347]/50 rounded-lg text-xs text-[#6b5f8a] hover:text-[#c4b5fd] transition-colors"
        >
          {showLogs ? labels.hideLogs : labels.viewLogs}
        </button>
      </div>

      {/* Summary Badges */}
      {(metrics.testsRun !== undefined ||
        metrics.coverageDeltaPct !== undefined) && (
        <div className="grid grid-cols-5 gap-1.5">
          {/* Coverage Δ */}
          <div className="bg-[#1a1a2e]/60 rounded-lg p-2 text-center">
            <div className={`text-sm font-bold ${coverageDeltaColor}`}>
              {coverageDeltaDisplay}
            </div>
            <div className="text-[9px] text-[#6b5f8a]">{labels.coverage}</div>
          </div>
          {/* Tests */}
          <div className="bg-[#1a1a2e]/60 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-[#e0dbff]">
              {metrics.testsRun ?? 0}
            </div>
            <div className="text-[9px] text-[#6b5f8a]">{labels.tests}</div>
          </div>
          {/* Failing */}
          <div className="bg-red-500/10 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-red-400">
              {metrics.testsFailed ?? 0}
            </div>
            <div className="text-[9px] text-red-400/70">{labels.failing}</div>
          </div>
          {/* Auto Tests */}
          <div className="bg-purple-500/10 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-purple-400">
              {metrics.autoTestsGeneratedCount ?? 0}
            </div>
            <div className="text-[9px] text-purple-400/70">{labels.autoTests}</div>
          </div>
          {/* Fixes */}
          <div className="bg-amber-500/10 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-amber-400">
              {suggestedFixes.length}
            </div>
            <div className="text-[9px] text-amber-400/70">{labels.fixes}</div>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {metrics.failingTestsSummary &&
        metrics.failingTestsSummary.totalFailures > 0 && (
          <div className="bg-[#251347]/30 rounded-lg p-2.5 border border-[#251347]/50">
            <div className="text-[10px] font-semibold text-[#a89fd4] mb-1.5">
              💡 {labels.insights}
            </div>
            <div className="text-[10px] text-[#6b5f8a]">
              {isArabic
                ? `${metrics.failingTestsSummary.totalFailures} اختبار فاشل في ${metrics.failingTestsSummary.suitesWithFailures.length} مجموعة`
                : `${metrics.failingTestsSummary.totalFailures} failing test(s) in ${metrics.failingTestsSummary.suitesWithFailures.length} suite(s)`}
            </div>
            {metrics.coverageRegressionCount &&
              metrics.coverageRegressionCount > 0 && (
                <div className="text-[10px] text-red-400/80 mt-1">
                  ⚠️{' '}
                  {isArabic
                    ? `${metrics.coverageRegressionCount} ملف بتراجع في التغطية`
                    : `${metrics.coverageRegressionCount} file(s) with coverage regression`}
                </div>
              )}
            {metrics.highRiskUntestedCount &&
              metrics.highRiskUntestedCount > 0 && (
                <div className="text-[10px] text-amber-400/80 mt-1">
                  🎯{' '}
                  {isArabic
                    ? `${metrics.highRiskUntestedCount} ملف عالي الخطورة بدون اختبار`
                    : `${metrics.highRiskUntestedCount} high-risk file(s) untested`}
                </div>
              )}
          </div>
        )}

      {/* Logs Section */}
      {showLogs && (
        <div className="bg-[#0d0d1a] rounded-lg p-2 border border-[#251347]/30 max-h-32 overflow-y-auto font-mono text-[10px]">
          {logs.length === 0 ? (
            <div className="text-[#6b5f8a] text-center py-2">{labels.noData}</div>
          ) : (
            logs.slice(-20).map((log) => (
              <div
                key={log.id}
                className={`py-0.5 ${
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'warn'
                      ? 'text-amber-400'
                      : log.level === 'debug'
                        ? 'text-gray-500'
                        : 'text-[#6b5f8a]'
                }`}
              >
                <span className="text-[#6b5f8a]/50">
                  {new Date(log.ts).toLocaleTimeString()}
                </span>{' '}
                {log.message}
              </div>
            ))
          )}
        </div>
      )}

      {/* Suggested Fixes */}
      {suggestedFixes.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-amber-400/90 flex items-center gap-1">
            <span>🔧</span>
            <span>
              {labels.suggestedFixes} ({suggestedFixes.length})
            </span>
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {suggestedFixes.map((fix) => (
              <div
                key={fix.id}
                className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-medium text-amber-300 truncate cursor-pointer hover:text-amber-200"
                      onClick={() => toggleFixExpanded(fix.id)}
                    >
                      {expandedFixes.has(fix.id) ? '▼' : '▶'} {fix.testName}
                    </div>
                    <div className="text-amber-400/60 truncate text-[10px]">
                      {fix.shortReason}
                    </div>
                  </div>
                  {/* Phase 140.5.1: Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Open button - always show if we have a location */}
                    <button
                      onClick={() =>
                        openLocationInEditor(
                          fix.sourceLocation?.filePath ??
                            fix.testLocation?.filePath ??
                            null,
                          fix.sourceLocation?.line ??
                            fix.testLocation?.line ??
                            null,
                          fix.sourceLocation?.column ??
                            fix.testLocation?.column ??
                            null,
                        )
                      }
                      className="px-2 py-1 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded text-[10px] font-medium transition-colors"
                      title={isArabic ? 'فتح في المحرر' : 'Open in editor'}
                    >
                      {labels.openFile}
                    </button>
                    {/* Apply button - only if patch available */}
                    {onApplyFix && fix.patch && (
                      <button
                        onClick={() => onApplyFix(fix)}
                        className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-medium transition-colors"
                      >
                        {labels.applyFix}
                      </button>
                    )}
                  </div>
                </div>
                {/* Expanded details */}
                {expandedFixes.has(fix.id) && (
                  <div className="mt-2 pt-2 border-t border-amber-500/20">
                    <div className="text-[10px] text-amber-400/70">
                      {fix.testLocation?.filePath && (
                        <div>
                          📁 {fix.testLocation.filePath}:{fix.testLocation.line}
                        </div>
                      )}
                      {fix.sourceLocation?.filePath &&
                        fix.sourceLocation.filePath !==
                          fix.testLocation?.filePath && (
                          <div className="mt-0.5">
                            🎯 {fix.sourceLocation.filePath}:
                            {fix.sourceLocation.line}
                          </div>
                        )}
                      {fix.errorMessage && (
                        <div className="mt-1 font-mono text-red-400/80 line-clamp-3">
                          {fix.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Generated Tests */}
      {autoTestsGenerated.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-purple-400/90 flex items-center gap-1">
            <span>🧠</span>
            <span>
              {labels.generatedTests} ({autoTestsGenerated.length})
            </span>
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {autoTestsGenerated.map((suggestion) => {
              const isInserting = insertingId === suggestion.id;
              return (
                <div
                  key={suggestion.id}
                  className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-purple-300 truncate">
                        {suggestion.title}
                      </div>
                      <div className="text-purple-400/60 truncate text-[10px]">
                        {suggestion.filePath} → {suggestion.testFilePath.split('/').pop()}
                      </div>
                      {suggestion.description && (
                        <div className="text-[10px] text-purple-400/50 mt-0.5 line-clamp-2">
                          {suggestion.description}
                        </div>
                      )}
                      {suggestion.riskScore && (
                        <div className="text-[10px] text-emerald-300 mt-0.5">
                          Risk Score: {suggestion.riskScore}/5
                        </div>
                      )}
                    </div>
                    {/* Phase 140.5.1: Insert button with loading state */}
                    {suggestion.content && (
                      <button
                        onClick={() => handleInsertTest(suggestion)}
                        disabled={isActive || isInserting}
                        className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded text-[10px] font-medium transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          isArabic
                            ? 'إدراج الاختبار وإعادة تشغيل ATP'
                            : 'Insert test file and re-run ATP'
                        }
                      >
                        {isInserting ? labels.inserting : labels.insertTest}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No data message */}
      {!metrics.testsRun && currentPhase === 'idle' && (
        <div className="text-center py-4 text-[#6b5f8a]">
          <div className="text-2xl mb-2">🤖</div>
          <div className="text-sm">{labels.noData}</div>
          <div className="text-xs mt-1 opacity-70">{labels.runHint}</div>
        </div>
      )}
    </div>
  );
};

export default AutonomousTestPipelinePanel;
