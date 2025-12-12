// desktop/src/lib/quality/codeEvolutionEngine.ts
// =============================================================================
// Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)
// =============================================================================
// NOTE: This file is part of the locked Quality pipeline.
// Any major behavioral changes should be done in a new Phase (>= 150).
// =============================================================================
// Phase 149: Code Evolution Engine
// Phase 149.5: Added NO_CHANGE suggestions for consecutive no-change runs
// Computes evolution summary from ACE telemetry and Code Health snapshots

import type {
  CodeEvolutionRunInsight,
  CodeEvolutionSummary,
  EvolutionRunStatus,
  EvolutionTrend,
  EvolutionSuggestion,
  EvolutionPlan,
  EvolutionPlanStep,
} from './codeEvolutionTypes';
import type { AceRun } from '../../contexts/aceTelemetryContext';
import type { QualitySnapshot } from './qualityHistoryTypes';

/**
 * Determine run status based on delta
 */
function determineRunStatus(delta: number | null, appliedPatches: number): EvolutionRunStatus {
  if (delta === null) {
    return appliedPatches > 0 ? 'INCOMPLETE' : 'NO_CHANGE';
  }
  if (delta < 0) return 'IMPROVED';
  if (delta > 0) return 'REGRESSION';
  return 'NO_CHANGE';
}

/**
 * Calculate trend from recent deltas
 */
function calculateTrend(runs: CodeEvolutionRunInsight[]): EvolutionTrend {
  // Look at last 3 runs with valid deltas
  const recentWithDeltas = runs
    .filter((r) => r.delta !== null)
    .slice(-3);

  if (recentWithDeltas.length === 0) return 'FLAT';

  const avgDelta = recentWithDeltas.reduce((sum, r) => sum + (r.delta ?? 0), 0) / recentWithDeltas.length;

  if (avgDelta < -0.5) return 'UP'; // Improving (negative delta = fewer issues)
  if (avgDelta > 0.5) return 'DOWN'; // Regressing
  return 'FLAT';
}

/**
 * Find matching snapshot for a given timestamp
 */
function findSnapshotAtTime(
  snapshots: QualitySnapshot[],
  timestamp: string,
  source: 'scan' | 'auto_fix_after_scan',
  toleranceMs: number = 30000
): QualitySnapshot | null {
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) return null;

  // Find closest snapshot with matching source within tolerance
  let closest: QualitySnapshot | null = null;
  let closestDiff = Infinity;

  for (const snap of snapshots) {
    if (snap.source !== source) continue;
    const snapTs = new Date(snap.createdAt).getTime();
    if (Number.isNaN(snapTs)) continue;
    const diff = Math.abs(snapTs - ts);
    if (diff < toleranceMs && diff < closestDiff) {
      closest = snap;
      closestDiff = diff;
    }
  }

  return closest;
}

/**
 * Build Code Evolution Summary from ACE runs and snapshots
 */
export function buildCodeEvolutionSummary(
  aceRuns: AceRun[],
  snapshots: QualitySnapshot[]
): CodeEvolutionSummary {
  // Sort runs by start time
  const sortedRuns = [...aceRuns].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  // Sort snapshots by createdAt
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Build insights for each run
  const runs: CodeEvolutionRunInsight[] = sortedRuns.map((run) => {
    // Try to get issues from ACE run itself first
    let issuesBefore = run.issuesBefore ?? null;
    let issuesAfter = run.issuesAfter ?? null;

    // If not available, try to find from snapshots
    if (issuesBefore === null) {
      const beforeSnap = findSnapshotAtTime(sortedSnapshots, run.startedAt, 'scan');
      if (beforeSnap) {
        issuesBefore = beforeSnap.totalIssues;
      }
    }

    if (issuesAfter === null) {
      const afterSnap = findSnapshotAtTime(sortedSnapshots, run.finishedAt, 'auto_fix_after_scan');
      if (afterSnap) {
        issuesAfter = afterSnap.totalIssues;
      }
    }

    // Calculate delta
    let delta: number | null = null;
    if (issuesBefore !== null && issuesAfter !== null) {
      delta = issuesAfter - issuesBefore;
    } else if (run.debtDelta !== undefined && run.debtDelta !== null) {
      // Use debt delta as fallback
      delta = run.debtDelta;
    }

    const durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();

    return {
      aceRunId: run.id,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs: Math.max(0, durationMs),
      targetedIssues: run.targetedIssues ?? 0,
      appliedPatches: run.totalApplied ?? 0,
      issuesBefore,
      issuesAfter,
      delta,
      status: determineRunStatus(delta, run.totalApplied ?? 0),
    };
  });

  // Calculate aggregates
  const improvedRuns = runs.filter((r) => r.status === 'IMPROVED').length;
  const totalDelta = runs.reduce((sum, r) => sum + (r.delta ?? 0), 0);
  const deltas = runs.map((r) => r.delta).filter((d): d is number => d !== null);
  const bestDelta = deltas.length > 0 ? Math.min(...deltas) : 0;
  const trend = calculateTrend(runs);

  return {
    runs,
    totalRuns: runs.length,
    improvedRuns,
    totalDelta,
    bestDelta,
    trend,
    lastRun: runs.length > 0 ? runs[runs.length - 1] : undefined,
  };
}

/**
 * Generate suggestions based on evolution summary
 */
export function generateEvolutionSuggestions(
  summary: CodeEvolutionSummary,
  currentHealth: number
): EvolutionSuggestion[] {
  const suggestions: EvolutionSuggestion[] = [];

  // Suggest running ACE if no recent runs or health is low
  if (summary.totalRuns === 0) {
    suggestions.push({
      id: 'first-ace-run',
      type: 'run_ace',
      title: 'Run your first ACE scan',
      titleAr: 'شغّل أول فحص ACE',
      description: 'Start improving code quality by running ACE Auto-Fix.',
      descriptionAr: 'ابدأ بتحسين جودة الكود عن طريق تشغيل ACE Auto-Fix.',
      priority: 'high',
      action: 'runAce',
    });
  } else if (currentHealth < 70) {
    suggestions.push({
      id: 'improve-health',
      type: 'run_ace',
      title: 'Run ACE to improve health',
      titleAr: 'شغّل ACE لتحسين الصحة',
      description: `Health is at ${currentHealth}%. Running ACE can help reduce issues.`,
      descriptionAr: `الصحة عند ${currentHealth}%. تشغيل ACE يمكن أن يساعد في تقليل المشاكل.`,
      priority: 'high',
      action: 'runAce',
    });
  }

  // Check for regressions
  const recentRegressions = summary.runs.filter((r) => r.status === 'REGRESSION').slice(-3);
  if (recentRegressions.length > 0) {
    suggestions.push({
      id: 'review-regressions',
      type: 'review_regressions',
      title: 'Review recent regressions',
      titleAr: 'راجع التراجعات الأخيرة',
      description: `${recentRegressions.length} recent run(s) increased issues. Review and address root causes.`,
      descriptionAr: `${recentRegressions.length} تشغيل أخير زاد المشاكل. راجع وعالج الأسباب الجذرية.`,
      priority: 'medium',
    });
  }

  // Phase 149.5: Check for consecutive NO_CHANGE runs
  const recentNoChange = summary.runs.slice(-3).filter((r) => r.status === 'NO_CHANGE');
  if (recentNoChange.length >= 2) {
    // Suggest lowering risk level
    suggestions.push({
      id: 'lower-risk-level',
      type: 'target_files',
      title: 'Adjust risk profile',
      titleAr: 'عدّل إعدادات الخطورة',
      description: "Most recent ACE runs didn't apply any changes. Consider lowering the risk level or targeting less critical files to allow bolder refactors.",
      descriptionAr: 'أغلب تشغيلات ACE الأخيرة لم تطبّق أي تغييرات. فكّر في خفض مستوى الخطورة أو استهداف ملفات أقل حساسية للسماح بإعادة هيكلة أكثر جرأة.',
      priority: 'medium',
    });

    // Suggest focusing on hotspots
    suggestions.push({
      id: 'focus-hotspots',
      type: 'target_files',
      title: 'Focus on Code Hotspots',
      titleAr: 'ركّز على مناطق السخونة',
      description: 'Use the Code Hotspots section to manually pick a few high-risk files and run ACE on them with a focused scope.',
      descriptionAr: 'استخدم قسم "مناطق السخونة" لاختيار عدد من الملفات عالية الخطورة وتشغيل ACE عليها بنطاق مركّز.',
      priority: 'medium',
    });

    // Suggest combining with tests
    suggestions.push({
      id: 'combine-with-tests',
      type: 'run_ace',
      title: 'Combine with Tests & Security',
      titleAr: 'ادمج مع الاختبارات والأمان',
      description: 'Combine ACE runs with tests and security checks. New failing tests or alerts can reveal fresh improvement opportunities.',
      descriptionAr: 'ادمج تشغيلات ACE مع الاختبارات وفحوصات الأمان. ظهور اختبارات فاشلة أو تنبيهات جديدة قد يكشف فرص تحسين إضافية.',
      priority: 'low',
    });
  }

  // Suggest scheduling scans if no recent activity
  if (summary.lastRun) {
    const lastRunAge = Date.now() - new Date(summary.lastRun.finishedAt).getTime();
    const hoursSinceLastRun = lastRunAge / (1000 * 60 * 60);
    if (hoursSinceLastRun > 24) {
      suggestions.push({
        id: 'schedule-scan',
        type: 'schedule_scan',
        title: 'Schedule regular scans',
        titleAr: 'جدوِل فحوصات منتظمة',
        description: `Last ACE run was ${Math.round(hoursSinceLastRun)} hours ago. Consider running more frequently.`,
        descriptionAr: `آخر تشغيل ACE كان قبل ${Math.round(hoursSinceLastRun)} ساعة. فكر في التشغيل بشكل أكثر تكراراً.`,
        priority: 'low',
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
}

/**
 * Generate evolution plan based on current state
 */
export function generateEvolutionPlan(
  summary: CodeEvolutionSummary,
  currentHealth: number,
  targetHealth: number = 90
): EvolutionPlan {
  const steps: EvolutionPlanStep[] = [];
  let completedSteps = 0;

  // Step 1: Initial scan
  const hasScanned = summary.totalRuns > 0;
  steps.push({
    step: 1,
    title: 'Initial Code Scan',
    titleAr: 'فحص الكود الأولي',
    description: 'Scan the codebase to identify all issues.',
    descriptionAr: 'افحص قاعدة الكود لتحديد جميع المشاكل.',
    completed: hasScanned,
  });
  if (hasScanned) completedSteps++;

  // Step 2: First ACE run
  const hasImproved = summary.improvedRuns > 0;
  steps.push({
    step: 2,
    title: 'First Successful Fix',
    titleAr: 'أول إصلاح ناجح',
    description: 'Run ACE Auto-Fix to reduce issues.',
    descriptionAr: 'شغّل ACE Auto-Fix لتقليل المشاكل.',
    completed: hasImproved,
    metric: hasImproved ? {
      label: 'Best improvement',
      labelAr: 'أفضل تحسن',
      value: `${Math.abs(summary.bestDelta)} issues`,
    } : undefined,
  });
  if (hasImproved) completedSteps++;

  // Step 3: Reach 70% health
  const reached70 = currentHealth >= 70;
  steps.push({
    step: 3,
    title: 'Reach 70% Health',
    titleAr: 'الوصول لـ 70% صحة',
    description: 'Improve code health to 70% or above.',
    descriptionAr: 'حسّن صحة الكود إلى 70% أو أعلى.',
    completed: reached70,
    metric: {
      label: 'Current health',
      labelAr: 'الصحة الحالية',
      value: `${currentHealth}%`,
    },
  });
  if (reached70) completedSteps++;

  // Step 4: Reach target health
  const reachedTarget = currentHealth >= targetHealth;
  steps.push({
    step: 4,
    title: `Reach ${targetHealth}% Health`,
    titleAr: `الوصول لـ ${targetHealth}% صحة`,
    description: `Achieve target health of ${targetHealth}%.`,
    descriptionAr: `حقق هدف الصحة ${targetHealth}%.`,
    completed: reachedTarget,
    metric: {
      label: 'Gap to target',
      labelAr: 'الفجوة للهدف',
      value: `${Math.max(0, targetHealth - currentHealth)}%`,
    },
  });
  if (reachedTarget) completedSteps++;

  // Step 5: Maintain (always in progress)
  steps.push({
    step: 5,
    title: 'Maintain Quality',
    titleAr: 'حافظ على الجودة',
    description: 'Keep running ACE regularly to maintain code quality.',
    descriptionAr: 'استمر في تشغيل ACE بانتظام للحفاظ على جودة الكود.',
    completed: false,
    metric: summary.totalRuns > 0 ? {
      label: 'Total ACE runs',
      labelAr: 'إجمالي تشغيلات ACE',
      value: summary.totalRuns,
    } : undefined,
  });

  // Estimate runs to target based on average improvement
  const improvingRuns = summary.runs.filter((r) => r.delta !== null && r.delta < 0);
  const avgImprovement = improvingRuns.length > 0
    ? Math.abs(improvingRuns.reduce((sum, r) => sum + (r.delta ?? 0), 0) / improvingRuns.length)
    : 2; // Default estimate

  const healthGap = targetHealth - currentHealth;
  // Rough estimate: 1 health point ≈ 1 issue
  const estimatedRunsToTarget = healthGap > 0
    ? Math.ceil(healthGap / avgImprovement)
    : 0;

  const progress = (completedSteps / steps.length) * 100;

  return {
    steps,
    progress,
    targetHealth,
    currentHealth,
    estimatedRunsToTarget,
  };
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number, isAr: boolean): string {
  if (ms < 1000) return isAr ? 'أقل من ثانية' : '<1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return isAr ? `${seconds} ث` : `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return isAr
      ? `${minutes} د ${remainingSeconds} ث`
      : `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return isAr
    ? `${hours} س ${remainingMinutes} د`
    : `${hours}h ${remainingMinutes}m`;
}

/**
 * Get trend icon
 */
export function getTrendIcon(trend: EvolutionTrend): string {
  switch (trend) {
    case 'UP':
      return '📈';
    case 'DOWN':
      return '📉';
    case 'FLAT':
      return '➡️';
  }
}

/**
 * Get status icon
 */
export function getStatusIcon(status: EvolutionRunStatus): string {
  switch (status) {
    case 'IMPROVED':
      return '✅';
    case 'NO_CHANGE':
      return '➖';
    case 'REGRESSION':
      return '⚠️';
    case 'INCOMPLETE':
      return '❓';
  }
}

/**
 * Get status color class
 */
export function getStatusColorClass(status: EvolutionRunStatus): string {
  switch (status) {
    case 'IMPROVED':
      return 'text-emerald-400';
    case 'NO_CHANGE':
      return 'text-gray-400';
    case 'REGRESSION':
      return 'text-amber-400';
    case 'INCOMPLETE':
      return 'text-blue-400';
  }
}
