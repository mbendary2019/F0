// desktop/src/components/ace/AcePanel.tsx
// Phase 128.5: ACE Panel UI - Main Evolution Dashboard
// Phase 128.6: Added Recent History Section
// Phase 128.7: Added Alerts Section
// Phase 129.4: Added Phase Execution UI with Modal

import React, { useState, useCallback } from 'react';
import { useAce, useAcePlan, useAceSuggestions, useAceDebt, useAceMetrics, useAceAlerts } from '../../state/aceContext';
import type { AceSuggestion, AcePlanPhase } from '../../lib/ace/aceTypes';
import type { ImpactAnalysis } from '../../lib/ace/aceImpact';
import { formatRelativeTime } from '../../lib/ace/aceMetricsTypes';
import type { AceAlert } from '../../lib/ace/aceAlerts';
import { getAlertBadgeColor } from '../../lib/ace/aceAlerts';
import { getPhaseActions, getActionsSummary, type AcePlannedAction } from '../../lib/ace/aceActions';
import type { AcePhaseExecutionState, AcePhaseExecutionStatus } from '../../lib/ace/aceExecutor';
import './AcePanel.css';

interface Props {
  locale?: 'ar' | 'en';
  onApplySuggestion?: (suggestion: AceSuggestion) => void;
  onRunPhase?: (phase: AcePlanPhase, actions: AcePlannedAction[], runTests?: boolean) => Promise<{ testsRan?: boolean; testsPassed?: boolean }>;
}

/**
 * ACE Panel - Main Evolution Dashboard
 */
export const AcePanel: React.FC<Props> = ({ locale = 'ar', onApplySuggestion, onRunPhase }) => {
  const isArabic = locale === 'ar';
  const [activeTab, setActiveTab] = useState<'overview' | 'plan' | 'suggestions'>('overview');

  const { isScanning, lastScan, error, recompute } = useAce();

  const labels = {
    title: isArabic ? 'محرك تطوير الكود' : 'Code Evolution Engine',
    subtitle: isArabic ? 'ACE - تحسين تلقائي للكود' : 'ACE - Auto Code Evolution',
    overview: isArabic ? 'نظرة عامة' : 'Overview',
    plan: isArabic ? 'خطة التطوير' : 'Evolution Plan',
    suggestions: isArabic ? 'الاقتراحات' : 'Suggestions',
    scanning: isArabic ? 'جاري التحليل...' : 'Analyzing...',
    lastScan: isArabic ? 'آخر فحص' : 'Last scan',
    error: isArabic ? 'خطأ' : 'Error',
    recompute: isArabic ? 'إعادة حساب' : 'Recompute',
  };

  return (
    <div className="f0-ace-panel" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="f0-ace-header">
        <div className="f0-ace-title-section">
          <h2 className="f0-ace-title">{labels.title}</h2>
          <span className="f0-ace-subtitle">{labels.subtitle}</span>
        </div>
        <div className="f0-ace-header-actions">
          {isScanning && (
            <span className="f0-ace-scanning">{labels.scanning}</span>
          )}
          {lastScan && !isScanning && (
            <span className="f0-ace-last-scan">
              {labels.lastScan}: {new Date(lastScan).toLocaleTimeString(isArabic ? 'ar' : 'en')}
            </span>
          )}
          <button
            className="f0-ace-btn f0-ace-btn-recompute"
            onClick={() => recompute('manual')}
            disabled={isScanning}
          >
            {labels.recompute}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="f0-ace-error">
          <span>{labels.error}: {error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="f0-ace-tabs">
        <button
          className={`f0-ace-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          {labels.overview}
        </button>
        <button
          className={`f0-ace-tab ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >
          {labels.plan}
        </button>
        <button
          className={`f0-ace-tab ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          {labels.suggestions}
        </button>
      </div>

      {/* Tab Content */}
      <div className="f0-ace-content">
        {activeTab === 'overview' && <OverviewTab locale={locale} />}
        {activeTab === 'plan' && <PlanTab locale={locale} onRunPhase={onRunPhase} />}
        {activeTab === 'suggestions' && (
          <SuggestionsTab locale={locale} onApplySuggestion={onApplySuggestion} />
        )}
      </div>
    </div>
  );
};

/**
 * Overview Tab - Debt Score + Worst Files + Recent History (Phase 128.6) + Alerts (Phase 128.7)
 */
const OverviewTab: React.FC<{ locale: 'ar' | 'en' }> = ({ locale }) => {
  const isArabic = locale === 'ar';
  const { overallDebt, worstFiles } = useAceDebt();
  const { recentHistory, improvement, activityStatus } = useAceMetrics();
  const { activeAlerts, dismissAlert } = useAceAlerts();

  const labels = {
    debtScore: isArabic ? 'نسبة الدين التقني' : 'Technical Debt Score',
    healthScore: isArabic ? 'نقاط الصحة' : 'Health Score',
    worstFiles: isArabic ? 'أسوأ الملفات' : 'Worst Files',
    noData: isArabic ? 'لا توجد بيانات. قم بتشغيل الفحص أولاً.' : 'No data. Run analysis first.',
    issues: isArabic ? 'مشكلة' : 'issues',
    lines: isArabic ? 'سطر' : 'lines',
    risk: isArabic ? 'الخطورة' : 'Risk',
    recentRuns: isArabic ? 'آخر التشغيلات' : 'Recent Runs',
    files: isArabic ? 'ملف' : 'files',
    suggestions: isArabic ? 'اقتراح' : 'suggestions',
    improved: isArabic ? 'تحسن' : 'improved',
    declined: isArabic ? 'تراجع' : 'declined',
    alerts: isArabic ? 'تنبيهات' : 'Alerts',
    dismiss: isArabic ? 'تجاهل' : 'Dismiss',
  };

  const riskLabels = {
    low: isArabic ? 'منخفض' : 'Low',
    medium: isArabic ? 'متوسط' : 'Medium',
    high: isArabic ? 'مرتفع' : 'High',
  };

  const triggerLabels = {
    manual: isArabic ? 'يدوي' : 'Manual',
    auto_scan: isArabic ? 'تلقائي' : 'Auto',
    phase_complete: isArabic ? 'إكمال مرحلة' : 'Phase Done',
  };

  // Health score color based on score (higher is better)
  const getHealthColor = (score: number) => {
    if (score >= 70) return '#22c55e'; // green - good
    if (score >= 40) return '#f59e0b'; // amber - medium
    return '#ef4444'; // red - poor
  };

  if (worstFiles.length === 0 && recentHistory.length === 0) {
    return <div className="f0-ace-empty">{labels.noData}</div>;
  }

  return (
    <div className="f0-ace-overview">
      {/* Health Score Circle */}
      <div className="f0-ace-debt-section">
        <div
          className="f0-ace-debt-circle"
          style={{ borderColor: getHealthColor(overallDebt) }}
        >
          <span className="f0-ace-debt-value" style={{ color: getHealthColor(overallDebt) }}>
            {Math.round(overallDebt)}%
          </span>
          <span className="f0-ace-debt-label">{labels.healthScore}</span>
          {/* Improvement Indicator */}
          {improvement && (
            <span
              className="f0-ace-improvement"
              style={{ color: improvement.improved ? '#22c55e' : '#ef4444' }}
            >
              {improvement.improved ? '↑' : '↓'} {improvement.delta}%
            </span>
          )}
        </div>
      </div>

      {/* Phase 128.7: Alerts Section */}
      {activeAlerts.length > 0 && (
        <div className="f0-ace-alerts">
          <h3>{labels.alerts}</h3>
          <div className="f0-ace-alert-list">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`f0-ace-alert-row severity-${alert.severity}`}
                style={{ borderColor: getAlertBadgeColor(alert.severity) }}
              >
                <div className="f0-ace-alert-icon" style={{ color: getAlertBadgeColor(alert.severity) }}>
                  {alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '!' : 'i'}
                </div>
                <div className="f0-ace-alert-content">
                  <span className="f0-ace-alert-title">
                    {isArabic ? alert.titleAr : alert.title}
                  </span>
                  <span className="f0-ace-alert-message">
                    {isArabic ? alert.messageAr : alert.message}
                  </span>
                </div>
                <button
                  className="f0-ace-alert-dismiss"
                  onClick={() => dismissAlert(alert.id)}
                  title={labels.dismiss}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 128.6: Recent Runs History */}
      {recentHistory.length > 0 && (
        <div className="f0-ace-recent-runs">
          <h3>{labels.recentRuns}</h3>
          <div className="f0-ace-run-list">
            {recentHistory.map((run, index) => (
              <div key={run.id} className={`f0-ace-run-row ${index === 0 ? 'latest' : ''}`}>
                <div className="f0-ace-run-time">
                  {formatRelativeTime(run.timestamp, locale)}
                </div>
                <div className="f0-ace-run-score" style={{ color: getHealthColor(run.overallDebtScore) }}>
                  {Math.round(run.overallDebtScore)}%
                </div>
                <div className="f0-ace-run-stats">
                  <span>{run.filesCount} {labels.files}</span>
                  <span className="f0-ace-run-divider">|</span>
                  <span>{run.suggestionsCount} {labels.suggestions}</span>
                </div>
                <span className={`f0-ace-run-trigger trigger-${run.trigger}`}>
                  {triggerLabels[run.trigger]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Worst Files List */}
      {worstFiles.length > 0 && (
        <div className="f0-ace-worst-files">
          <h3>{labels.worstFiles}</h3>
          <div className="f0-ace-file-list">
            {worstFiles.map((file) => (
              <div key={file.filePath} className={`f0-ace-file-row risk-${file.riskLevel}`}>
                <div className="f0-ace-file-info">
                  <span className="f0-ace-file-name">{file.relativePath}</span>
                  <span className="f0-ace-file-meta">
                    {file.healthIssues} {labels.issues} | {file.sizeLines} {labels.lines}
                  </span>
                </div>
                <span className={`f0-ace-risk-badge risk-${file.riskLevel}`}>
                  {riskLabels[file.riskLevel]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Plan Tab - Evolution Plan Phases with Execution
 * Phase 129.4: Added Run Phase button and execution modal
 */
const PlanTab: React.FC<{
  locale: 'ar' | 'en';
  onRunPhase?: (phase: AcePlanPhase, actions: AcePlannedAction[], runTests?: boolean) => Promise<{ testsRan?: boolean; testsPassed?: boolean }>;
}> = ({ locale, onRunPhase }) => {
  const isArabic = locale === 'ar';
  const { plan, currentPhase, progress, startPhase, completePhase } = useAcePlan();
  const { suggestions } = useAceSuggestions();

  // Phase 129.4: Execution modal state
  const [showExecModal, setShowExecModal] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<AcePlanPhase | null>(null);
  const [execState, setExecState] = useState<'confirm' | 'running' | 'complete'>('confirm');
  const [execProgress, setExecProgress] = useState(0);
  const [execResult, setExecResult] = useState<{ success: boolean; filesFixed: number; errors: string[]; testsRan?: boolean; testsPassed?: boolean } | null>(null);
  const [shouldRunTests, setShouldRunTests] = useState(true);

  const labels = {
    noPlan: isArabic ? 'لا توجد خطة. قم بتشغيل التحليل أولاً.' : 'No plan. Run analysis first.',
    progress: isArabic ? 'التقدم' : 'Progress',
    start: isArabic ? 'ابدأ' : 'Start',
    complete: isArabic ? 'اكتمل' : 'Complete',
    current: isArabic ? 'الحالي' : 'Current',
    items: isArabic ? 'عنصر' : 'items',
    run: isArabic ? 'تشغيل' : 'Run',
  };

  // Handle opening execution modal
  const handleRunPhase = useCallback((phase: AcePlanPhase) => {
    setSelectedPhase(phase);
    setExecState('confirm');
    setExecProgress(0);
    setExecResult(null);
    setShowExecModal(true);
  }, []);

  // Handle confirming execution - Phase 130.7: Added runTests parameter
  const handleConfirmExecution = useCallback(async (runTests: boolean) => {
    if (!selectedPhase || !onRunPhase) return;

    setShouldRunTests(runTests);
    setExecState('running');

    // Get actions for this phase
    const { actions } = getPhaseActions(
      selectedPhase.id,
      selectedPhase.suggestionIds,
      suggestions
    );

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExecProgress(p => Math.min(p + 10, 90));
      }, 500);

      const result = await onRunPhase(selectedPhase, actions, runTests);

      clearInterval(progressInterval);
      setExecProgress(100);
      setExecResult({
        success: true,
        filesFixed: actions.length,
        errors: [],
        testsRan: result?.testsRan,
        testsPassed: result?.testsPassed,
      });
      setExecState('complete');

      // Mark phase as completed
      completePhase(selectedPhase.id);
    } catch (err) {
      setExecResult({
        success: false,
        filesFixed: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        testsRan: false,
      });
      setExecState('complete');
    }
  }, [selectedPhase, suggestions, onRunPhase, completePhase]);

  if (!plan) {
    return <div className="f0-ace-empty">{labels.noPlan}</div>;
  }

  return (
    <div className="f0-ace-plan">
      {/* Progress Bar */}
      <div className="f0-ace-progress-section">
        <div className="f0-ace-progress-header">
          <span>{labels.progress}</span>
          <span>{progress}%</span>
        </div>
        <div className="f0-ace-progress-bar">
          <div
            className="f0-ace-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phases */}
      <div className="f0-ace-phases">
        {plan.phases.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            isCurrent={currentPhase?.id === phase.id}
            locale={locale}
            suggestions={suggestions}
            onStart={() => startPhase(phase.id)}
            onComplete={() => completePhase(phase.id)}
            onRun={() => handleRunPhase(phase)}
            canRun={!!onRunPhase}
          />
        ))}
      </div>

      {/* Phase 129.4: Execution Modal */}
      {showExecModal && selectedPhase && (
        <PhaseExecutionModal
          phase={selectedPhase}
          suggestions={suggestions}
          locale={locale}
          state={execState}
          progress={execProgress}
          result={execResult}
          onConfirm={handleConfirmExecution}
          onClose={() => setShowExecModal(false)}
        />
      )}
    </div>
  );
};

/**
 * Phase Card Component - Updated for Phase 129.4 with Run button
 */
const PhaseCard: React.FC<{
  phase: AcePlanPhase;
  isCurrent: boolean;
  locale: 'ar' | 'en';
  suggestions: AceSuggestion[];
  onStart: () => void;
  onComplete: () => void;
  onRun: () => void;
  canRun: boolean;
}> = ({ phase, isCurrent, locale, suggestions, onStart, onComplete, onRun, canRun }) => {
  const isArabic = locale === 'ar';

  const title = isArabic ? phase.titleAr : phase.title;
  const description = isArabic ? phase.descriptionAr : phase.description;

  const statusLabels = {
    pending: isArabic ? 'قيد الانتظار' : 'Pending',
    in_progress: isArabic ? 'جاري' : 'In Progress',
    completed: isArabic ? 'مكتمل' : 'Completed',
  };

  const labels = {
    start: isArabic ? 'ابدأ' : 'Start',
    complete: isArabic ? 'اكتمل' : 'Complete',
    run: isArabic ? 'تشغيل' : 'Run',
    items: isArabic ? 'عنصر' : 'items',
  };

  // Get action summary for this phase
  const { actions, totalFiles, canFullyAutomate, estimatedSeconds } = getPhaseActions(
    phase.id,
    phase.suggestionIds,
    suggestions
  );

  return (
    <div className={`f0-ace-phase-card status-${phase.status} ${isCurrent ? 'current' : ''}`}>
      <div className="f0-ace-phase-header">
        <span className="f0-ace-phase-order">{phase.order}</span>
        <h4 className="f0-ace-phase-title">{title}</h4>
        <span className={`f0-ace-phase-status status-${phase.status}`}>
          {statusLabels[phase.status]}
        </span>
      </div>
      <p className="f0-ace-phase-desc">{description}</p>
      <div className="f0-ace-phase-footer">
        <span className="f0-ace-phase-count">
          {phase.suggestionIds.length} {labels.items}
        </span>
        <span className="f0-ace-phase-effort">
          {phase.estimatedEffort === 'S' ? 'Small' : phase.estimatedEffort === 'M' ? 'Medium' : 'Large'}
        </span>

        {/* Phase 129.4: Action buttons container */}
        <div className="f0-ace-phase-actions">
          {phase.status === 'pending' && (
            <>
              <button className="f0-ace-btn f0-ace-btn-start" onClick={onStart}>
                {labels.start}
              </button>
              {canRun && actions.length > 0 && (
                <button
                  className="f0-ace-btn f0-ace-btn-run"
                  onClick={onRun}
                  title={`${actions.length} actions, ~${estimatedSeconds}s`}
                >
                  <span className="icon">▶</span>
                  {labels.run}
                </button>
              )}
            </>
          )}
          {phase.status === 'in_progress' && (
            <>
              {canRun && actions.length > 0 && (
                <button
                  className="f0-ace-btn f0-ace-btn-run"
                  onClick={onRun}
                  title={`${actions.length} actions, ~${estimatedSeconds}s`}
                >
                  <span className="icon">▶</span>
                  {labels.run}
                </button>
              )}
              <button className="f0-ace-btn f0-ace-btn-complete" onClick={onComplete}>
                {labels.complete}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Phase 129.4: Execution Modal Component
 * Phase 130.7: Added "Run Tests After Fixes" option
 */
const PhaseExecutionModal: React.FC<{
  phase: AcePlanPhase;
  suggestions: AceSuggestion[];
  locale: 'ar' | 'en';
  state: 'confirm' | 'running' | 'complete';
  progress: number;
  result: { success: boolean; filesFixed: number; errors: string[]; testsRan?: boolean; testsPassed?: boolean } | null;
  onConfirm: (runTests: boolean) => void;
  onClose: () => void;
}> = ({ phase, suggestions, locale, state, progress, result, onConfirm, onClose }) => {
  const isArabic = locale === 'ar';
  const [runTestsAfterFix, setRunTestsAfterFix] = useState(true);

  // Get actions for display
  const { actions, totalFiles, canFullyAutomate, estimatedSeconds } = getPhaseActions(
    phase.id,
    phase.suggestionIds,
    suggestions
  );
  const actionsSummary = getActionsSummary(actions, locale);

  const labels = {
    title: isArabic ? 'تشغيل المرحلة' : 'Run Phase',
    actions: isArabic ? 'الإجراءات' : 'Actions',
    files: isArabic ? 'ملف' : 'files',
    estimatedTime: isArabic ? 'الوقت المقدر' : 'Est. time',
    seconds: isArabic ? 'ثانية' : 's',
    safeMode: isArabic ? 'الوضع الآمن مفعّل - سيتم إنشاء نسخة احتياطية قبل التنفيذ' : 'Safe Mode enabled - A snapshot will be created before execution',
    runTestsAfterFix: isArabic ? 'تشغيل الاختبارات بعد الإصلاح' : 'Run tests after fix',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    confirm: isArabic ? 'تأكيد وتشغيل' : 'Confirm & Run',
    testsStatus: isArabic ? 'نتيجة الاختبارات' : 'Test Results',
    testsPassed: isArabic ? 'الاختبارات نجحت' : 'Tests passed',
    testsFailed: isArabic ? 'فشلت بعض الاختبارات' : 'Some tests failed',
    testsNotRun: isArabic ? 'لم يتم تشغيل الاختبارات' : 'Tests were not run',
    running: isArabic ? 'جاري التنفيذ...' : 'Executing...',
    processing: isArabic ? 'معالجة الملفات' : 'Processing files',
    success: isArabic ? 'تم بنجاح!' : 'Success!',
    failed: isArabic ? 'فشل التنفيذ' : 'Execution Failed',
    filesFixed: isArabic ? 'ملف تم إصلاحه' : 'file(s) fixed',
    close: isArabic ? 'إغلاق' : 'Close',
    rollback: isArabic ? 'يمكنك التراجع من الـ Snapshots' : 'You can rollback from Snapshots',
    undo: isArabic ? 'تراجع' : 'Undo',
  };

  const phaseTitle = isArabic ? phase.titleAr : phase.title;

  // Get action type icon
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'run_fix_profile': return '🔧';
      case 'open_files_in_editor': return '📝';
      case 'delete_files': return '🗑️';
      case 'run_project_scan': return '🔍';
      default: return '⚡';
    }
  };

  // Get action type class
  const getActionTypeClass = (type: string) => {
    switch (type) {
      case 'run_fix_profile': return 'type-fix';
      case 'delete_files': return 'type-delete';
      case 'open_files_in_editor': return 'type-review';
      default: return '';
    }
  };

  return (
    <div className="f0-ace-exec-overlay" onClick={onClose}>
      <div className="f0-ace-exec-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="f0-ace-exec-header">
          <h3 className="f0-ace-exec-title">
            <span className="icon">⚡</span>
            {labels.title}: {phaseTitle}
          </h3>
          <button className="f0-ace-exec-close" onClick={onClose}>×</button>
        </div>

        {/* Confirm State */}
        {state === 'confirm' && (
          <>
            {/* Stats */}
            <div className="f0-ace-exec-summary">
              <div className="f0-ace-exec-stats">
                <div className="f0-ace-exec-stat">
                  <span className="f0-ace-exec-stat-value">{actions.length}</span>
                  <span className="f0-ace-exec-stat-label">{labels.actions}</span>
                </div>
                <div className="f0-ace-exec-stat">
                  <span className="f0-ace-exec-stat-value">{totalFiles}</span>
                  <span className="f0-ace-exec-stat-label">{labels.files}</span>
                </div>
                <div className="f0-ace-exec-stat">
                  <span className="f0-ace-exec-stat-value">~{estimatedSeconds}</span>
                  <span className="f0-ace-exec-stat-label">{labels.seconds}</span>
                </div>
              </div>
            </div>

            {/* Actions Preview */}
            <div className="f0-ace-exec-actions-preview">
              <div className="f0-ace-exec-actions-title">{labels.actions}:</div>
              <div className="f0-ace-exec-action-list">
                {actions.slice(0, 5).map((action, i) => (
                  <div key={action.id} className={`f0-ace-exec-action-item ${getActionTypeClass(action.type)}`}>
                    <div className="f0-ace-exec-action-icon">
                      {getActionIcon(action.type)}
                    </div>
                    <span className="f0-ace-exec-action-desc">
                      {isArabic ? action.descriptionAr : action.description}
                    </span>
                  </div>
                ))}
                {actions.length > 5 && (
                  <div className="f0-ace-exec-action-item">
                    <div className="f0-ace-exec-action-icon">...</div>
                    <span className="f0-ace-exec-action-desc">
                      +{actions.length - 5} more
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Safety Notice */}
            <div className="f0-ace-exec-safety">
              <span className="f0-ace-exec-safety-icon">🛡️</span>
              <span className="f0-ace-exec-safety-text">{labels.safeMode}</span>
            </div>

            {/* Phase 130.7: Run Tests Checkbox */}
            <div className="f0-ace-exec-tests-option">
              <label className="f0-ace-exec-checkbox-label">
                <input
                  type="checkbox"
                  checked={runTestsAfterFix}
                  onChange={(e) => setRunTestsAfterFix(e.target.checked)}
                />
                <span className="f0-ace-exec-checkbox-icon">🧪</span>
                <span className="f0-ace-exec-checkbox-text">{labels.runTestsAfterFix}</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="f0-ace-exec-buttons">
              <button className="f0-ace-exec-btn f0-ace-exec-btn-cancel" onClick={onClose}>
                {labels.cancel}
              </button>
              <button className="f0-ace-exec-btn f0-ace-exec-btn-confirm" onClick={() => onConfirm(runTestsAfterFix)}>
                <span>▶</span>
                {labels.confirm}
              </button>
            </div>
          </>
        )}

        {/* Running State */}
        {state === 'running' && (
          <div className="f0-ace-exec-progress">
            <div className="f0-ace-exec-spinner" />
            <div className="f0-ace-exec-progress-text">{labels.running}</div>
            <div className="f0-ace-exec-progress-bar">
              <div
                className="f0-ace-exec-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="f0-ace-exec-progress-sub">
              {labels.processing} ({Math.round(progress)}%)
            </div>
          </div>
        )}

        {/* Complete State */}
        {state === 'complete' && result && (
          <div className="f0-ace-exec-complete">
            <div className={`f0-ace-exec-complete-icon ${result.success ? 'success' : 'error'}`}>
              {result.success ? '✓' : '✗'}
            </div>
            <div className="f0-ace-exec-complete-title">
              {result.success ? labels.success : labels.failed}
            </div>
            <div className="f0-ace-exec-complete-desc">
              {result.success
                ? `${result.filesFixed} ${labels.filesFixed}`
                : result.errors.join(', ')
              }
            </div>

            {/* Phase 130.7: Test Results */}
            {result.testsRan !== undefined && (
              <div className={`f0-ace-exec-tests-result ${result.testsPassed ? 'passed' : 'failed'}`}>
                <span className="f0-ace-exec-tests-icon">🧪</span>
                <span className="f0-ace-exec-tests-status">
                  {result.testsRan
                    ? (result.testsPassed ? labels.testsPassed : labels.testsFailed)
                    : labels.testsNotRun
                  }
                </span>
              </div>
            )}

            {result.success && (
              <div className="f0-ace-exec-rollback">
                <span>🔄 {labels.rollback}</span>
              </div>
            )}

            <div className="f0-ace-exec-buttons">
              <button className="f0-ace-exec-btn f0-ace-exec-btn-confirm" onClick={onClose}>
                {labels.close}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Suggestions Tab - Sorted Suggestions List
 */
const SuggestionsTab: React.FC<{
  locale: 'ar' | 'en';
  onApplySuggestion?: (suggestion: AceSuggestion) => void;
}> = ({ locale, onApplySuggestion }) => {
  const isArabic = locale === 'ar';
  const { sortedSuggestions, impacts, acceptSuggestion, dismissSuggestion } = useAceSuggestions();

  const labels = {
    noSuggestions: isArabic ? 'لا توجد اقتراحات.' : 'No suggestions.',
    apply: isArabic ? 'تطبيق' : 'Apply',
    dismiss: isArabic ? 'تجاهل' : 'Dismiss',
    impact: isArabic ? 'التأثير' : 'Impact',
  };

  if (sortedSuggestions.length === 0) {
    return <div className="f0-ace-empty">{labels.noSuggestions}</div>;
  }

  return (
    <div className="f0-ace-suggestions">
      {sortedSuggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          impact={impacts.get(suggestion.id)}
          locale={locale}
          onApply={() => {
            onApplySuggestion?.(suggestion);
            acceptSuggestion(suggestion.id);
          }}
          onDismiss={() => dismissSuggestion(suggestion.id)}
        />
      ))}
    </div>
  );
};

/**
 * Suggestion Card Component
 */
const SuggestionCard: React.FC<{
  suggestion: AceSuggestion;
  impact?: ImpactAnalysis;
  locale: 'ar' | 'en';
  onApply: () => void;
  onDismiss: () => void;
}> = ({ suggestion, impact, locale, onApply, onDismiss }) => {
  const isArabic = locale === 'ar';

  const title = isArabic ? suggestion.titleAr : suggestion.title;
  const description = isArabic ? suggestion.descriptionAr : suggestion.description;
  const impactDesc = impact
    ? isArabic
      ? impact.impactDescriptionAr
      : impact.impactDescription
    : '';

  const labels = {
    apply: isArabic ? 'تطبيق' : 'Apply',
    dismiss: isArabic ? 'تجاهل' : 'Dismiss',
    files: isArabic ? 'ملفات' : 'files',
  };

  const impactLabels = {
    low: isArabic ? 'منخفض' : 'Low',
    medium: isArabic ? 'متوسط' : 'Medium',
    high: isArabic ? 'مرتفع' : 'High',
  };

  const effortLabels = {
    S: isArabic ? 'صغير' : 'Small',
    M: isArabic ? 'متوسط' : 'Medium',
    L: isArabic ? 'كبير' : 'Large',
  };

  return (
    <div className={`f0-ace-suggestion-card impact-${suggestion.estimatedImpact}`}>
      <div className="f0-ace-suggestion-header">
        <span className="f0-ace-suggestion-icon">{suggestion.icon}</span>
        <h4 className="f0-ace-suggestion-title">{title}</h4>
      </div>
      <p className="f0-ace-suggestion-desc">{description}</p>

      {/* Target Files */}
      <div className="f0-ace-suggestion-files">
        <span>{suggestion.targetFiles.length} {labels.files}:</span>
        <code>{suggestion.targetFiles.slice(0, 3).join(', ')}</code>
        {suggestion.targetFiles.length > 3 && <span>...</span>}
      </div>

      {/* Impact Info */}
      {impact && (
        <div className={`f0-ace-suggestion-impact risk-${impact.riskLevel}`}>
          {impactDesc}
        </div>
      )}

      {/* Footer */}
      <div className="f0-ace-suggestion-footer">
        <div className="f0-ace-suggestion-badges">
          <span className={`f0-ace-badge impact-${suggestion.estimatedImpact}`}>
            {impactLabels[suggestion.estimatedImpact]}
          </span>
          <span className="f0-ace-badge effort">
            {effortLabels[suggestion.estimatedEffort]}
          </span>
        </div>
        <div className="f0-ace-suggestion-actions">
          <button className="f0-ace-btn f0-ace-btn-dismiss" onClick={onDismiss}>
            {labels.dismiss}
          </button>
          <button className="f0-ace-btn f0-ace-btn-apply" onClick={onApply}>
            {labels.apply}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AcePanel;
