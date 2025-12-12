// desktop/src/lib/quality/qualityCoach.ts
// Phase 135.5: Quality Coach - Smart suggestions based on history + policy

import type { QualitySnapshot } from './qualityHistoryTypes';
import type {
  PolicyEvaluationResult,
  PolicyStatus,
} from './policyEngine';
import type { QualityActionType } from './policyActions';

/**
 * Triggers that can activate coach suggestions
 * Phase 136.4: Added granular security triggers
 */
export type QualityCoachTrigger =
  | 'DECLINING_TREND'
  | 'BLOCKED_DEPLOYS'
  | 'NO_TESTS'
  | 'SECURITY_ALERTS'
  | 'SECURITY_CRITICAL'
  | 'SECURITY_TOO_MANY'
  | 'HIGH_ISSUES'
  | 'LOW_HEALTH';

/**
 * A single coach suggestion
 */
export type QualityCoachSuggestion = {
  id: string;
  trigger: QualityCoachTrigger;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  recommendedActionType?: QualityActionType;
  severity: 'info' | 'warning' | 'critical';
};

/**
 * Calculate trend from snapshots
 */
function getTrend(
  snapshots: QualitySnapshot[]
): 'improving' | 'stable' | 'declining' | 'unknown' {
  if (snapshots.length < 2) return 'unknown';

  // Sort by date ascending (oldest first)
  const sorted = [...snapshots].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (last.health > first.health + 3) return 'improving';
  if (last.health < first.health - 3) return 'declining';
  return 'stable';
}

/**
 * Count how many snapshots have BLOCK status
 */
function countBlockedDeploys(snapshots: QualitySnapshot[]): number {
  return snapshots.filter((s) => s.policyStatus === 'BLOCK').length;
}

/**
 * Find the snapshot with lowest health
 */
function findWorstSnapshot(snapshots: QualitySnapshot[]): QualitySnapshot | null {
  if (!snapshots.length) return null;
  return snapshots.reduce((worst, s) =>
    s.health < worst.health ? s : worst
  );
}

/**
 * Build smart suggestions based on:
 * - Historical quality snapshots
 * - Latest policy evaluation result
 */
export function buildQualityCoachSuggestions(params: {
  snapshots: QualitySnapshot[];
  latestPolicyResult: PolicyEvaluationResult | null;
}): QualityCoachSuggestion[] {
  const { snapshots, latestPolicyResult } = params;
  const suggestions: QualityCoachSuggestion[] = [];

  if (!snapshots.length && !latestPolicyResult) return suggestions;

  const trend = getTrend(snapshots);
  const blockedCount = countBlockedDeploys(snapshots);
  const worst = findWorstSnapshot(snapshots);
  const latestStatus: PolicyStatus =
    latestPolicyResult?.status ?? snapshots.at(-1)?.policyStatus ?? 'OK';

  // 1️⃣ Declining trend
  if (trend === 'declining') {
    suggestions.push({
      id: 'declining-trend',
      trigger: 'DECLINING_TREND',
      severity: 'warning',
      recommendedActionType: 'AUTO_FIX_ISSUES',
      title: 'Project health is trending down',
      titleAr: 'صحة المشروع في اتجاه هابط',
      message:
        'Recent scans show a decline in project health. It is recommended to auto-fix top issues and re-run tests.',
      messageAr:
        'عمليات الفحص الأخيرة تُظهر تدهورًا في صحة المشروع. يُنصح بتشغيل إصلاح تلقائي لأكثر المشاكل تأثيرًا ثم إعادة تشغيل الاختبارات.',
    });
  }

  // 2️⃣ Frequent blocked deploys
  if (blockedCount >= 3 && latestStatus === 'BLOCK') {
    suggestions.push({
      id: 'blocked-deploys',
      trigger: 'BLOCKED_DEPLOYS',
      severity: 'critical',
      recommendedActionType: 'RUN_FULL_REVIEW',
      title: 'Deployments are frequently blocked',
      titleAr: 'عمليات النشر يتم حظرها بشكل متكرر',
      message:
        'Multiple recent deploy attempts were blocked by the quality policy. A full project review is recommended to get back to a stable baseline.',
      messageAr:
        'تم حظر عدة محاولات نشر مؤخرًا بواسطة سياسة الجودة. يُنصح بإجراء مراجعة كاملة للمشروع للعودة إلى مستوى مستقر.',
    });
  }

  // 3️⃣ Low health / high issues (suggests Auto-fix)
  if (worst && (worst.health < 60 || worst.totalIssues > 500)) {
    suggestions.push({
      id: 'low-health',
      trigger: 'LOW_HEALTH',
      severity: 'warning',
      recommendedActionType: 'AUTO_FIX_ISSUES',
      title: 'Project health is critically low',
      titleAr: 'صحة المشروع منخفضة بشكل خطير',
      message:
        'The project has a high number of issues or low health. Consider running auto-fix on top files to quickly reduce technical debt.',
      messageAr:
        'المشروع يحتوي على عدد كبير من المشاكل أو صحة منخفضة. فكّر في تشغيل إصلاح تلقائي لأكثر الملفات المليئة بالمشاكل لتقليل الديون التقنية بسرعة.',
    });
  }

  // 4️⃣ Check latest policy reasons → map to NO_TESTS / SECURITY_ALERTS / HIGH_ISSUES
  if (latestPolicyResult) {
    const codes = latestPolicyResult.reasons.map((r) => r.code);

    if (codes.some((c) => c.toLowerCase().includes('test'))) {
      suggestions.push({
        id: 'no-tests',
        trigger: 'NO_TESTS',
        severity: 'warning',
        recommendedActionType: 'GENERATE_TESTS',
        title: 'Tests are missing or not recent',
        titleAr: 'الاختبارات مفقودة أو غير محدثة',
        message:
          'Policy checks indicate missing or outdated tests. Let the Agent generate tests for critical files to improve confidence.',
        messageAr:
          'فحص السياسة يشير إلى نقص في الاختبارات أو عدم تحديثها. دع الوكيل يولّد اختبارات للملفات الحرجة لزيادة الثقة في الكود.',
      });
    }

    // Phase 136.4: Granular security coach suggestions
    if (codes.includes('security_critical_present')) {
      suggestions.push({
        id: 'security-critical',
        trigger: 'SECURITY_CRITICAL',
        severity: 'critical',
        recommendedActionType: 'SECURITY_FIX',
        title: 'Critical security vulnerabilities detected',
        titleAr: 'تم اكتشاف ثغرات أمنية حرجة',
        message:
          'Critical security vulnerabilities were found in the codebase. Deployment is blocked until these are fixed. Run a security fix immediately.',
        messageAr:
          'تم العثور على ثغرات أمنية حرجة في الكود. النشر محظور حتى يتم إصلاحها. شغّل إصلاح أمني فوري.',
      });
    } else if (codes.includes('security_too_many_alerts')) {
      suggestions.push({
        id: 'security-too-many',
        trigger: 'SECURITY_TOO_MANY',
        severity: 'critical',
        recommendedActionType: 'SECURITY_FIX',
        title: 'Too many security alerts',
        titleAr: 'عدد كبير جداً من التنبيهات الأمنية',
        message:
          'The project has exceeded the maximum allowed security alerts. Run a comprehensive security fix to reduce the count below the policy threshold.',
        messageAr:
          'تجاوز المشروع الحد الأقصى المسموح به من التنبيهات الأمنية. شغّل إصلاح أمني شامل لتقليل العدد تحت حد السياسة.',
      });
    } else if (codes.includes('security_alerts_present')) {
      suggestions.push({
        id: 'security-alerts',
        trigger: 'SECURITY_ALERTS',
        severity: 'warning',
        recommendedActionType: 'SECURITY_FIX',
        title: 'Security alerts detected',
        titleAr: 'تم اكتشاف تنبيهات أمنية',
        message:
          'Security-related issues were detected. Consider fixing them before deploying to improve your project security posture.',
        messageAr:
          'تم اكتشاف مشاكل متعلقة بالأمان. فكّر في إصلاحها قبل النشر لتحسين وضع أمان المشروع.',
      });
    }

    if (codes.some((c) => c.toLowerCase().includes('issue'))) {
      suggestions.push({
        id: 'high-issues',
        trigger: 'HIGH_ISSUES',
        severity: 'info',
        recommendedActionType: 'AUTO_FIX_ISSUES',
        title: 'High issue count',
        titleAr: 'عدد كبير من المشاكل',
        message:
          'There are many issues in this project. Consider running auto-fix and then re-evaluating quality.',
        messageAr:
          'يوجد عدد كبير من المشاكل في هذا المشروع. فكّر في تشغيل الإصلاح التلقائي ثم إعادة تقييم الجودة.',
      });
    }
  }

  // Remove duplicates by id
  const unique = new Map<string, QualityCoachSuggestion>();
  for (const s of suggestions) {
    if (!unique.has(s.id)) unique.set(s.id, s);
  }

  return Array.from(unique.values());
}

export default buildQualityCoachSuggestions;
