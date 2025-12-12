// src/lib/quality/policyActions.ts
// Phase 135.3: Quality Actions - maps policy reasons to suggested agent actions

import type { PolicyReason, PolicyStatus } from './policyEngine';

/**
 * Types of quality actions the agent can perform
 */
export type QualityActionType =
  | 'SECURITY_FIX'
  | 'GENERATE_TESTS'
  | 'AUTO_FIX_ISSUES'
  | 'RUN_FULL_REVIEW';

/**
 * A suggested quality action
 */
export type QualityAction = {
  type: QualityActionType;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  suggestedFiles: string[];
  // Future: estimatedDuration, priority, etc.
};

type ReasonToActionConfig = {
  actionType: QualityActionType;
  /** Minimum policy status for this action to be relevant */
  minStatus?: PolicyStatus;
};

/**
 * Maps reason codes to their corresponding action types
 */
const REASON_ACTION_MAP: Record<string, ReasonToActionConfig> = {
  // From policyEngine reason codes
  security_alerts_present: { actionType: 'SECURITY_FIX', minStatus: 'CAUTION' },
  low_health_score: { actionType: 'AUTO_FIX_ISSUES', minStatus: 'CAUTION' },
  high_issue_count: { actionType: 'AUTO_FIX_ISSUES', minStatus: 'CAUTION' },
  no_recent_scan: { actionType: 'RUN_FULL_REVIEW', minStatus: 'CAUTION' },
  no_quality_baseline: { actionType: 'RUN_FULL_REVIEW', minStatus: 'CAUTION' },
  tests_not_run: { actionType: 'GENERATE_TESTS', minStatus: 'CAUTION' },
  tests_failing: { actionType: 'GENERATE_TESTS', minStatus: 'CAUTION' },
  // Legacy uppercase codes (for backwards compatibility)
  SECURITY_ALERTS: { actionType: 'SECURITY_FIX', minStatus: 'CAUTION' },
  LOW_HEALTH: { actionType: 'AUTO_FIX_ISSUES', minStatus: 'CAUTION' },
  TOO_MANY_ISSUES: { actionType: 'AUTO_FIX_ISSUES', minStatus: 'CAUTION' },
  STALE_SCAN: { actionType: 'RUN_FULL_REVIEW', minStatus: 'CAUTION' },
  NO_TESTS: { actionType: 'GENERATE_TESTS', minStatus: 'CAUTION' },
  LOW_TEST_COVERAGE: { actionType: 'GENERATE_TESTS', minStatus: 'CAUTION' },
};

/**
 * Check if a status meets the minimum threshold
 */
function isStatusAtLeast(status: PolicyStatus, min?: PolicyStatus): boolean {
  if (!min) return true;
  const order: PolicyStatus[] = ['OK', 'CAUTION', 'BLOCK'];
  return order.indexOf(status) >= order.indexOf(min);
}

/**
 * Deduplicate file paths
 */
function uniqueFiles(files: string[]): string[] {
  return Array.from(new Set(files));
}

/**
 * Get localized text for each action type
 */
function getActionTexts(type: QualityActionType) {
  switch (type) {
    case 'SECURITY_FIX':
      return {
        label: 'Fix security issues with Agent',
        labelAr: 'إصلاح مشاكل الأمان باستخدام الوكيل',
        description:
          'Run a focused security pass on the affected files to resolve vulnerabilities.',
        descriptionAr:
          'تشغيل مراجعة أمنية مركّزة على الملفات المتأثرة لإصلاح الثغرات والمشاكل الأمنية.',
      };
    case 'GENERATE_TESTS':
      return {
        label: 'Generate tests for critical files',
        labelAr: 'توليد اختبارات للملفات الحرجة',
        description:
          'Let the Agent generate unit/integration tests to improve coverage and confidence.',
        descriptionAr:
          'دع الوكيل يولّد اختبارات وحدات/تكامل لتحسين نسبة التغطية وزيادة الثقة في الكود.',
      };
    case 'AUTO_FIX_ISSUES':
      return {
        label: 'Auto-fix top issues',
        labelAr: 'إصلاح تلقائي لأكثر المشاكل تأثيراً',
        description:
          'Run bulk fixes on the most problematic files to quickly improve project health.',
        descriptionAr:
          'تشغيل إصلاحات جماعية على أكثر الملفات المليئة بالمشاكل لتحسين صحة المشروع بسرعة.',
      };
    case 'RUN_FULL_REVIEW':
      return {
        label: 'Run full project review',
        labelAr: 'تشغيل مراجعة كاملة للمشروع',
        description:
          'Ask the Agent to perform a full review and suggest prioritized improvements.',
        descriptionAr:
          'اطلب من الوكيل إجراء مراجعة كاملة للمشروع واقتراح تحسينات مرتّبة بالأولوية.',
      };
    default:
      return {
        label: 'Run quality action',
        labelAr: 'تشغيل إجراء جودة',
        description: 'Run a quality-related agent action.',
        descriptionAr: 'تشغيل إجراء متعلق بجودة المشروع باستخدام الوكيل.',
      };
  }
}

/**
 * Convert PolicyReasons + affected files into a list of suggested Actions
 *
 * @param reasons - Array of policy reasons from evaluation
 * @param allFiles - All affected files (fallback for actions without specific files)
 * @returns Array of QualityAction suggestions
 */
export function actionsForPolicyReasons(
  reasons: PolicyReason[],
  allFiles: string[] = []
): QualityAction[] {
  const actionsMap = new Map<QualityActionType, QualityAction>();

  for (const reason of reasons) {
    const config = REASON_ACTION_MAP[reason.code];
    if (!config) continue;

    // Map reason severity to PolicyStatus for comparison
    const reasonStatus: PolicyStatus =
      reason.severity === 'critical' ? 'BLOCK' :
      reason.severity === 'warning' ? 'CAUTION' : 'OK';

    if (!isStatusAtLeast(reasonStatus, config.minStatus)) continue;

    const { actionType } = config;
    const existing = actionsMap.get(actionType);
    const reasonFiles = reason.affectedFiles ?? [];

    if (!existing) {
      const texts = getActionTexts(actionType);
      actionsMap.set(actionType, {
        type: actionType,
        label: texts.label,
        labelAr: texts.labelAr,
        description: texts.description,
        descriptionAr: texts.descriptionAr,
        suggestedFiles: uniqueFiles(reasonFiles),
      });
    } else {
      // Merge files from multiple reasons of same action type
      existing.suggestedFiles = uniqueFiles([
        ...existing.suggestedFiles,
        ...reasonFiles,
      ]);
    }
  }

  // If no specific actions but status is not OK, suggest a full review
  const hasAnyAction = actionsMap.size > 0;
  const overallStatus: PolicyStatus =
    reasons.reduce<PolicyStatus>(
      (acc, r) => {
        const rStatus: PolicyStatus =
          r.severity === 'critical' ? 'BLOCK' :
          r.severity === 'warning' ? 'CAUTION' : 'OK';
        if (rStatus === 'BLOCK') return 'BLOCK';
        if (rStatus === 'CAUTION' && acc === 'OK') return 'CAUTION';
        return acc;
      },
      'OK'
    );

  if (!hasAnyAction && overallStatus !== 'OK') {
    const texts = getActionTexts('RUN_FULL_REVIEW');
    actionsMap.set('RUN_FULL_REVIEW', {
      type: 'RUN_FULL_REVIEW',
      label: texts.label,
      labelAr: texts.labelAr,
      description: texts.description,
      descriptionAr: texts.descriptionAr,
      suggestedFiles: uniqueFiles(allFiles),
    });
  }

  return Array.from(actionsMap.values());
}

/**
 * Get icon for action type
 */
export function getActionIcon(type: QualityActionType): string {
  switch (type) {
    case 'SECURITY_FIX':
      return '🛡️';
    case 'GENERATE_TESTS':
      return '🧪';
    case 'AUTO_FIX_ISSUES':
      return '🧹';
    case 'RUN_FULL_REVIEW':
      return '🔍';
    default:
      return '⚡';
  }
}

/**
 * Get priority order for sorting actions
 */
export function getActionPriority(type: QualityActionType): number {
  switch (type) {
    case 'SECURITY_FIX':
      return 1; // Highest priority
    case 'AUTO_FIX_ISSUES':
      return 2;
    case 'GENERATE_TESTS':
      return 3;
    case 'RUN_FULL_REVIEW':
      return 4; // Lowest priority
    default:
      return 5;
  }
}

/**
 * Sort actions by priority
 */
export function sortActionsByPriority(actions: QualityAction[]): QualityAction[] {
  return [...actions].sort(
    (a, b) => getActionPriority(a.type) - getActionPriority(b.type)
  );
}
