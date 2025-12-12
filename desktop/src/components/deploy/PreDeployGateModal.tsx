// desktop/src/components/deploy/PreDeployGateModal.tsx
// =============================================================================
// Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)
// =============================================================================
// NOTE: This file is part of the locked Quality pipeline.
// Any major behavioral changes should be done in a new Phase (>= 150).
// =============================================================================
// Phase 134.2: Pre-Deploy Gate Modal - Shows quality checklist before deployment
// Phase 135.3: Added Quality Actions Panel integration
// Phase 135.4: Added Quality History Panel
// Phase 135.5: Added Quality Coach Panel
// Phase 136.0: Added Security Alerts Panel integration
// Phase 136.1: Updated to use externalSecurityStats from Security Watchdog
// Phase 137.1: Updated to use externalTestStats from Test Watchdog
// Phase 137.3: Added Test Coach integration for test diagnostics
// Phase 137.4.2: Added Coverage Coach integration for coverage diagnostics
// Phase 140.6: Added ATP (Autonomous Test Pipeline) integration
// Phase 149.8: Added [149.7][GATE] logging for wiring validation

'use client';

import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import { useDeployQuality } from '../../state/deployQualityContext';
import { useTestLab } from '../../state/testLabContext';
// Phase 135.3: Quality Actions
import { actionsForPolicyReasons, type QualityAction, type QualityActionType } from '../../lib/quality/policyActions';
import { QualityActionsPanel } from './QualityActionsPanel';
// Phase 135.4: Quality History
import { useQualityHistory } from '../../state/qualityHistoryContext';
import { QualityHistoryPanel } from '../quality/QualityHistoryPanel';
// Phase 135.5: Quality Coach (Full Intelligence Layer)
import { buildQualityCoachSuggestions } from '../../lib/quality/qualityCoach';
import { QualityCoachPanelFull } from '../quality/QualityCoachPanelFull';
import { runAutoImprovePipeline } from '../../lib/quality/autoImprovePipeline';
import { calculateTrend } from '../../lib/quality/qualityHistoryTypes';
// Phase 136.0: Security Engine
import { runSecurityScan, type SecurityAlert } from '../../lib/security/securityEngine';
import { SecurityAlertsPanel } from '../security/SecurityAlertsPanel';
// Phase 137.3: Test Coach
import {
  buildTestCoachSummary,
  getTestCoachLabel,
  getTestCoachSubtitle,
  getTestCoachDetails,
} from '../../lib/tests/testCoach';
// Phase 137.4.2: Coverage Coach
import {
  buildCoverageCoachSummary,
  getCoverageCoachSubtitle,
  getCoverageCoachDetails,
} from '../../lib/tests/coverageCoach';
// Phase 140.6: ATP Integration
import { useLastTestCycleSummary } from '../../hooks/useLastTestCycleSummary';
// Phase 140.7: Quality Story
import { PreDeployQualityStory } from './PreDeployQualityStory';

interface PreDeployGateModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when user confirms deploy */
  onConfirmDeploy?: () => void;
  /** Opens the Project Quality Panel */
  onOpenQualityPanel?: () => void;
  /** Called when user clicks "Run tests again" - if provided, use this instead of internal handler */
  onRunTestsAgain?: () => void;
  /** Phase 135.3: Called when user clicks a quality action to run with agent */
  onRunQualityAction?: (action: QualityAction) => void;
  /** Phase 138.5.2: Called when user wants to launch ACE with optimization context */
  onLaunchAce?: (aceContext: { riskLevel: string; overallScore: number; reasons: string[] }) => void;
  /** Locale for bilingual support */
  locale?: 'en' | 'ar';
}

export const PreDeployGateModal: React.FC<PreDeployGateModalProps> = ({
  open,
  onClose,
  onConfirmDeploy,
  onOpenQualityPanel,
  onRunTestsAgain,
  onRunQualityAction,
  onLaunchAce,
  locale = 'en',
}) => {
  // Phase 135.3: Extended context with policyResult
  // Phase 136.1: Added externalSecurityStats from Security Watchdog
  // Phase 137.1: Added externalTestStats from Test Watchdog
  // Phase 137.4.2: Added externalCoverageStats from Coverage Watchdog
  // Phase 138.4: Added externalOptimizationStats for Project Optimization
  const { snapshot, policyResult, externalSecurityStats, externalTestStats, externalCoverageStats, externalOptimizationStats } = useDeployQuality();
  const { runAllTests, state: testLabState } = useTestLab();
  const isRunning = testLabState.isLoading;
  // Phase 135.4: Quality History
  const { snapshots: historySnapshots } = useQualityHistory();
  // Phase 140.6: ATP Integration
  const {
    summary: atpSummary,
    isRunning: isATPRunning,
    currentPhase: atpCurrentPhase,
    triggerATPCycle,
    isATPEnabled,
  } = useLastTestCycleSummary();

  const [isConfirmingOverride, setIsConfirmingOverride] = useState(false);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [isRunningAction, setIsRunningAction] = useState(false);

  // Phase 185: Auto-Improve summary state
  interface AutoImproveSummary {
    issuesBefore: number;
    issuesAfter: number;
    delta: number;
    testsStatus: 'passing' | 'failing' | 'not_run';
    securityBefore: number;
    securityAfter: number;
    patchesApplied: number;
    timestamp: string;
  }
  const [autoImproveSummary, setAutoImproveSummary] = useState<AutoImproveSummary | null>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  const isArabic = locale === 'ar';

  // Phase 135.3: Compute quality actions from policy reasons
  const qualityActions = useMemo(() => {
    if (!policyResult) return [];
    const allFiles = policyResult.affectedFiles ?? [];
    return actionsForPolicyReasons(policyResult.reasons, allFiles);
  }, [policyResult]);

  // Phase 135.5: Compute coach suggestions from history + policy
  const coachSuggestions = useMemo(() => {
    return buildQualityCoachSuggestions({
      snapshots: historySnapshots,
      latestPolicyResult: policyResult,
    });
  }, [historySnapshots, policyResult]);

  // Phase 135.5: Calculate health trend from history
  const healthTrend = useMemo(() => {
    return calculateTrend(historySnapshots);
  }, [historySnapshots]);

  // Phase 136.0: Run security scan on current project issues
  // Phase 136.1: Use external security stats from Security Watchdog when available
  const securityAlerts = useMemo<SecurityAlert[]>(() => {
    // If we have external security stats from the watchdog, use those
    // The watchdog runs on actual project issues, so it's more accurate
    if (externalSecurityStats && externalSecurityStats.totalAlerts > 0) {
      console.log('[PreDeployGate] Using external security stats from watchdog:', externalSecurityStats);
      // Create synthetic alerts from the stats
      const alerts: SecurityAlert[] = [];
      const severities: Array<'critical' | 'high' | 'medium' | 'low' | 'info'> = ['critical', 'high', 'medium', 'low', 'info'];
      const now = externalSecurityStats.lastScanAt || new Date().toISOString();
      for (const severity of severities) {
        const count = externalSecurityStats.bySeverity[severity] ?? 0;
        for (let i = 0; i < count; i++) {
          alerts.push({
            id: `watchdog-${severity}-${i}`,
            severity,
            source: 'static' as const,
            createdAt: now,
            message: severity === 'critical'
              ? (locale === 'ar' ? 'مشكلة أمنية حرجة تحتاج معالجة فورية' : 'Critical security issue requires immediate attention')
              : severity === 'high'
              ? (locale === 'ar' ? 'مشكلة أمنية عالية الخطورة' : 'High severity security issue')
              : severity === 'medium'
              ? (locale === 'ar' ? 'مشكلة أمنية متوسطة' : 'Medium severity security issue')
              : severity === 'low'
              ? (locale === 'ar' ? 'مشكلة أمنية منخفضة' : 'Low severity security issue')
              : (locale === 'ar' ? 'ملاحظة أمنية' : 'Security info'),
            messageAr: severity === 'critical' ? 'مشكلة أمنية حرجة تحتاج معالجة فورية'
              : severity === 'high' ? 'مشكلة أمنية عالية الخطورة'
              : severity === 'medium' ? 'مشكلة أمنية متوسطة'
              : severity === 'low' ? 'مشكلة أمنية منخفضة'
              : 'ملاحظة أمنية',
            isBlocking: severity === 'critical' || severity === 'high',
            category: 'security',
          });
        }
      }
      return alerts;
    }

    // Fallback: Convert policy reasons to issues for security scanning
    const snapshotReasons = snapshot?.reasons ?? [];
    const existingIssues = snapshotReasons.map((r) => ({
      id: r.code,
      message: r.label,
      severity: r.severity === 'critical' ? 'error' as const : r.severity === 'warning' ? 'warning' as const : 'info' as const,
      file: r.file,
      line: r.line,
    }));
    const result = runSecurityScan({ existingIssues });
    return result.alerts;
  }, [snapshot?.reasons, externalSecurityStats, locale]);

  // Phase 137.3: Build Test Coach summary for diagnostics
  const testCoachSummary = useMemo(
    () => buildTestCoachSummary(externalTestStats, locale),
    [externalTestStats, locale]
  );

  // Phase 137.4.2: Build Coverage Coach summary for diagnostics
  const coverageCoachSummary = useMemo(
    () => buildCoverageCoachSummary(externalCoverageStats, locale),
    [externalCoverageStats, locale]
  );

  // Phase 135.5: Handle running a coach suggestion action
  const handleRunCoachAction = (actionType: QualityActionType) => {
    // Build a fake QualityAction to reuse the existing handler
    const fakeAction: QualityAction = {
      type: actionType,
      label: actionType.replace(/_/g, ' ').toLowerCase(),
      labelAr: actionType,
      icon: '🚀',
      suggestedFiles: policyResult?.affectedFiles ?? [],
    };
    handleRunQualityAction(fakeAction);
  };

  // Phase 135.3: Handle running a quality action
  const handleRunQualityAction = async (action: QualityAction) => {
    if (!onRunQualityAction) {
      console.log('[PreDeployGate] No onRunQualityAction handler provided');
      return;
    }
    setIsRunningAction(true);
    try {
      await onRunQualityAction(action);
    } finally {
      setIsRunningAction(false);
    }
  };

  // Phase 135.5: Handle running the auto-improve pipeline
  // Phase 185: Enhanced to capture before/after summary
  const handleRunAutoImprovePipeline = async () => {
    console.log('[PreDeployGate] Starting auto-improve pipeline...');
    setIsRunningPipeline(true);

    // Phase 185: Capture before state
    const issuesBefore = snapshot?.totalIssues ?? 0;
    const securityBefore = externalSecurityStats?.totalAlerts ?? 0;

    await runAutoImprovePipeline(
      async (actionType) => {
        const fakeAction: QualityAction = {
          type: actionType,
          label: actionType.replace(/_/g, ' ').toLowerCase(),
          labelAr: actionType,
          icon: '🚀',
          suggestedFiles: policyResult?.affectedFiles ?? [],
        };
        await handleRunQualityAction(fakeAction);
      },
      {
        onProgress: (progress) => {
          console.log('[AutoImprove] Progress:', progress);
        },
      }
    );

    // Phase 185: Capture after state and calculate delta
    // Note: We get updated values from the snapshot after pipeline completes
    const issuesAfter = snapshot?.totalIssues ?? 0;
    const securityAfter = externalSecurityStats?.totalAlerts ?? 0;
    const delta = issuesBefore - issuesAfter;

    // Phase 185: Set summary for UI display
    setAutoImproveSummary({
      issuesBefore,
      issuesAfter,
      delta,
      testsStatus: snapshot?.testsStatus ?? 'not_run',
      securityBefore,
      securityAfter,
      patchesApplied: delta > 0 ? delta : 0, // Approximate
      timestamp: new Date().toISOString(),
    });

    setIsRunningPipeline(false);
    console.log('[PreDeployGate] Auto-improve pipeline complete', {
      issuesBefore,
      issuesAfter,
      delta,
    });
  };

  if (!open || !snapshot) return null;

  const { level, reasons, healthScore, testsStatus, hasSecurityAlerts } = snapshot;

  // Phase 149.8: Log gate state derivation for wiring validation
  console.log('[149.7][GATE] Derived gate state from latest quality snapshot', {
    healthScore,
    healthStatus: level,
    qualityIssues: snapshot.totalIssues,
    policyReasons: reasons.length,
    securityAlerts: externalSecurityStats?.totalAlerts ?? 0,
    securityBlocking: hasSecurityAlerts,
    testsStatus,
    gateDecision: level, // 'clean' | 'risky' | 'blocked'
  });

  // Labels based on level
  const labels = {
    clean: {
      title: isArabic ? 'جاهز للنشر' : 'Ready to deploy',
      subtitle: isArabic
        ? 'جميع فحوصات الجودة تبدو جيدة. يمكنك النشر بأمان.'
        : 'All key quality checks look good. You can deploy safely.',
    },
    risky: {
      title: isArabic ? 'انشر بحذر' : 'Deploy with caution',
      subtitle: isArabic
        ? 'هناك تحذيرات يجب مراجعتها قبل النشر.'
        : 'There are warnings you should review before deploying.',
    },
    blocked: {
      title: isArabic ? 'النشر محظور' : 'Deploy blocked',
      subtitle: isArabic
        ? 'تم اكتشاف مشاكل حرجة. يُنصح بشدة بإصلاحها قبل النشر.'
        : 'Critical issues detected. It is strongly recommended to fix them before deploying.',
    },
  };

  const { title, subtitle } = labels[level];

  // Determine if blocked for styling
  const isBlocked = level === 'blocked';
  const isClean = level === 'clean';

  // Helper for badge card styling based on tone - cinematic neon glow
  const getCardStyle = (tone: 'ok' | 'warn' | 'danger') => {
    switch (tone) {
      case 'danger':
        return 'border-red-400/40 bg-white/5 backdrop-blur-md shadow-[0_0_18px_rgba(255,80,80,0.4)]';
      case 'warn':
        return 'border-amber-400/40 bg-white/5 backdrop-blur-md shadow-[0_0_18px_rgba(255,200,80,0.35)]';
      default:
        return 'border-emerald-400/40 bg-white/5 backdrop-blur-md shadow-[0_0_15px_rgba(52,211,153,0.3)]';
    }
  };

  // Determine tone for each metric card
  const healthTone: 'ok' | 'warn' | 'danger' =
    healthScore == null ? 'warn' : healthScore < 50 ? 'danger' : healthScore < 70 ? 'warn' : 'ok';
  const testsTone: 'ok' | 'warn' | 'danger' =
    testsStatus === 'failing' ? 'danger' : testsStatus === 'not_run' ? 'warn' : 'ok';
  const securityTone: 'ok' | 'warn' | 'danger' = hasSecurityAlerts ? 'danger' : 'ok';
  const issuesTone: 'ok' | 'warn' | 'danger' =
    reasons.length === 0 ? 'ok' : reasons.some(r => r.severity === 'critical') ? 'danger' : 'warn';

  // Phase 138.4: Optimization tone based on risk level
  const optimizationTone: 'ok' | 'warn' | 'danger' =
    !externalOptimizationStats ? 'warn' :
    externalOptimizationStats.riskLevel === 'critical' ? 'danger' :
    externalOptimizationStats.riskLevel === 'high' ? 'danger' :
    externalOptimizationStats.riskLevel === 'medium' ? 'warn' :
    'ok'; // low risk

  // Phase 138.4: Helper to get risk color class
  const getRiskColorClass = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-amber-400';
      default: return 'text-emerald-400';
    }
  };

  const handleRunChecks = async () => {
    // If external handler provided, use it (allows App.tsx to control the flow)
    if (onRunTestsAgain) {
      onRunTestsAgain();
      return;
    }

    // Fallback to internal handler
    try {
      setIsRunningChecks(true);
      await runAllTests?.('pre_deploy');
    } finally {
      setIsRunningChecks(false);
    }
  };

  const handleConfirmDeployClick = () => {
    if (level === 'blocked' && !isConfirmingOverride) {
      setIsConfirmingOverride(true);
      return;
    }
    onConfirmDeploy?.();
    onClose();
  };

  // Reset override state when closing
  const handleClose = () => {
    setIsConfirmingOverride(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className={clsx(
          'w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl backdrop-blur-2xl',
          'shadow-[0_24px_80px_rgba(0,0,0,0.75)]',
          isClean
            ? 'bg-gradient-to-b from-[#031a12] via-[#021510] to-[#010a08] border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.25)]'
            : isBlocked
            ? 'bg-gradient-to-b from-[#3d0010] via-[#250008] to-[#150005] border border-red-500/20 shadow-[0_0_40px_rgba(255,0,40,0.4)]'
            : 'bg-gradient-to-b from-[#2d1f00] via-[#1a1200] to-[#0f0a00] border border-amber-500/20 shadow-[0_0_40px_rgba(255,180,0,0.3)]'
        )}
        onClick={(e) => e.stopPropagation()}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header - Neon gradient with stronger glow + blur (sticky) */}
        <div
          className={clsx(
            'flex-shrink-0 flex items-center justify-between rounded-t-2xl px-4 py-3 backdrop-blur-xl',
            isClean
              ? 'bg-gradient-to-r from-[#052e1c] via-[#0f9d6e] to-[#052e1c] shadow-[0_0_32px_rgba(16,185,129,0.6)]'
              : isBlocked
              ? 'bg-gradient-to-r from-[#3b0210] via-[#8b0423] to-[#3b0210] shadow-[0_0_30px_rgba(255,50,70,0.55)]'
              : 'bg-gradient-to-r from-[#3b2600] via-[#a86e00] to-[#3b2600] shadow-[0_0_30px_rgba(255,191,71,0.6)]'
          )}
        >
          <div>
            <div className={clsx(
              'flex items-center gap-2 text-sm font-semibold',
              isClean ? 'text-emerald-100' : 'text-white'
            )}>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-xs">
                {isClean ? '✅' : isBlocked ? '🚫' : '⚠️'}
              </span>
              <span>{title}</span>
            </div>
            <p className={clsx(
              'mt-1 text-[11px]',
              isClean ? 'text-emerald-200/90' : 'text-white/80'
            )}>{subtitle}</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-medium text-white/90 hover:bg-black/40 transition-colors"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>

        {/* Body - 2 Column Layout (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-100/90 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* Summary row - Neon badge cards (full width) */}
          <div className="grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4 mb-4">
            <div className={clsx(
              'rounded-xl border px-3 py-2 transition-all',
              getCardStyle(healthTone)
            )}>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                {isArabic ? 'الصحة' : 'Health'}
              </div>
              <div className={clsx(
                'mt-1 text-sm font-semibold',
                healthTone === 'danger' ? 'text-rose-200' : healthTone === 'warn' ? 'text-amber-200' : 'text-emerald-200'
              )}>
                {healthScore != null ? `${healthScore}%` : '—'}
              </div>
            </div>

            {/* Phase 137.1: Enhanced Tests tile with external test stats */}
            {/* Phase 137.3: Integrated Test Coach status */}
            <div className={clsx(
              'rounded-xl border px-3 py-2 transition-all',
              getCardStyle(testsTone)
            )}>
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  {isArabic ? 'الاختبارات' : 'Tests'}
                </div>
                <span className="text-xs">{testCoachSummary.icon}</span>
              </div>
              <div className={clsx(
                'mt-1 text-sm font-semibold capitalize',
                testsTone === 'danger' ? 'text-rose-200' : testsTone === 'warn' ? 'text-amber-200' : 'text-emerald-200'
              )}>
                {externalTestStats
                  ? externalTestStats.status === 'not_run'
                    ? isArabic ? 'لم تُشغّل' : 'Not run'
                    : `${externalTestStats.passedTests}/${externalTestStats.totalTests}`
                  : testsStatus === 'passing'
                  ? isArabic ? 'ناجحة' : 'Passing'
                  : testsStatus === 'failing'
                  ? isArabic ? 'فاشلة' : 'Failing'
                  : isArabic ? 'لم تُشغّل' : 'Not run'}
              </div>
              {/* Phase 137.3: Show Test Coach status label */}
              <div className={clsx('text-[9px] mt-0.5', testCoachSummary.colorClass)}>
                {getTestCoachLabel(testCoachSummary, locale)}
              </div>
              {/* Phase 137.4.2: Show Coverage Coach hint if not HIGH */}
              {coverageCoachSummary.status !== 'HIGH' && (
                <div className={clsx('text-[8px] mt-0.5 opacity-80', coverageCoachSummary.colorClass)}>
                  {coverageCoachSummary.icon} {coverageCoachSummary.coveragePercent.toFixed(0)}% {isArabic ? 'تغطية' : 'coverage'}
                </div>
              )}
            </div>

            <div className={clsx(
              'rounded-xl border px-3 py-2 transition-all',
              getCardStyle(securityTone)
            )}>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                {isArabic ? 'الأمان' : 'Security'}
              </div>
              <div className={clsx(
                'mt-1 text-sm font-semibold',
                securityTone === 'danger' ? 'text-rose-200' : 'text-emerald-200'
              )}>
                {hasSecurityAlerts
                  ? isArabic ? 'توجد تنبيهات' : 'Alerts present'
                  : isArabic ? 'آمن' : 'Clear'}
              </div>
            </div>

            <div className={clsx(
              'rounded-xl border px-3 py-2 transition-all',
              getCardStyle(issuesTone)
            )}>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                {isArabic ? 'المشاكل' : 'Issues'}
              </div>
              <div className={clsx(
                'mt-1 text-sm font-semibold',
                issuesTone === 'danger' ? 'text-rose-200' : issuesTone === 'warn' ? 'text-amber-200' : 'text-emerald-200'
              )}>
                {reasons.length || 0} {isArabic ? 'عنصر' : 'items'}
              </div>
            </div>
          </div>

          {/* 2 Column Layout: Left = Quality Gate, Right = Quality Coach */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)]">
            {/* Left Column: Quality Gate + Actions + History */}
            <div className="space-y-4">
              {/* Reasons list */}
              <div className="space-y-1.5 rounded-xl border border-white/8 bg-[#07041f] px-3 py-3">
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-300">
                  <span>{isArabic ? 'قائمة فحص ما قبل النشر' : 'Pre-deploy checklist'}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQualityPanel?.();
                      handleClose();
                    }}
                    className="text-[10px] text-violet-300 hover:text-violet-100 underline-offset-2 hover:underline"
                  >
                    {isArabic ? 'فتح لوحة الجودة' : 'Open Project Quality'}
                  </button>
                </div>

                {reasons.length === 0 ? (
                  <p className="text-[11px] text-emerald-200/90">
                    {isArabic
                      ? '✅ جميع الفحوصات المطلوبة تبدو جيدة. يمكنك النشر بأمان.'
                      : '✅ All required checks look good. You\'re safe to deploy.'}
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                    {reasons.map((r) => (
                      <li
                        key={r.code}
                        className={clsx(
                          'relative flex items-start gap-2 rounded-lg py-1.5 text-[11px] overflow-hidden',
                          'shadow-[inset_0_0_8px_rgba(255,255,255,0.04)] hover:bg-white/[0.04] transition-colors',
                          isArabic ? 'pr-3 pl-2' : 'pl-3 pr-2',
                          r.severity === 'critical'
                            ? 'bg-rose-500/10 text-rose-100'
                            : r.severity === 'warning'
                            ? 'bg-amber-500/10 text-amber-100'
                            : 'bg-slate-500/10 text-slate-100'
                        )}
                      >
                        {/* Severity bar indicator - gradient with glow */}
                        <div
                          className={clsx(
                            'absolute top-0 bottom-0 w-1 rounded-full',
                            isArabic ? 'right-0' : 'left-0',
                            r.severity === 'critical'
                              ? 'bg-gradient-to-b from-red-400 to-red-700 shadow-[0_0_10px_rgba(255,60,60,0.5)]'
                              : r.severity === 'warning'
                              ? 'bg-gradient-to-b from-amber-300 to-amber-600 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                              : 'bg-gradient-to-b from-slate-300 to-slate-500'
                          )}
                        />
                        <span className="mt-[3px] text-xs flex-shrink-0">
                          {r.severity === 'critical'
                            ? '⛔'
                            : r.severity === 'warning'
                            ? '⚠️'
                            : 'ℹ️'}
                        </span>
                        <span>{isArabic ? r.labelAr : r.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Phase 135.3: Quality Actions Panel */}
              {policyResult && qualityActions.length > 0 && (
                <QualityActionsPanel
                  result={policyResult}
                  actions={qualityActions}
                  locale={locale}
                  onRunAction={handleRunQualityAction}
                  isRunning={isRunningAction}
                />
              )}

              {/* Phase 135.4: Quality History Panel */}
              {historySnapshots.length > 0 && (
                <QualityHistoryPanel
                  snapshots={historySnapshots}
                  locale={locale}
                  maxVisible={3}
                  compact={true}
                />
              )}

              {/* Phase 136.0: Security Alerts Panel */}
              {securityAlerts.length > 0 && (
                <SecurityAlertsPanel
                  alerts={securityAlerts}
                  locale={locale === 'ar' ? 'ar' : 'en'}
                />
              )}

              {/* Phase 140.6: ATP (Autonomous Test Pipeline) Card */}
              {isATPEnabled && (
                <div className={clsx(
                  'rounded-xl border px-4 py-3',
                  atpSummary
                    ? atpSummary.failingTests > 0
                      ? 'border-red-500/30 bg-red-500/5'
                      : atpSummary.coverageDelta < 0
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/5 bg-white/[0.02]'
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                        <span>🧪</span>
                        <span>{isArabic ? 'أنبوب الاختبار التلقائي' : 'Autonomous Test Pipeline'}</span>
                      </div>
                      {isATPRunning ? (
                        <div className="text-sm text-white mt-1 flex items-center gap-2">
                          <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          <span>{isArabic ? 'جاري التشغيل...' : 'Running...'}</span>
                          {atpCurrentPhase && (
                            <span className="text-xs text-white/50">({atpCurrentPhase})</span>
                          )}
                        </div>
                      ) : atpSummary ? (
                        <div className="text-sm text-white mt-1">
                          <span className="font-semibold">{atpSummary.totalTests}</span>
                          <span className="text-white/60"> {isArabic ? 'اختبار' : 'tests'}</span>
                          {atpSummary.failingTests > 0 && (
                            <span className="text-red-400 mx-1">
                              ({atpSummary.failingTests} {isArabic ? 'فاشل' : 'failing'})
                            </span>
                          )}
                          <span className="mx-1">·</span>
                          <span className={atpSummary.coverageDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                            {atpSummary.coverageDelta >= 0 ? '↑' : '↓'}{Math.abs(atpSummary.coverageDelta).toFixed(1)}%
                          </span>
                          <span className="text-white/40 ml-1">{isArabic ? 'تغطية' : 'coverage'}</span>
                          {atpSummary.finishedAt && (
                            <span className="text-xs text-white/40 ml-2">
                              ({new Date(atpSummary.finishedAt).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-white/60 mt-1">
                          {isArabic
                            ? 'لم يتم تشغيل أي دورة اختبار تلقائية بعد.'
                            : 'No ATP cycles have run yet.'}
                        </div>
                      )}
                      {/* Show additional stats if available */}
                      {atpSummary && (
                        <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-white/50">
                          {atpSummary.autoTestsGenerated > 0 && (
                            <span>🔧 {atpSummary.autoTestsGenerated} {isArabic ? 'اختبار جديد' : 'auto-generated'}</span>
                          )}
                          {atpSummary.suggestedFixes > 0 && (
                            <span>💡 {atpSummary.suggestedFixes} {isArabic ? 'اقتراح' : 'suggested fixes'}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Run ATP button */}
                      <button
                        type="button"
                        disabled={isATPRunning}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerATPCycle();
                        }}
                        className={clsx(
                          'text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors',
                          isATPRunning
                            ? 'bg-slate-500/15 text-slate-400 border border-slate-400/40 cursor-not-allowed'
                            : 'bg-blue-500/15 text-blue-200 border border-blue-400/40 hover:bg-blue-500/25 hover:border-blue-400/60'
                        )}
                      >
                        <span>{isATPRunning ? '⏳' : '▶️'}</span>
                        <span>{isArabic ? 'تشغيل ATP' : 'Run ATP'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Warning if tests are failing or coverage regression */}
                  {atpSummary && (atpSummary.failingTests > 0 || atpSummary.coverageDelta < -5) && (
                    <div className={clsx(
                      'mt-3 px-3 py-2 rounded-lg flex items-start gap-2',
                      atpSummary.failingTests > 0
                        ? 'bg-red-500/15 border border-red-500/30'
                        : 'bg-amber-500/15 border border-amber-500/30'
                    )}>
                      <span className="text-sm flex-shrink-0">
                        {atpSummary.failingTests > 0 ? '🚨' : '⚠️'}
                      </span>
                      <div className="flex-1 text-[11px]">
                        <div className={clsx(
                          'font-medium',
                          atpSummary.failingTests > 0 ? 'text-red-300' : 'text-amber-300'
                        )}>
                          {atpSummary.failingTests > 0
                            ? isArabic
                              ? `تحذير: ${atpSummary.failingTests} اختبار فاشل!`
                              : `Warning: ${atpSummary.failingTests} failing test(s)!`
                            : isArabic
                              ? 'تحذير: تراجع في التغطية'
                              : 'Warning: Coverage regression'}
                        </div>
                        <div className="text-white/60 mt-0.5">
                          {isArabic
                            ? 'يُنصح بمراجعة نتائج ATP قبل النشر. هذا تحذير فقط ولن يمنع النشر.'
                            : 'Review ATP results before deploying. This is a warning only and will not block deployment.'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Phase 138.4: Project Optimization Check Card - moved after ATP for alignment */}
              <div className={clsx(
                'rounded-xl border px-4 py-3',
                getCardStyle(optimizationTone),
                'border-white/5 bg-white/[0.02]'
              )}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                      <span>📊</span>
                      <span>{isArabic ? 'تحسين المشروع' : 'Project Optimization'}</span>
                    </div>
                    {externalOptimizationStats ? (
                      <div className="text-sm text-white mt-1">
                        {isArabic ? 'آخر فحص: ' : 'Last run: '}
                        <span className="font-semibold">{externalOptimizationStats.overallScore}%</span>
                        <span className="mx-1">·</span>
                        <span className={getRiskColorClass(externalOptimizationStats.riskLevel)}>
                          {externalOptimizationStats.riskLevel.toUpperCase()} {isArabic ? 'خطورة' : 'risk'}
                        </span>
                        {externalOptimizationStats.finishedAt && (
                          <span className="text-xs text-white/40 ml-2">
                            ({new Date(externalOptimizationStats.finishedAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-white/60 mt-1">
                        {isArabic
                          ? 'لم يتم تشغيل أي فحص تحسين لهذا المشروع بعد.'
                          : 'No optimization runs yet for this project.'}
                      </div>
                    )}
                    {/* Show sub-scores if available */}
                    {externalOptimizationStats && externalOptimizationStats.status === 'completed' && (
                      <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-white/50">
                        <span>🔒 {isArabic ? 'أمان' : 'Sec'}: {externalOptimizationStats.securityScore}%</span>
                        <span>🧪 {isArabic ? 'اختبارات' : 'Tests'}: {externalOptimizationStats.reliabilityScore}%</span>
                        <span>📈 {isArabic ? 'تغطية' : 'Cov'}: {externalOptimizationStats.coverageScore}%</span>
                        <span>🛠️ {isArabic ? 'صيانة' : 'Maint'}: {externalOptimizationStats.maintainabilityScore}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Phase 138.5.2: Launch ACE button - only show if optimization data available and risk is high/critical */}
                    {onLaunchAce && externalOptimizationStats &&
                      (externalOptimizationStats.riskLevel === 'high' || externalOptimizationStats.riskLevel === 'critical') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchAce({
                            riskLevel: externalOptimizationStats.riskLevel,
                            overallScore: externalOptimizationStats.overallScore,
                            reasons: [
                              `Risk level: ${externalOptimizationStats.riskLevel}`,
                              `Overall score: ${externalOptimizationStats.overallScore}%`,
                              `Security: ${externalOptimizationStats.securityScore}%`,
                              `Reliability: ${externalOptimizationStats.reliabilityScore}%`,
                              `Coverage: ${externalOptimizationStats.coverageScore}%`,
                            ],
                          });
                          handleClose();
                        }}
                        className={clsx(
                          'text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1',
                          externalOptimizationStats.riskLevel === 'critical'
                            ? 'bg-red-500/20 text-red-200 border border-red-400/40 hover:bg-red-500/30'
                            : 'bg-orange-500/20 text-orange-200 border border-orange-400/40 hover:bg-orange-500/30',
                          'transition-colors'
                        )}
                      >
                        <span>🚀</span>
                        <span>{isArabic ? 'ACE' : 'Launch ACE'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[PreDeployGate] View optimization clicked');
                      }}
                      className={clsx(
                        'text-[10px] px-3 py-1.5 rounded-full',
                        'bg-violet-500/15 text-violet-200 border border-violet-400/40',
                        'hover:bg-violet-500/25 hover:border-violet-400/60',
                        'transition-colors'
                      )}
                    >
                      {isArabic ? 'عرض التحسين' : 'View optimization'}
                    </button>
                  </div>
                </div>

                {/* Phase 138.4.2: Soft Gate Warning for High/Critical Risk */}
                {externalOptimizationStats &&
                  (externalOptimizationStats.riskLevel === 'high' || externalOptimizationStats.riskLevel === 'critical') && (
                  <div className={clsx(
                    'mt-3 px-3 py-2 rounded-lg flex items-start gap-2',
                    externalOptimizationStats.riskLevel === 'critical'
                      ? 'bg-red-500/15 border border-red-500/30'
                      : 'bg-orange-500/15 border border-orange-500/30'
                  )}>
                    <span className="text-sm flex-shrink-0">
                      {externalOptimizationStats.riskLevel === 'critical' ? '🚨' : '⚠️'}
                    </span>
                    <div className="flex-1 text-[11px]">
                      <div className={clsx(
                        'font-medium',
                        externalOptimizationStats.riskLevel === 'critical' ? 'text-red-300' : 'text-orange-300'
                      )}>
                        {isArabic
                          ? externalOptimizationStats.riskLevel === 'critical'
                            ? 'تحذير: مستوى خطورة حرج!'
                            : 'تحذير: مستوى خطورة عالي'
                          : externalOptimizationStats.riskLevel === 'critical'
                            ? 'Warning: Critical risk level!'
                            : 'Warning: High risk level'}
                      </div>
                      <div className="text-white/60 mt-0.5">
                        {isArabic
                          ? 'يُنصح بمراجعة نتائج التحسين قبل النشر. هذا تحذير فقط ولن يمنع النشر.'
                          : 'Review optimization results before deploying. This is a warning only and will not block deployment.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Phase 140.7: Quality Story - "at a glance" summary */}
              <PreDeployQualityStory locale={locale} />

              {/* Phase 137.3: Test Coach Diagnosis Card - show when tests need attention */}
              {testCoachSummary.status !== 'HEALTHY' && (
                <div className={clsx(
                  'rounded-xl border px-3 py-3',
                  testCoachSummary.bgClass,
                  'border-white/8'
                )}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-lg">{testCoachSummary.icon}</span>
                    <div className="flex-1">
                      <div className={clsx('text-sm font-medium', testCoachSummary.colorClass)}>
                        {isArabic ? 'تشخيص Test Coach' : 'Test Coach Diagnosis'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {getTestCoachSubtitle(testCoachSummary, locale)}
                      </div>
                    </div>
                  </div>
                  {/* Diagnosis bullets */}
                  <ul className="space-y-1 ml-6">
                    {getTestCoachDetails(testCoachSummary, locale).map((detail, idx) => (
                      <li key={idx} className="text-[10px] text-slate-300/80 flex items-start gap-1.5">
                        <span className="text-[8px] mt-0.5 text-slate-500">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  {/* Run tests again hint */}
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                    <span>💡</span>
                    <span>
                      {isArabic
                        ? 'اضغط "إعادة تشغيل الاختبارات" أدناه لتحديث الحالة'
                        : 'Click "Run tests again" below to update status'}
                    </span>
                  </div>
                </div>
              )}

              {/* Phase 137.4.2: Coverage Coach Diagnosis Card - show when coverage needs attention */}
              {coverageCoachSummary.status !== 'HIGH' && (
                <div className={clsx(
                  'rounded-xl border px-3 py-3',
                  coverageCoachSummary.bgClass,
                  'border-white/8'
                )}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-lg">{coverageCoachSummary.icon}</span>
                    <div className="flex-1">
                      <div className={clsx('text-sm font-medium', coverageCoachSummary.colorClass)}>
                        {isArabic ? 'تشخيص Coverage Coach' : 'Coverage Coach Diagnosis'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {getCoverageCoachSubtitle(coverageCoachSummary, locale)}
                      </div>
                    </div>
                  </div>
                  {/* Stats bar */}
                  <div className="flex items-center gap-2 mb-2 ml-6 text-[10px] text-slate-400">
                    <span>{coverageCoachSummary.filesWithTests}/{coverageCoachSummary.totalFiles} {isArabic ? 'ملفات مغطاة' : 'files covered'}</span>
                    <span className="text-slate-600">•</span>
                    <span className={coverageCoachSummary.colorClass}>
                      {coverageCoachSummary.coveragePercent.toFixed(0)}% {isArabic ? 'تغطية' : 'coverage'}
                    </span>
                    {coverageCoachSummary.highRiskCount > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-red-400">
                          {coverageCoachSummary.highRiskCount} {isArabic ? 'ملفات عالية الخطورة' : 'high-risk files'}
                        </span>
                      </>
                    )}
                  </div>
                  {/* Diagnosis bullets */}
                  <ul className="space-y-1 ml-6">
                    {getCoverageCoachDetails(coverageCoachSummary, locale).map((detail, idx) => (
                      <li key={idx} className="text-[10px] text-slate-300/80 flex items-start gap-1.5">
                        <span className="text-[8px] mt-0.5 text-slate-500">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  {/* Improvement hint */}
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                    <span>🧪</span>
                    <span>
                      {isArabic
                        ? 'اضغط "عرض لوحة الجودة" للوصول لوصفات تحسين التغطية'
                        : 'Click "View full quality panel" for coverage improvement recipes'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Quality Coach Panel (full intelligence layer) */}
            <div>
              <QualityCoachPanelFull
                locale={locale}
                suggestions={coachSuggestions}
                healthTrend={healthTrend}
                latestHealth={healthScore ?? 0}
                latestIssues={reasons.length}
                testsStatus={testsStatus}
                securityAlerts={securityAlerts.length}
                snapshotsCount={historySnapshots.length}
                onRunAction={handleRunCoachAction}
                onRunPipeline={handleRunAutoImprovePipeline}
              />

              {/* Phase 185: Auto-Improve Summary Card */}
              {(autoImproveSummary || isRunningPipeline) && (
                <div className={clsx(
                  'mt-4 rounded-xl border px-4 py-3 backdrop-blur-md',
                  isRunningPipeline
                    ? 'border-blue-400/40 bg-blue-500/10 animate-pulse'
                    : autoImproveSummary && autoImproveSummary.delta > 0
                    ? 'border-emerald-400/40 bg-emerald-500/10'
                    : 'border-amber-400/40 bg-amber-500/10'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {isRunningPipeline ? '⏳' : autoImproveSummary && autoImproveSummary.delta > 0 ? '✅' : '📊'}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">
                        {isRunningPipeline
                          ? (isArabic ? 'جاري تحسين المشروع...' : 'Auto-improving project...')
                          : (isArabic ? 'ملخص التحسين التلقائي' : 'Auto-Improve Summary')}
                      </div>
                      {autoImproveSummary && !isRunningPipeline && (
                        <div className="text-xs text-white/60">
                          {new Date(autoImproveSummary.timestamp).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {autoImproveSummary && !isRunningPipeline && (
                    <div className="space-y-2">
                      {/* Issues Delta */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/70">{isArabic ? 'المشاكل' : 'Issues'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">{autoImproveSummary.issuesBefore}</span>
                          <span className="text-white/30">→</span>
                          <span className={autoImproveSummary.delta > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                            {autoImproveSummary.issuesAfter}
                          </span>
                          {autoImproveSummary.delta !== 0 && (
                            <span className={clsx(
                              'text-xs px-1.5 py-0.5 rounded-full',
                              autoImproveSummary.delta > 0
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            )}>
                              {autoImproveSummary.delta > 0 ? `-${autoImproveSummary.delta}` : `+${Math.abs(autoImproveSummary.delta)}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Security Delta */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/70">{isArabic ? 'تنبيهات الأمان' : 'Security Alerts'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">{autoImproveSummary.securityBefore}</span>
                          <span className="text-white/30">→</span>
                          <span className={autoImproveSummary.securityBefore > autoImproveSummary.securityAfter ? 'text-emerald-400' : 'text-white'}>
                            {autoImproveSummary.securityAfter}
                          </span>
                        </div>
                      </div>

                      {/* Tests Status */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/70">{isArabic ? 'الاختبارات' : 'Tests'}</span>
                        <span className={clsx(
                          autoImproveSummary.testsStatus === 'passing' ? 'text-emerald-400' :
                          autoImproveSummary.testsStatus === 'failing' ? 'text-red-400' :
                          'text-white/50'
                        )}>
                          {autoImproveSummary.testsStatus === 'passing' ? (isArabic ? '✅ ناجحة' : '✅ Passing') :
                           autoImproveSummary.testsStatus === 'failing' ? (isArabic ? '❌ فاشلة' : '❌ Failing') :
                           (isArabic ? '⏳ لم تُشغّل' : '⏳ Not run')}
                        </span>
                      </div>

                      {/* Summary message */}
                      {autoImproveSummary.delta > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10 text-xs text-emerald-300">
                          {isArabic
                            ? `✅ تم إصلاح ${autoImproveSummary.delta} مشكلة بواسطة ACE Auto-Fix`
                            : `✅ ACE Auto-Fix resolved ${autoImproveSummary.delta} issues`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions - Neon glow buttons (sticky) */}
        <div className="flex-shrink-0 flex flex-col gap-2 border-t border-white/10 px-5 py-3 text-[11px] sm:flex-row sm:items-center sm:justify-between rounded-b-2xl bg-black/20 backdrop-blur-sm">
          <div className="flex gap-2">
            {/* Run tests button - emerald glow (polished) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRunChecks();
              }}
              disabled={isRunning || isRunningChecks}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2',
                'bg-emerald-500/15 text-emerald-200 border border-emerald-400/60',
                'transition-all duration-200',
                'hover:bg-emerald-500/25 hover:border-emerald-400/80 hover:shadow-[0_0_18px_rgba(52,211,153,0.45)]',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:bg-emerald-500/15'
              )}
            >
              {isRunning || isRunningChecks
                ? isArabic ? 'جاري الفحص...' : 'Running checks…'
                : isArabic ? 'إعادة تشغيل الاختبارات' : 'Run tests again'}
            </button>

            {/* View quality panel button - sky/cyan glow (polished) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenQualityPanel?.();
                handleClose();
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2',
                'bg-sky-500/10 text-sky-200 border border-sky-400/50',
                'transition-all duration-200',
                'hover:bg-sky-500/20 hover:border-sky-400/70 hover:shadow-[0_0_18px_rgba(56,189,248,0.4)]'
              )}
            >
              {isArabic ? 'عرض لوحة الجودة' : 'View full quality panel'}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            {level !== 'clean' && (
              <span className="text-[10px] text-slate-400">
                {level === 'blocked'
                  ? isConfirmingOverride
                    ? isArabic ? 'اضغط نشر مرة أخرى للتأكيد.' : 'Press deploy again to confirm override.'
                    : isArabic ? 'التجاوز غير موصى به.' : 'Deploy override is not recommended.'
                  : isArabic ? 'يمكنك النشر، لكن راجع التحذيرات أولاً.' : 'You can still deploy, but review warnings first.'}
              </span>
            )}

            {/* Deploy button - cinematic, prominent with gradient + scale */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmDeployClick();
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[11px] font-semibold',
                'transition-all duration-200 transform',
                'hover:scale-[1.02] active:scale-[0.98]',
                level === 'clean'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-[0_0_24px_rgba(52,211,153,0.5)] hover:shadow-[0_0_32px_rgba(52,211,153,0.7)]'
                  : level === 'blocked'
                  ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_0_28px_rgba(255,50,50,0.7)] hover:shadow-[0_0_40px_rgba(255,70,70,0.85)]'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.55)] hover:shadow-[0_0_32px_rgba(251,191,36,0.7)]'
              )}
            >
              {level === 'clean'
                ? isArabic ? 'انشر الآن' : 'Deploy now'
                : level === 'blocked'
                ? isConfirmingOverride
                  ? isArabic ? 'انشر على أي حال (تجاوز)' : 'Deploy anyway (override)'
                  : isArabic ? 'انشر على أي حال' : 'Deploy anyway'
                : isArabic ? 'انشر بحذر' : 'Deploy with caution'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreDeployGateModal;
